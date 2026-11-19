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
  addProfile,
  frontImageOf,
  itemsOf,
  newestFirst,
  newItemCode,
  newNfcItem,
  nextId,
  setHolder,
  nowIso,
  ORDER_STATUS,
  orderMatchesSearch,
  paidOf,
  productNames,
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
const NFC_LINK_BASE_URL = "https://zoser.example/i";

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

// Adds a row to the staff activity log (Team > Activity feed), newest first:
// who did what to which record, from where. A backend writes one for every
// change; `details` keeps what a delete removed, so it can still be read.
function logActivity(action, entityType, entityId, details = null) {
  db.activity.unshift({
    id: nextId(),
    adminId: currentStaff().id,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    details,
    ipAddress: db.sessions.find((s) => s.current)?.ip ?? null,
    createdAt: nowIso(),
  });
}

const publicAdmin = (staff) => ({
  id: staff.id,
  username: staff.username,
  email: staff.email,
  displayName: staff.displayName,
  role: staff.role,
  roleName: roleOf(staff)?.name ?? staff.role,
});

const withPermissions = (staff) => ({
  ...publicAdmin(staff),
  permissions: roleOf(staff)?.permissions ?? [],
});

on("GET", "/auth/me", () => {
  const staff = currentStaff();
  return { admin: staff ? withPermissions(staff) : null };
});

// Like the API: a new access token while "signed in" (the session kept in localStorage
// stands for the refresh cookie), or nulls
on("POST", "/auth/refresh", () => {
  const staff = currentStaff();
  return staff
    ? { accessToken: "dummy-access-token", admin: withPermissions(staff) }
    : { accessToken: null, admin: null };
});

on("POST", "/auth/login", ({ body }) => {
  const staff =
    db.staff.find((s) => s.username === body.username) ??
    db.staff.find((s) => s.username === DEFAULT_USERNAME);
  if (staff.isBlocked)
    throw new MockError(403, "This account has been deactivated");
  setSessionUsername(staff.username);
  return { admin: withPermissions(staff), accessToken: "dummy-access-token" };
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
  cities: db.cities.map(({ id, name, zones }) => ({
    id,
    name,
    zones: zones.map((z) => ({ id: z.id, name: z.name })),
  })),
}));

/* ------------------------------------------------------------------ */
/* orders + shipments                                                  */
/* ------------------------------------------------------------------ */

const findOrder = (id) => findOr404(db.orders, id, "Order");
const newestOrderFirst = (a, b) => b.order_time.localeCompare(a.order_time);
const profileLink = (pid) => `${PROFILE_BASE_URL}/${pid}`;
const findLine = (order, id) => findOr404(order.lines, id, "Order item");

// `holder` is a customer account or a shared profile: both keep theme_ids.
const themeStatuses = (holder) =>
  db.customThemes
    .filter((t) => t.is_active)
    .map((t) => ({
      theme_id: t.id,
      theme: t.theme,
      status: holder.theme_ids.includes(t.id) ? "owned" : "available",
    }));

const lineKind = (line) =>
  productOf(line)?.product_types.code === "KEYCHAIN" ? "keychain" : "card";

const lineRow = (line) => ({
  ...line,
  product_name: productOf(line)?.name ?? null,
  kind: lineKind(line),
});

const userRow = (id) => {
  const user = db.users.find((u) => u.id === id);
  return user
    ? { id: user.id, username: user.username, name: user.name }
    : null;
};

// How often an item opened its page: by the page's members, by visitors, and when last
function opensOf(item) {
  const opens = db.opens.filter((open) => open.item_id === item.id);
  return {
    total: opens.length,
    members: opens.filter((open) => open.user_id != null).length,
    visitors: opens.filter((open) => open.user_id == null).length,
    last_at:
      opens.reduce((last, open) => (open.at > last ? open.at : last), "") ||
      null,
  };
}

function nfcItemRow(item) {
  const offBy = item.turned_off_by;
  return {
    id: item.id,
    label: item.label,
    kind: item.kind,
    is_extra: !item.card_id,
    link: `${NFC_LINK_BASE_URL}/${item.code}`,
    status: item.status,
    turned_off_by:
      offBy === "staff" ? "staff" : (userRow(offBy)?.username ?? null),
    turned_off_at: item.turned_off_at,
    holder: userRow(item.holder_user_id),
    holder_how: item.holder_how,
    holder_at: item.holder_at,
    opens: opensOf(item),
    created_at: item.created_at,
  };
}

