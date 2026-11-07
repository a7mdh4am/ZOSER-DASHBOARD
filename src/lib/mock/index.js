// Dummy admin API: a stand-in for fetch() that answers every /api/v1/admin/*
// call from the in-memory data in ./db.js, until there's a backend to talk to.
// ../api.js decides when it's used; delete this folder once it's no longer needed.
//
// It returns real Response objects in a `{ data }` / `{ error }` envelope, so
// api.js's unwrapping and error handling still run. There's no backend yet, so
// this is the API contract a backend should implement; shapes started from the
// draft in _backend/src/modules/admin. Business rules (totals = subtotal −
// discount + shipping, products need a description, ...) follow the shop.
//
// Sign-in: any username/password works. A username from the Team page signs in
// as that staff member (handy for checking permission-gated UI); anything else
// signs in as the super admin. Permissions aren't enforced on the "server" side.

import {
  cityOf,
  db,
  depositsOf,
  newestFirst,
  nextId,
  nowIso,
  ORDER_STATUS,
  orderMatchesSearch,
  paidOf,
  productOf,
  recalcTotals,
  round2,
  zoneOf,
} from "./db.js";
import { toCsv } from "../csv.js";
import {
  dashboard,
  financeOrderRows,
  financeOrders,
  financeSection,
} from "./reports.js";

const BASE = "/api/v1/admin";
const LATENCY_MS = 150;
const SESSION_KEY = "zoser-mock-user";
const DEFAULT_USERNAME = "admin";
const PROFILE_BASE_URL = "https://zoser.example/profile";

class MockError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const notFound = (what) => new MockError(404, `${what} not found`);
const conflict = (message) => new MockError(409, message);

function findOr404(list, id, what) {
  const row = list.find((x) => String(x.id) === String(id));
  if (!row) throw notFound(what);
  return row;
}

function removeFrom(list, row) {
  list.splice(list.indexOf(row), 1);
}

const page = (rows, pageNumber, perPage) =>
  rows.slice((pageNumber - 1) * perPage, pageNumber * perPage);

/* ------------------------------------------------------------------ */
/* routing                                                             */
/* ------------------------------------------------------------------ */

const routes = [];

function on(method, pattern, handler) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  routes.push({ method, regex: new RegExp(`^${source}$`), keys, handler });
}

function matchRoute(method, path) {
  for (const route of routes) {
    const match = route.method === method && path.match(route.regex);
    if (match) {
      const params = Object.fromEntries(
        route.keys.map((key, i) => [key, match[i + 1]]),
      );
      return { handler: route.handler, params };
    }
  }
  return null;
}

const jsonResponse = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (status, message) =>
  jsonResponse(status, { error: { message } });