// A page in the API's shape (backend admin/profiles.ts profileRow): its people (each a
// place named at checkout, joined or still waiting), its items (whose, and who claimed
// them), opens and themes. The dummy pages keep their older model underneath; this is
// read-only here: the dummy API doesn't act on people or items
function profileRow(profile) {
  const members = profile.member_ids.map((id) => userRow(id)).filter(Boolean);
  const people = [
    ...members.map((user, i) => ({
      id: profile.id * 100 + i,
      role: "person",
      state: "active",
      display_name: profile.names[i] ?? user.name ?? user.username,
      checkout_name: profile.names[i] ?? user.name ?? user.username,
      position: i,
      origin: "order",
      account: user,
      claimed_at: profile.joined_at[user.id] ?? null,
      hold_expires_at: null,
      has_voice: false,
      user_id: user.id,
    })),
    ...profile.names.slice(members.length).map((name, i) => ({
      id: profile.id * 100 + members.length + i,
      role: "person",
      state: "pending",
      display_name: name,
      checkout_name: name,
      position: members.length + i,
      origin: "order",
      account: null,
      claimed_at: null,
      hold_expires_at: null,
      has_voice: false,
      user_id: null,
    })),
  ];
  const names = people.map((p) => p.display_name);
  const items = db.nfcItems
    .filter((item) => item.profile_id === profile.id)
    .map((item) => {
      const row = nfcItemRow(item);
      const person =
        people.find((p) => p.user_id && p.user_id === item.holder_user_id) ??
        people.find((p) => p.display_name === item.label) ??
        null;
      return {
        id: row.id,
        code: item.code,
        link: row.link,
        kind: row.kind,
        label: row.label,
        state: row.status === "on" ? "active" : "off",
        order_id: profile.order_id,
        assigned_participant_id: person?.id ?? null,
        assigned_to: person?.display_name ?? null,
        owner: row.holder,
        claimed_at: row.holder_at,
        programmed_at: row.created_at,
        replaced_by_id: null,
        turned_off_by: row.turned_off_by,
        turned_off_at: row.turned_off_at,
        opens: row.opens,
        created_at: row.created_at,
      };
    });
  return {
    id: profile.id,
    public_id: profile.pid,
    type: profile.seats > 2 ? "friends" : "couple",
    state:
      profile.state === "closed"
        ? "closed"
        : members.length
          ? "live"
          : "waiting",
    since: profile.since,
    theme: "rose",
    order_ids: profile.order_id ? [profile.order_id] : [],
    legacy: profile.legacy,
    legacy_uid: profile.legacy ? profile.pid : null,
    merged_into_id: null,
    names: [names.slice(0, -1).join(", "), names.at(-1)]
      .filter(Boolean)
      .join(" & "),
    has_pin: Boolean(profile.pin),
    created_at: profile.created_at,
    first_claim_at: profile.claimed_at,
    participants: people.map((p) => {
      const copy = { ...p };
      delete copy.user_id;
      return copy;
    }),
    items,
    themes: themeStatuses(profile),
    claim_log: [],
  };
}

const profilesOf = (order) =>
  db.profiles.filter((p) => p.order_id === order.id).map(profileRow);

// An NFC item, with its page and (for a page from an order) the order
function findNfcItem(id) {
  const item = findOr404(db.nfcItems, id, "NFC item");
  const profile = db.profiles.find((p) => p.id === item.profile_id);
  return { item, profile, entityId: profile.order_id ?? profile.pid };
}

const itemName = (item) =>
  item.label ? `${item.label}'s ${item.kind}` : `Unnamed ${item.kind}`;

// Activity on a page goes on its order (or, for an old-system page, the page itself)
const logPage = (action, profile, details) =>
  profile.order_id
    ? logActivity(action, "order", profile.order_id, details)
    : logActivity(action, "profile", profile.pid, details);

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
      product_name: productNames(o),
      item_count: itemsOf(o).length,
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
      product_name: productNames(order),
      // The dummy pages' items count as the chips' codes
      provisioned_at: db.nfcItems.some((item) =>
        db.profiles.some(
          (p) => p.id === item.profile_id && p.order_id === order.id,
        ),
      )
        ? order.order_time
        : null,
    },
    lines: order.lines.map(lineRow),
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
    edit_extras: db.extraOptions,
    profiles: profilesOf(order),
  };
});

on("POST", "/orders/:id/deposits", ({ params, body }) => {
  const order = findOrder(params.id);
  const value = Number(body.value);
  if (!(value > 0)) throw new MockError(422, "Deposit value must be positive");
  const entry = {
    id: nextId(),
    type: "deposit",
    category: "Order deposit",
    order_id: order.id,
    value,
    description: `${order.full_name} Deposit`,
    created_at: nowIso(),
  };
  db.ledger.push(entry);
  // The first deposit on a Pending order makes it Deposited
  if (order.status === 0) order.status = 1;
  return { ...entry, order_status: order.status };
});

// The API's rules: staff move one step forward, or cancel while Pending or Deposited;
// the Super Admin sets any status, with a reason for anything else
const FORWARD = { 0: 1, 1: 5, 5: 2, 2: 4 };
const setStatus = (order, to, reason) => {
  if (order.status === to) return;
  const normal =
    FORWARD[order.status] === to || (to === 3 && [0, 1].includes(order.status));
  if (!normal) {
    if (currentStaff().role !== "SUPER_ADMIN")
      throw new MockError(
        409,
        to === 3
          ? "Only Pending or Deposited orders can be cancelled. Ask a Super Admin to cancel it."
          : "Move the order one step at a time (Pending → Deposited → Production → Shipped → Shipped + Paid). A Super Admin can make other changes.",
      );
    if (!reason?.trim())
      throw new MockError(422, "Say why you're changing the status this way");
  }
  order.status = to;
};

on("POST", "/orders/:id/status", ({ params, body }) => {
  const order = findOrder(params.id);
  setStatus(order, Number(body.status), body.reason);
  return { id: order.id, status: order.status };
});

// The note's text, plus how many images it had, for the activity log.
const noteSummary = (note) => {
  const count = note.images.length;
  return count
    ? `${note.edits}\n(${count} attachment${count === 1 ? "" : "s"})`
    : note.edits;
};

on("POST", "/orders/:id/notes", ({ params, body }) => {
  const order = findOrder(params.id);
  const note = {
    id: nextId(),
    edits: body.get("edits"),
    created_at: nowIso(),
    images: body
      .getAll("photos")
      .map((file) => ({ image_url: URL.createObjectURL(file) })),
  };
  order.production_notes.push(note);
  logActivity("order.note_added", "order", order.id, noteSummary(note));
  return note;
});