export async function mockFetch(url, options = {}) {
  await new Promise((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  const method = options.method ?? "GET";
  const { pathname, searchParams } = new URL(url, "http://mock.local");
  const path = pathname.replace(BASE, "");

  const route = matchRoute(method, path);
  if (!route)
    return errorResponse(404, `Dummy API has no handler for ${method} ${path}`);
  if (!path.startsWith("/auth/") && !currentStaff())
    return errorResponse(401, "Not signed in");

  try {
    const data = route.handler({
      params: route.params,
      query: Object.fromEntries(searchParams),
      // A JSON string from request(), or FormData from apiUpload().
      body:
        typeof options.body === "string"
          ? JSON.parse(options.body)
          : options.body,
    });
    // A handler can answer with a ready-made Response, e.g. a CSV file.
    if (data instanceof Response) return data;
    return jsonResponse(200, { data });
  } catch (err) {
    if (err instanceof MockError) return errorResponse(err.status, err.message);
    console.error(`Dummy API crashed on ${method} ${path}`, err);
    return errorResponse(500, `Dummy API error: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* session + auth                                                      */
/* ------------------------------------------------------------------ */

// Starts signed in so the app opens straight on the dashboard. The choice is
// remembered, so signing out survives a reload even though the data doesn't.
const sessionUsername = () =>
  localStorage.getItem(SESSION_KEY) ?? DEFAULT_USERNAME;
const setSessionUsername = (username) =>
  localStorage.setItem(SESSION_KEY, username);
const currentStaff = () =>
  db.staff.find((s) => s.username === sessionUsername()) ?? null;

const roleOf = (staff) => db.roles.find((r) => r.code === staff.role);

const publicAdmin = (staff) => ({
  id: staff.id,
  username: staff.username,
  email: staff.email,
  displayName: staff.displayName,
  role: staff.role,
  roleName: roleOf(staff)?.name ?? staff.role,
});

on("GET", "/auth/me", () => {
  const staff = currentStaff();
  return {
    admin: staff
      ? { ...publicAdmin(staff), permissions: roleOf(staff)?.permissions ?? [] }
      : null,
    csrfToken: "dummy-csrf-token",
  };
});

on("POST", "/auth/refresh", () => {
  if (!currentStaff()) throw new MockError(401, "No refresh token");
  return { refreshed: true };
});

on("POST", "/auth/login", ({ body }) => {
  const staff =
    db.staff.find((s) => s.username === body.username) ??
    db.staff.find((s) => s.username === DEFAULT_USERNAME);
  if (staff.isBlocked)
    throw new MockError(403, "This account has been deactivated");
  setSessionUsername(staff.username);
  return { admin: publicAdmin(staff) };
});

on("POST", "/auth/logout", () => {
  setSessionUsername("");
  return { loggedOut: true };
});

/* ------------------------------------------------------------------ */
/* dashboard + geo                                                     */
/* ------------------------------------------------------------------ */

on("GET", "/dashboard", dashboard);

on("GET", "/geo/cities", () => ({
  cities: db.cities.map(({ id, name, zones }) => ({ id, name, zones })),
}));

/* ------------------------------------------------------------------ */
/* orders + shipments                                                  */
/* ------------------------------------------------------------------ */

const findOrder = (id) => findOr404(db.orders, id, "Order");
const newestOrderFirst = (a, b) => b.order_time.localeCompare(a.order_time);
const profileLink = (pid) => `${PROFILE_BASE_URL}/${pid}`;
const userOfOrder = (order) =>
  db.users.find((u) => u.username === `z${order.id}`) ?? null;

const themeStatuses = (user) =>
  db.customThemes
    .filter((t) => t.is_active)
    .map((t) => ({
      theme_id: t.id,
      theme: t.theme,
      status: user.theme_ids.includes(t.id) ? "owned" : "available",
    }));

const noteRows = (order) =>
  [...order.production_notes].sort(newestFirst).map((note) => ({
    ...note,
    image_url: note.images[0]?.image_url ?? null,
  }));

on("GET", "/orders", ({ query }) => {
  const perPage = Number(query.per_page) || 25;
  const rows = db.orders
    .filter(
      (o) =>
        (!query.status || String(o.status) === query.status) &&
        orderMatchesSearch(o, query.search),
    )
    .sort(newestOrderFirst);

  return {
    orders: page(rows, Number(query.page) || 1, perPage).map((o) => ({
      id: o.id,
      order_time: o.order_time,
      full_name: o.full_name,
      phone: o.phone,
      city: cityOf(o)?.name ?? null,
      product_name: productOf(o)?.name ?? null,
      item_count: o.cards.length,
      status: o.status,
      shipping_id: o.shipping_id,
      price: o.subtotal,
      discount_amount: o.discount_amount,
      shipping_fee: o.shipping_fee,
      grand_total: o.grand_total,
      total_deposit: paidOf(o),
    })),
    total: rows.length,
    per_page: perPage,
  };
});

on("GET", "/orders/:id", ({ params }) => {
  const order = findOrder(params.id);
  const user = userOfOrder(order);
  return {
    order: {
      id: order.id,
      status: order.status,
      order_time: order.order_time,
      applied_coupon: order.coupon,
      full_name: order.full_name,
      phone: order.phone,
      address: order.address,
      city: cityOf(order)?.name ?? null,
      zone: zoneOf(order)?.name ?? null,
      city_id: order.city_id,
      zone_id: order.zone_id,
      product_id: order.product_id,
      product_name: productOf(order)?.name ?? null,
      price: order.unit_price,
      group_name: order.group_name,
      date: order.date,
      addr: order.addr,
      song: order.song,
      notes: order.notes,
    },
    items: order.cards,
    extras: order.extras,
    deposits: depositsOf(order)
      .sort(newestFirst)
      .map(({ id, value, created_at }) => ({ id, value, created_at })),
    financial: {
      gross: order.subtotal,
      discount: order.discount_amount,
      shipping: order.shipping_fee,
      net_total: order.grand_total,
      remaining: round2(order.grand_total - paidOf(order)),
    },
    shipments: db.shipments
      .filter((s) => s.order_id === order.id)
      .sort(newestFirst),
    notes: noteRows(order),
    card_count: order.cards.length,
    edit_products: db.products
      .filter((p) => p.is_active)
      .map((p) => ({
        id: p.id,
        name: p.name,
        colors: p.colors,
        prices: p.card_price_tiers.map((t) => ({
          friends_count: t.cards_count,
          price: t.price,
        })),
      })),
    profile: {
      username: user?.username ?? `z${order.id}`,
      link: order.profile_pid ? profileLink(order.profile_pid) : null,
      themes: user ? themeStatuses(user) : [],
    },
  };
});

on("POST", "/orders/:id/deposits", ({ params, body }) => {
  const order = findOrder(params.id);
  const value = Number(body.value);
  if (!(value > 0)) throw new MockError(422, "Deposit value must be positive");
  const entry = {
    id: nextId(),
    type: "deposit",
    order_id: order.id,
    value,
    description: `${order.full_name} Deposit`,
    created_at: nowIso(),
  };
  db.ledger.push(entry);
  return entry;
});

on("POST", "/orders/:id/status", ({ params, body }) => {
  const order = findOrder(params.id);
  order.status = Number(body.status);
  return { id: order.id, status: order.status };
});

on("POST", "/orders/:id/notes", ({ params, body }) => {
  const order = findOrder(params.id);
  const note = {
    edits: body.get("edits"),
    created_at: nowIso(),
    images: body
      .getAll("photos")
      .map((file) => ({ image_url: URL.createObjectURL(file) })),
  };
  order.production_notes.push(note);
  return note;
});

on("PATCH", "/orders/:id/customer-info", ({ params, body }) => {
  const order = findOrder(params.id);
  order.phone = body.shipPhone;
  return { id: order.id };
});

on("PATCH", "/orders/:id/shipping", ({ params, body }) => {
  const order = findOrder(params.id);
  order.address = body.shipAddress;
  if (body.cityId) order.city_id = body.cityId;
  if (body.zoneId) order.zone_id = body.zoneId;
  return { id: order.id };
});

on("POST", "/orders/:id/design", ({ params, body }) => {
  const order = findOrder(params.id);
  if (body.productId) order.product_id = body.productId;
  if (body.price !== undefined) order.unit_price = body.price;
  // The modal leaves out fields it has blanked, so a missing field means cleared.
  order.group_name = body.groupName ?? null;
  order.date = body.date ?? null;
  order.addr = body.addr ?? null;
  order.song = body.song ?? null;
  order.notes = body.notes ?? null;
  for (const { id, name, color } of body.items ?? []) {
    const card = order.cards.find((c) => c.id === id);
    if (card) Object.assign(card, { name, color });
  }
  recalcTotals(order);
  return { id: order.id };
});

on("POST", "/orders/:id/profile", ({ params }) => {
  const order = findOrder(params.id);
  if (order.profile_pid) throw conflict("This order already has a profile");
  order.profile_pid = `p${order.id}`;
  db.users.push({
    id: nextId(),
    username: `z${order.id}`,
    name: order.full_name,
    friends_count: order.cards.length,
    is_blocked: false,
    pid: order.profile_pid,
    theme_ids: [],
    created_at: nowIso(),
  });
  return {
    username: `z${order.id}`,
    link: profileLink(order.profile_pid),
    temporaryPassword: "dummy-pass-123",
  };
});

on("POST", "/orders/:id/shipments", ({ params, body }) => {
  const order = findOrder(params.id);
  const shipment = {
    id: nextId(),
    order_id: order.id,
    carrier: body.carrier,
    tracking_no: body.trackingNo,
    cod_amount: body.codAmount,
    notes: body.notes ?? null,
    status: "active",
    created_at: nowIso(),
  };
  db.shipments.push(shipment);
  order.shipping_id = body.trackingNo;
  return shipment;
});

on("POST", "/shipments/:id/status", ({ params, body }) => {
  const shipment = findOr404(db.shipments, params.id, "Shipment");
  shipment.status = body.status;
  if (body.status === "returned" || body.status === "cancelled") {
    findOrder(shipment.order_id).shipping_id = null;
  }
  return shipment;
});

/* ------------------------------------------------------------------ */
/* designer / production queue                                         */
/* ------------------------------------------------------------------ */

on("GET", "/production/orders", ({ query }) => {
  const perPage = 24;
  const { DEPOSITED, PRODUCTION } = ORDER_STATUS;
  const countStatus = (status) =>
    db.orders.filter((o) => o.status === status).length;
  const rows = db.orders
    .filter(
      (o) =>
        String(o.status) === String(query.status ?? DEPOSITED) &&
        orderMatchesSearch(o, query.search),
    )
    .sort((a, b) => a.order_time.localeCompare(b.order_time)); // oldest first: it's a work queue

  return {
    orders: page(rows, Number(query.page) || 1, perPage).map((o) => ({
      id: o.id,
      status: o.status,
      order_time: o.order_time,
      full_name: o.full_name,
      product_name: productOf(o)?.name ?? null,
      item_count: o.cards.length,
      group_name: o.group_name,
      item_colors: o.cards.map((c) => c.color).join(","),
      song: o.song,
    })),
    counts: {
      deposited: countStatus(DEPOSITED),
      production: countStatus(PRODUCTION),
    },
    total: rows.length,
    per_page: perPage,
  };
});

on("GET", "/production/orders/:id", ({ params }) => {
  const order = findOrder(params.id);
  return {
    order: {
      id: order.id,
      status: order.status,
      order_time: order.order_time,
      full_name: order.full_name,
      phone: order.phone,
      product_name: productOf(order)?.name ?? null,
      group_name: order.group_name,
      date: order.date,
      addr: order.addr,
      song: order.song,
      notes: order.notes,
    },
    items: order.cards,
    notes: noteRows(order),
  };
});

on("POST", "/production/orders/:id/status", ({ params }) => {
  const order = findOrder(params.id);
  if (order.status !== ORDER_STATUS.DEPOSITED)
    throw conflict("Only deposited orders can move to production");
  order.status = ORDER_STATUS.PRODUCTION;
  return { id: order.id, status: order.status };
});

/* ------------------------------------------------------------------ */
/* finance                                                             */
/* ------------------------------------------------------------------ */

// Registered before /finance/:section so the literal paths win.
// format=csv: every matching order (not one page) as a file download.
on("GET", "/finance/orders", ({ query }) =>
  query.format === "csv"
    ? new Response(toCsv(financeOrderRows(query)), {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      })
    : financeOrders(query),
);

on("GET", "/finance/:section", ({ params, query }) => {
  const report = financeSection(params.section, query);
  if (!report) throw notFound("Finance section");
  return report;
});

on("POST", "/finance/costs", ({ body }) => {
  const product = findOr404(db.products, body.productId, "Product");
  product.unit_cost = body.unitCost;
  return { productId: product.id, unitCost: product.unit_cost };
});

on("POST", "/finance/entries", ({ body }) => {
  if (body.orderId) findOrder(body.orderId);
  const entry = {
    id: nextId(),
    type: body.type,
    value: body.value,
    description: body.description,
    order_id: body.orderId ?? null,
    created_at: nowIso(),
  };
  db.ledger.push(entry);
  return entry;
});

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

const findProduct = (id) => findOr404(db.products, id, "Product");

on("GET", "/products", () => db.products);

on("DELETE", "/products/colors/:id", ({ params }) => {
  const colorId = Number(params.id);
  const product = db.products.find((p) =>
    p.colors.some((c) => c.id === colorId),
  );
  if (!product) throw notFound("Color");
  product.colors = product.colors.filter((c) => c.id !== colorId);
  product.product_images = product.product_images.filter(
    (i) => i.color_id !== colorId,
  );
  return { deleted: true };
});

on("DELETE", "/products/images/:id", ({ params }) => {
  const imageId = Number(params.id);
  const product = db.products.find((p) =>
    p.product_images.some((i) => i.id === imageId),
  );
  if (!product) throw notFound("Image");
  product.product_images = product.product_images.filter(
    (i) => i.id !== imageId,
  );
  return { deleted: true };
});

on("DELETE", "/products/card-price-tiers/:id", ({ params }) => {
  const tierId = Number(params.id);
  const product = db.products.find((p) =>
    p.card_price_tiers.some((t) => t.id === tierId),
  );
  if (!product) throw notFound("Price tier");
  product.card_price_tiers = product.card_price_tiers.filter(
    (t) => t.id !== tierId,
  );
  return { deleted: true };
});

on("GET", "/products/:id", ({ params }) => findProduct(params.id));

// The shop shows every design's description next to it.
function requireDescription(description) {
  if (!String(description ?? "").trim())
    throw new MockError(
      422,
      "A description is required — the shop shows it with the design",
    );
}

on("POST", "/products", ({ body }) => {
  if (db.products.some((p) => p.slug === body.slug))
    throw conflict("A design with this slug already exists");
  requireDescription(body.description);
  const product = {
    id: nextId(),
    name: body.name,
    slug: body.slug,
    description: body.description,
    product_types: { code: body.typeCode, name: "NFC card" },
    is_active: true,
    in_stock: body.inStock ?? true,
    is_new: Boolean(body.isNew),
    is_limited: Boolean(body.isLimited),
    quantity: body.quantity ?? 0,
    unit_cost: null,
    colors: [],
    product_images: [],
    card_price_tiers: [],
  };
  db.products.push(product);
  return product;
});

on("PATCH", "/products/:id", ({ params, body }) => {
  const product = findProduct(params.id);
  if ("description" in body) requireDescription(body.description);
  Object.assign(product, {
    name: body.name,
    description: body.description,
    is_new: body.isNew,
    in_stock: body.inStock,
    is_limited: body.isLimited,
    quantity: body.quantity,
  });
  return product;
});

on("POST", "/products/:id/toggle", ({ params, body }) => {
  const product = findProduct(params.id);
  product.is_active = body.isActive;
  return product;
});

on("POST", "/products/:id/colors", ({ params, body }) => {
  const color = { id: nextId(), name: body.name, hex: body.hex };
  findProduct(params.id).colors.push(color);
  return color;
});

on("POST", "/products/:id/images/upload", ({ params, body }) => {
  const product = findProduct(params.id);
  const colorId = body.get("colorId") ? Number(body.get("colorId")) : null;
  const kind = body.get("kind");
  const image = {
    id: nextId(),
    image_url: URL.createObjectURL(body.get("file")),
    kind,
    color_id: colorId,
    sort_order: Number(body.get("sortOrder")) || 0,
  };
  // Each slot holds one image, so an upload replaces whatever was there.
  product.product_images = [
    ...product.product_images.filter(
      (i) => !(i.kind === kind && i.color_id === colorId),
    ),
    image,
  ];
  return image;
});

on("POST", "/products/:id/card-price-tiers", ({ params, body }) => {
  const product = findProduct(params.id);
  const tier = {
    id: nextId(),
    cards_count: body.cardsCount,
    price: body.price,
    discount_percentage: body.discountPercentage ?? null,
  };
  product.card_price_tiers = [
    ...product.card_price_tiers.filter(
      (t) => t.cards_count !== tier.cards_count,
    ),
    tier,
  ].sort((a, b) => a.cards_count - b.cards_count);
  return tier;
});

/* ------------------------------------------------------------------ */
/* coupons                                                             */
/* ------------------------------------------------------------------ */

const findCoupon = (id) => findOr404(db.coupons, id, "Coupon");

const couponFields = (body) => ({
  type: body.type,
  value: body.value,
  expiry_date: body.expiryDate,
  min_order_amount: body.minOrderAmount ?? null,
  max_uses: body.maxUses ?? null,
  per_customer_limit: body.perCustomerLimit ?? null,
});

on("GET", "/coupons", () => db.coupons);

on("POST", "/coupons", ({ body }) => {
  if (db.coupons.some((c) => c.coupon === body.coupon))
    throw conflict("Coupon code already exists");
  const coupon = {
    id: nextId(),
    coupon: body.coupon,
    is_active: true,
    ...couponFields(body),
  };
  db.coupons.push(coupon);
  return coupon;
});

on("PATCH", "/coupons/:id", ({ params, body }) =>
  Object.assign(findCoupon(params.id), couponFields(body)),
);

on("POST", "/coupons/:id/toggle", ({ params, body }) => {
  const coupon = findCoupon(params.id);
  coupon.is_active = body.isActive;
  return coupon;
});

on("DELETE", "/coupons/:id", ({ params }) => {
  const coupon = findCoupon(params.id);
  if (db.orders.some((o) => o.coupon === coupon.coupon)) {
    throw conflict(
      "This coupon has been used on real orders — disable it instead of deleting it",
    );
  }
  removeFrom(db.coupons, coupon);
  return { deleted: true };
});

/* ------------------------------------------------------------------ */
/* customers                                                           */
/* ------------------------------------------------------------------ */

const findUser = (id) => findOr404(db.users, id, "Customer");

on("GET", "/customers/lookup", ({ query }) => {
  const user = db.users.find((u) => u.username === query.username);
  if (!user) return { found: false };
  if (!user.pid)
    return { found: true, userId: user.id, link: null, themes: [] };
  return {
    found: true,
    userId: user.id,
    link: profileLink(user.pid),
    themes: themeStatuses(user),
  };
});

on("POST", "/customers", ({ body }) => {
  if (db.users.some((u) => u.username === body.username))
    throw conflict("Username already taken");
  const pid = `p-custom-${nextId()}`;
  const user = {
    id: nextId(),
    username: body.username,
    name: body.name ?? "",
    friends_count: body.friendsCount,
    is_blocked: false,
    pid,
    theme_ids: [],
    created_at: nowIso(),
  };
  db.users.push(user);
  return { username: user.username, userId: user.id, link: profileLink(pid) };
});

on("POST", "/customers/:id/password-reset", ({ params }) => {
  findUser(params.id);
  return { reset: true };
});

/* ------------------------------------------------------------------ */
/* roles + team + activity                                             */
/* ------------------------------------------------------------------ */

const findEditableRole = (id, action) => {
  const role = findOr404(db.roles, id, "Role");
  if (role.isSystem)
    throw new MockError(403, `The Super Admin role cannot be ${action}`);
  return role;
};

const teamRow = (staff) => ({
  ...publicAdmin(staff),
  isBlocked: staff.isBlocked,
});

on("GET", "/roles", () => ({
  roles: db.roles.map((role) => ({
    ...role,
    userCount: db.staff.filter((s) => s.role === role.code).length,
  })),
  permissionCatalog: db.permissionCatalog,
}));

on("POST", "/roles", ({ body }) => {
  if (db.roles.some((r) => r.code === body.code))
    throw conflict("Role code already in use");
  const role = {
    id: nextId(),
    code: body.code,
    name: body.name,
    description: body.description ?? null,
    isSystem: false,
    permissions: body.permissionCodes,
  };
  db.roles.push(role);
  return role;
});

on("PATCH", "/roles/:id", ({ params, body }) =>
  Object.assign(findEditableRole(params.id, "edited"), {
    name: body.name,
    description: body.description ?? null,
    permissions: body.permissionCodes,
  }),
);

on("DELETE", "/roles/:id", ({ params }) => {
  const role = findEditableRole(params.id, "deleted");
  if (db.staff.some((s) => s.role === role.code))
    throw conflict("Reassign staff off this role before deleting it");
  removeFrom(db.roles, role);
  return { deleted: true };
});

const findStaff = (id) => findOr404(db.staff, id, "Admin");

on("GET", "/team", () => db.staff.map(teamRow));

on("POST", "/team", ({ body }) => {
  if (db.staff.some((s) => s.username === body.username))
    throw conflict("Username already taken");
  if (db.staff.some((s) => s.email === body.email))
    throw conflict("Email already registered");
  const staff = {
    id: `adm-${nextId()}`,
    username: body.username,
    displayName: null,
    email: body.email,
    role: body.roleCode,
    isBlocked: false,
  };
  db.staff.push(staff);
  return teamRow(staff);
});

on("POST", "/team/:id/toggle", ({ params, body }) => {
  const staff = findStaff(params.id);
  if (staff.id === currentStaff().id)
    throw new MockError(422, "Cannot block your own account");
  staff.isBlocked = body.isBlocked;
  return teamRow(staff);
});

on("POST", "/team/:id/role", ({ params, body }) => {
  const staff = findStaff(params.id);
  staff.role = body.roleCode;
  return teamRow(staff);
});

on("GET", "/activity", ({ query }) => {
  const rows = db.activity.filter(
    (a) => !query.adminId || a.adminId === query.adminId,
  );
  return {
    rows: page(rows, Number(query.page) || 1, 30).map((row) => {
      const staff = db.staff.find((s) => s.id === row.adminId);
      return {
        ...row,
        adminUsername: staff?.username,
        adminDisplayName: staff?.displayName,
      };
    }),
    total: rows.length,
  };
});

/* ------------------------------------------------------------------ */
/* themes                                                              */
/* ------------------------------------------------------------------ */

on("GET", "/themes", () => ({
  custom: db.customThemes.map((theme) => ({
    ...theme,
    owners: db.users.filter((u) => u.theme_ids.includes(theme.id)).length,
  })),
  site: db.siteThemes,
}));

on("POST", "/themes/custom", ({ body }) => {
  const fields = {
    theme: body.theme,
    bg_color: body.bgColor,
    preview_link: body.previewLink || null,
    price: body.price,
    is_new: body.isNew,
    is_active: body.isActive,
  };
  if (body.id)
    return Object.assign(findOr404(db.customThemes, body.id, "Theme"), fields);
  const theme = { id: nextId(), ...fields };
  db.customThemes.push(theme);
  return theme;
});

on("POST", "/themes/custom/:id/toggle", ({ params, body }) => {
  const theme = findOr404(db.customThemes, params.id, "Theme");
  theme.is_active = body.isActive;
  return theme;
});

on("POST", "/themes/assign", ({ body }) => {
  const user = db.users.find((u) => u.username === body.username);
  if (!user) throw notFound("Customer");
  user.theme_ids = user.theme_ids.filter((id) => id !== body.themeId);
  if (body.action === "assign") user.theme_ids.push(body.themeId);
  return { themes: themeStatuses(user) };
});

on("POST", "/themes/site", ({ body }) => {
  if (db.siteThemes.some((t) => t.name === body.name))
    throw conflict("A site theme with this name already exists");
  const theme = {
    id: nextId(),
    name: body.name,
    display_name: body.displayName,
    bg_color: body.bgColor,
    text_color: body.textColor,
    accent_color: body.accentColor,
    is_active: true,
  };
  db.siteThemes.push(theme);
  return theme;
});

on("POST", "/themes/site/:id/toggle", ({ params, body }) => {
  const theme = findOr404(db.siteThemes, params.id, "Site theme");
  theme.is_active = body.isActive;
  return theme;
});

on("DELETE", "/themes/site/:id", ({ params }) => {
  removeFrom(db.siteThemes, findOr404(db.siteThemes, params.id, "Site theme"));
  return { deleted: true };
});

/* ------------------------------------------------------------------ */
/* own-account settings                                                */
/* ------------------------------------------------------------------ */

function settingsUser(staff) {
  const role = roleOf(staff);
  return {
    id: staff.id,
    username: staff.username,
    email: staff.email,
    display_name: staff.displayName,
    phone_number: null,
    admin_roles: {
      code: role?.code ?? staff.role,
      name: role?.name ?? staff.role,
    },
  };
}

on("GET", "/settings/me", () => ({ user: settingsUser(currentStaff()) }));

on("GET", "/settings/sessions", () => ({ sessions: db.sessions }));

on("POST", "/settings/sessions/:id/revoke", ({ params }) => {
  const session = findOr404(db.sessions, params.id, "Session");
  removeFrom(db.sessions, session);
  if (session.current) setSessionUsername("");
  return { revoked: true };
});

on("POST", "/settings/profile", ({ body }) => {
  const staff = currentStaff();
  staff.displayName = body.displayName;
  return { user: settingsUser(staff) };
});

on("POST", "/settings/password", () => ({ changed: true }));

on("POST", "/settings/email/request", () => ({ sent: true }));

// No email goes out, so any 6-digit code is accepted.
on("POST", "/settings/email/confirm", ({ body }) => {
  const staff = currentStaff();
  staff.email = body.newEmail;
  return { user: settingsUser(staff) };
});