on("DELETE", "/orders/:id/notes/:noteId", ({ params }) => {
  const order = findOrder(params.id);
  const note = findOr404(order.production_notes, params.noteId, "Note");
  removeFrom(order.production_notes, note);
  for (const { image_url } of note.images)
    if (image_url.startsWith("blob:")) URL.revokeObjectURL(image_url);
  logActivity("order.note_deleted", "order", order.id, noteSummary(note));
  return { deleted: true };
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

// Multipart: `design` holds the fields as JSON, and `image_<cardId>` a new
// picture for that card, so the text and images save together or not at all.
on("POST", "/orders/:id/lines/:lineId/design", ({ params, body }) => {
  const order = findOrder(params.id);
  const line = findLine(order, params.lineId);
  const design = JSON.parse(body.get("design"));
  const productChanged =
    design.productId && design.productId !== line.product_id;
  if (design.productId) line.product_id = design.productId;
  if (design.price !== undefined) line.price = design.price;
  // The modal leaves out fields it has blanked, so a missing field means cleared.
  line.group_name = design.groupName ?? null;
  line.date = design.date ?? null;
  line.addr = design.addr ?? null;
  line.song = design.song ?? null;
  line.notes = design.notes ?? null;
  const product = productOf(line);
  for (const { id, name, color } of design.items ?? []) {
    const card = line.items.find((c) => c.id === id);
    if (!card) continue;
    const colorChanged = productChanged || card.color !== color;
    card.name = name;
    card.color = color;
    const match = product?.colors.find((c) => c.name === color);
    if (match) card.color_hex = match.hex;
    // A new color or design brings its picture; an uploaded one beats that.
    // Saving with neither changed keeps whatever picture the card has.
    const upload = body.get(`image_${id}`);
    const nextImage = upload
      ? URL.createObjectURL(upload)
      : match && colorChanged
        ? frontImageOf(product, match)
        : null;
    if (nextImage) {
      if (card.full_image_url?.startsWith("blob:"))
        URL.revokeObjectURL(card.full_image_url);
      card.full_image_url = nextImage;
    }
  }
  recalcTotals(order);
  return { id: order.id };
});

// An add-on's name and price from a request, checked, or a 422/409 thrown.
function readExtra(line, body, editing = null) {
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  if (!name) throw new MockError(422, "Enter the add-on's name");
  if (body.price === "" || !(price >= 0))
    throw new MockError(422, "Enter a price of 0 or more");
  const taken = line.extras.some(
    (x) => x !== editing && x.extra_name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) throw conflict(`This item already has ${name}`);
  return { extra_name: name, extra_price: price };
}

on("POST", "/orders/:id/lines/:lineId/extras", ({ params, body }) => {
  const order = findOrder(params.id);
  const line = findLine(order, params.lineId);
  const extra = { id: nextId(), ...readExtra(line, body) };
  line.extras.push(extra);
  recalcTotals(order);
  logActivity(
    "order.extra_added",
    "order",
    order.id,
    `${extra.extra_name}: ${extra.extra_price} EGP`,
  );
  return extra;
});

on("PATCH", "/orders/:id/lines/:lineId/extras/:extraId", ({ params, body }) => {
  const order = findOrder(params.id);
  const line = findLine(order, params.lineId);
  const extra = findOr404(line.extras, params.extraId, "Add-on");
  const before = `${extra.extra_name}: ${extra.extra_price} EGP`;
  Object.assign(extra, readExtra(line, body, extra));
  recalcTotals(order);
  logActivity(
    "order.extra_updated",
    "order",
    order.id,
    `${before} → ${extra.extra_name}: ${extra.extra_price} EGP`,
  );
  return extra;
});

on("DELETE", "/orders/:id/lines/:lineId/extras/:extraId", ({ params }) => {
  const order = findOrder(params.id);
  const line = findLine(order, params.lineId);
  const extra = findOr404(line.extras, params.extraId, "Add-on");
  removeFrom(line.extras, extra);
  recalcTotals(order);
  logActivity(
    "order.extra_removed",
    "order",
    order.id,
    `${extra.extra_name}: ${extra.extra_price} EGP`,
  );
  return { deleted: true };
});

// One page for the order, and one link per physical item in it (db.js addProfile)
on("POST", "/orders/:id/profile", ({ params }) => {
  const order = findOrder(params.id);
  if (db.profiles.some((p) => p.order_id === order.id))
    throw conflict("This order already has its page");
  const { profile, items } = addProfile(order, nowIso());
  logActivity(
    "order.page_created",
    "order",
    order.id,
    `${items.length} link${items.length === 1 ? "" : "s"}`,
  );
  return { profiles: [profileRow(profile)] };
});

const findProfile = (id) => findOr404(db.profiles, id, "Page");

on("POST", "/profiles/:id/items", ({ params, body }) => {
  const profile = findProfile(params.id);
  const label = String(body.label ?? "").trim();
  if (!label) throw new MockError(422, "Enter the name on the new item");
  const kind = body.kind ?? "card";
  if (!["card", "keychain", "necklace", "bracelet"].includes(kind))
    throw new MockError(422, "Unknown kind of item");
  const item = newNfcItem(profile.id, null, kind, label, nowIso());
  logPage("nfc_item.added", profile, itemName(item));
  return nfcItemRow(item);
});

// How many people the page is for: never fewer than are in it
on("POST", "/profiles/:id/seats", ({ params, body }) => {
  const profile = findProfile(params.id);
  const seats = Number(body.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 20)
    throw new MockError(422, "Seats must be between 1 and 20");
  if (seats < profile.member_ids.length)
    throw new MockError(422, "There are more members than that");
  profile.seats = seats;
  logPage("page.seats_changed", profile, String(seats));
  return profileRow(profile);
});

// Takes a member out (a dispute, an account given away): the items they had are
// nobody's. With nobody left, the page closes
on("DELETE", "/profiles/:id/members/:userId", ({ params }) => {
  const profile = findProfile(params.id);
  const userId = Number(params.userId);
  if (!profile.member_ids.includes(userId)) throw notFound("Member");
  profile.member_ids = profile.member_ids.filter((id) => id !== userId);
  delete profile.joined_at[userId];
  for (const item of db.nfcItems)
    if (item.profile_id === profile.id && item.holder_user_id === userId)
      setHolder(item, null);
  if (!profile.member_ids.length) profile.state = "closed";
  logPage("page.member_removed", profile, userRow(userId)?.username);
  return profileRow(profile);
});

// The wrong person set it up (a courier, a relative who opened the box): no members,
// no holders, no requests; the next tap of any of its items sets it up again
on("POST", "/profiles/:id/reset", ({ params }) => {
  const profile = findProfile(params.id);
  profile.member_ids = [];
  profile.joined_at = {};
  profile.requests = [];
  profile.claimed_at = null;
  profile.state = "ready";
  for (const item of db.nfcItems)
    if (item.profile_id === profile.id) setHolder(item, null);
  logPage("page.setup_reset", profile);
  return profileRow(profile);
});

// A closed page (everyone left) opens again for its items; with no members, the next
// tap sets it up
on("POST", "/profiles/:id/reopen", ({ params }) => {
  const profile = findProfile(params.id);
  profile.state = "ready";
  logPage("page.reopened", profile);
  return profileRow(profile);
});

// A forgotten visitor PIN
on("DELETE", "/profiles/:id/pin", ({ params }) => {
  const profile = findProfile(params.id);
  if (!profile.pin) throw conflict("This page has no PIN");
  profile.pin = null;
  logPage("page.pin_cleared", profile);
  return profileRow(profile);
});

// "on", or "off": its link says it's turned off; the page and its other items go on
on("POST", "/nfc-items/:id/status", ({ params, body }) => {
  const { item, profile } = findNfcItem(params.id);
  if (!["on", "off"].includes(body.status))
    throw new MockError(422, "Status must be on or off");
  item.status = body.status;
  item.turned_off_by = body.status === "off" ? "staff" : null;
  item.turned_off_at = body.status === "off" ? nowIso() : null;
  logPage(
    body.status === "off" ? "nfc_item.turned_off" : "nfc_item.turned_on",
    profile,
    itemName(item),
  );
  return nfcItemRow(item);
});

// Who has it: one of the page's members, or nobody. Only to know who has which item
on("POST", "/nfc-items/:id/holder", ({ params, body }) => {
  const { item, profile } = findNfcItem(params.id);
  const userId = body.userId == null ? null : Number(body.userId);
  if (userId != null && !profile.member_ids.includes(userId))
    throw new MockError(422, "Only a member of the page can hold its items");
  setHolder(item, userRow(userId), "changed", nowIso());
  logPage("nfc_item.holder_changed", profile, itemName(item));
  return nfcItemRow(item);
});

// Its taps, newest first
on("GET", "/nfc-items/:id/opens", ({ params, query }) => {
  const { item } = findNfcItem(params.id);
  const rows = db.opens
    .filter((open) => open.item_id === item.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((open) => ({
      id: open.id,
      at: open.at,
      member: open.user_id != null,
      username: userRow(open.user_id)?.username ?? null,
      source: open.source,
    }));
  return { rows: page(rows, Number(query.page) || 1, 20), total: rows.length };
});

on("POST", "/nfc-items/:id/replace-link", ({ params }) => {
  const { item, profile } = findNfcItem(params.id);
  item.code = newItemCode();
  logPage("nfc_item.link_replaced", profile, itemName(item));
  return nfcItemRow(item);
});

on("DELETE", "/nfc-items/:id", ({ params }) => {
  const { item, profile } = findNfcItem(params.id);
  logPage("nfc_item.deleted", profile, itemName(item));
  removeFrom(db.nfcItems, item);
  return { deleted: true };
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
  shipment.status_at = nowIso();
  shipment.status_by = currentStaff().displayName ?? currentStaff().username;
  if (body.status === "returned" || body.status === "cancelled") {
    findOrder(shipment.order_id).shipping_id = null;
  }
  return shipment;
});

// The returned parcels, newest first (the API's GET /admin/returns)
on("GET", "/returns", ({ query }) => {
  const perPage = Math.min(100, Number(query.limit ?? query.per_page) || 25);
  const page = Math.max(1, Number(query.page) || 1);
  const term = String(query.search ?? "")
    .trim()
    .toLowerCase();
  const rows = db.shipments
    .filter((s) => s.status === "returned")
    .map((s) => ({ s, order: findOrder(s.order_id) }))
    .filter(
      ({ order }) =>
        !term ||
        String(order.id).includes(term.replace(/^#/, "")) ||
        order.full_name.toLowerCase().includes(term) ||
        String(order.phone).includes(term),
    )
    .sort((a, b) =>
      (b.s.status_at ?? b.s.created_at).localeCompare(
        a.s.status_at ?? a.s.created_at,
      ),
    );
  return {
    returns: rows
      .slice((page - 1) * perPage, page * perPage)
      .map(({ s, order }) => {
        const later = db.shipments.filter(
          (o) => o.order_id === s.order_id && o.id > s.id,
        );
        const city = db.cities.find((c) => c.id === order.city_id);
        return {
          shipment_id: s.id,
          carrier: s.carrier,
          tracking_no: s.tracking_no,
          cod_amount: s.cod_amount,
          notes: s.notes,
          returned_at: s.status_at ?? s.created_at,
          returned_by: s.status_by ?? null,
          reshipped:
            later.find((o) => o.status === "delivered")?.status ??
            later.find((o) => o.status === "active")?.status ??
            null,
          order: {
            id: order.id,
            public_ref: order.public_ref ?? null,
            full_name: order.full_name,
            phone: order.phone,
            status: order.status,
            grand_total: order.grand_total ?? null,
            city: city?.name ?? null,
            zone:
              city?.zones?.find((z) => z.id === order.zone_id)?.name ?? null,
          },
        };
      }),
    total: rows.length,
    per_page: perPage,
  };
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
      product_name: productNames(o),
      item_count: itemsOf(o).length,
      group_name: o.lines.find((l) => l.group_name)?.group_name ?? null,
      // Each color once, with its code, for the queue cards' color badges.
      colors: [
        ...new Map(
          itemsOf(o).map((c) => [c.color, { name: c.color, hex: c.color_hex }]),
        ).values(),
      ],
      song: o.lines.find((l) => l.song)?.song ?? null,
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
      product_name: productNames(order),
    },
    lines: order.lines.map(lineRow),
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
  if (!db.ledgerCategories[body.type]?.includes(body.category))
    throw new MockError(422, "Choose a category for this entry");
  if (body.orderId) findOrder(body.orderId);
  const entry = {
    id: nextId(),
    type: body.type,
    category: body.category,
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
    product_types: {
      code: body.typeCode,
      name: body.typeCode === "KEYCHAIN" ? "NFC keychain" : "NFC card",
    },
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

// A customer by username: their old-system profile link (pid) if they have one, and
// the pages they're in, with the items they hold in each
on("GET", "/customers/lookup", ({ query }) => {
  const user = db.users.find((u) => u.username === query.username);
  if (!user) return { found: false };
  const pages = db.profiles
    .filter((p) => p.member_ids.includes(user.id))
    .map((p) => ({
      id: p.id,
      pid: p.pid,
      order_id: p.order_id,
      names: p.names,
      legacy: p.legacy,
      holds: db.nfcItems
        .filter((i) => i.profile_id === p.id && i.holder_user_id === user.id)
        .map(itemName),
    }));
  return {
    found: true,
    userId: user.id,
    link: user.pid ? profileLink(user.pid) : null,
    themes: user.pid ? themeStatuses(user) : [],
    pages,
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
    owners: [...db.users, ...db.profiles].filter((holder) =>
      holder.theme_ids.includes(theme.id),
    ).length,
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
  // A shared order profile (profileId) or a customer account (username).
  const holder = body.profileId
    ? findOr404(db.profiles, body.profileId, "Profile")
    : db.users.find((u) => u.username === body.username);
  if (!holder) throw notFound("Customer");
  holder.theme_ids = holder.theme_ids.filter((id) => id !== body.themeId);
  if (body.action === "assign") holder.theme_ids.push(body.themeId);
  return { themes: themeStatuses(holder) };
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
