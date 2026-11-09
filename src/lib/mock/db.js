// In-memory data behind the dummy admin API (see ./index.js).
//
// Built from a fixed PRNG seed, so the same orders and customers come back on
// every reload, with dates relative to now so the "last 30 days" charts always
// have data. Writes change these objects and are lost on reload.
//
// Everything here is made up, and contact details are unroutable on purpose:
// @example.com emails, .example links, documentation-range IPs.

import { PERMISSIONS } from "../permissions.js";
import {
  CARD_DESIGNS,
  EXTRAS as SHOP_EXTRAS,
  KEYCHAIN,
  KEYCHAIN_DESIGNS,
  PRICE,
} from "./shop-catalog.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const ORDER_COUNT = 220;
const HISTORY_DAYS = 240;

export const ORDER_STATUS = {
  PENDING: 0,
  DEPOSITED: 1,
  SHIPPED: 2,
  CANCELLED: 3,
  SHIPPED_PAID: 4,
  PRODUCTION: 5,
};

/* ------------------------------------------------------------------ */
/* random + small helpers                                              */
/* ------------------------------------------------------------------ */

// mulberry32: small seedable PRNG (Math.random can't be seeded).
let prngState = 20260105;
function rand() {
  prngState = (prngState + 0x6d2b79f5) | 0;
  let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];
const chance = (probability) => rand() < probability;

let lastId = 0;
export const nextId = () => ++lastId;

export const nowIso = () => new Date().toISOString();
const isoAt = (ms) => new Date(Math.min(ms, Date.now())).toISOString();
const daysAgoIso = (days) => isoAt(Date.now() - days * DAY_MS);
const dateFromNow = (days) =>
  new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

export const round2 = (n) => Math.round(n * 100) / 100;
export const sum = (list, valueOf) =>
  round2(list.reduce((total, x) => total + Number(valueOf(x) || 0), 0));

/** Local stand-in for an uploaded photo, so nothing depends on an image host. */
export function placeholderImage(label, background = "#d9d4cc") {
  const channels = [1, 3, 5].map((i) =>
    parseInt(background.slice(i, i + 2), 16),
  );
  const luminance =
    (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) / 255;
  const text = String(label).replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" fill="${background}"/><text x="240" y="150" fill="${luminance > 0.55 ? "#1a1a19" : "#ffffff"}" font-family="sans-serif" font-size="34" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* roles + staff                                                       */
/* ------------------------------------------------------------------ */

// The dashboard owns the permission codes (../permissions.js); every role
// below is built only from them.
const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.code);

const ROLES = [
  [
    "SUPER_ADMIN",
    "Super Admin",
    "Full access to everything, manages staff accounts and roles",
    ALL_PERMISSIONS,
  ],
  [
    "OPERATIONS_MANAGER",
    "Operations Manager",
    "Runs day-to-day orders, shipping and production",
    [
      "dashboard.view",
      "orders.view",
      "orders.status.update",
      "orders.details.update",
      "orders.customer_info.update",
      "orders.shipment.create",
      "orders.shipment.status.update",
      "designer.view",
      "production.notes.add",
      "production.notes.delete",
      "customers.view",
      "users.view",
    ],
  ],
  [
    "ORDER_AGENT",
    "Order Agent",
    "Handles order status, customer details and shipments",
    [
      "orders.view",
      "orders.status.update",
      "orders.customer_info.update",
      "orders.shipment.create",
      "orders.shipment.status.update",
      "designer.view",
    ],
  ],
  [
    "FINANCE_MANAGER",
    "Finance Manager",
    "Finance reports, deposits, ledger entries, costs and coupons",
    [
      "dashboard.view",
      "orders.view",
      "finance.view",
      "finance.deposit.add",
      "finance.entry.add",
      "finance.costs.manage",
      "coupons.view",
      "coupons.manage",
    ],
  ],
  [
    "PRODUCTION_STAFF",
    "Production Staff",
    "Designs the cards and adds production notes",
    ["orders.view", "designer.view", "production.notes.add"],
  ],
  [
    "CATALOG_MANAGER",
    "Catalog Manager",
    "Designs, colors, prices and themes",
    [
      "products.view",
      "catalog.products.add",
      "catalog.products.update",
      "catalog.prices.update",
      "themes.view",
      "catalog.themes.manage",
    ],
  ],
  [
    "SUPPORT_AGENT",
    "Support Agent",
    "Customer accounts, passwords and profile themes",
    [
      "customers.view",
      "users.view",
      "users.password.reset",
      "themes.view",
      "profiles.themes.add",
    ],
  ],
  [
    "CARD_PROVISIONER",
    "Card Provisioner",
    "Creates customer accounts and order profiles",
    ["orders.view", "customers.view", "profiles.create"],
  ],
  [
    "MARKETING",
    "Marketing",
    "Read-only access to the dashboard",
    ["dashboard.view"],
  ],
].map(([code, name, description, permissions]) => ({
  id: nextId(),
  code,
  name,
  description,
  isSystem: code === "SUPER_ADMIN",
  permissions: [...permissions],
}));

const STAFF = [
  ["admin", "Admin", "SUPER_ADMIN"],
  ["mariam.ops", "Mariam Adel", "OPERATIONS_MANAGER"],
  ["omar.orders", "Omar Fathy", "ORDER_AGENT"],
  ["dina.finance", "Dina Saad", "FINANCE_MANAGER"],
  ["youssef.design", "Youssef Naguib", "PRODUCTION_STAFF"],
  ["hana.catalog", "Hana Mansour", "CATALOG_MANAGER"],
  ["karim.support", "Karim Helmy", "SUPPORT_AGENT"],
  ["nour.cards", "Nour Shawky", "CARD_PROVISIONER"],
  ["laila.marketing", "Laila Fawzy", "MARKETING", true],
].map(([username, displayName, role, isBlocked = false], i) => ({
  id: `adm-${i + 1}`,
  username,
  displayName,
  email: `${username}@example.com`,
  role,
  isBlocked,
}));

/* ------------------------------------------------------------------ */
/* geography                                                           */
/* ------------------------------------------------------------------ */

// Shipping is priced by zone: [zone, fee in EGP].
const CITIES = [
  [
    "Cairo",
    [
      ["Nasr City", 70],
      ["Maadi", 70],
      ["Heliopolis", 70],
      ["New Cairo", 80],
      ["Zamalek", 70],
    ],
  ],
  [
    "Giza",
    [
      ["Dokki", 70],
      ["Mohandessin", 70],
      ["Sheikh Zayed", 90],
      ["6th of October", 90],
    ],
  ],
  [
    "Alexandria",
    [
      ["Smouha", 85],
      ["Sidi Gaber", 85],
      ["Miami", 90],
      ["Gleem", 85],
    ],
  ],
  [
    "Mansoura",
    [
      ["Toriel", 100],
      ["El Mashaya", 100],
    ],
  ],
  [
    "Tanta",
    [
      ["El Galaa", 100],
      ["Seger", 105],
    ],
  ],
  ["Aswan", [["Downtown Aswan", 120]]],
].map(([name, zones]) => ({
  id: nextId(),
  name,
  zones: zones.map(([zone, shippingFee]) => ({
    id: nextId(),
    name: zone,
    shippingFee,
  })),
}));

/* ------------------------------------------------------------------ */
/* catalog                                                             */
/* ------------------------------------------------------------------ */

const cardImage = (file) =>
  new URL(`./images/cards/${file}.webp`, import.meta.url).href;
const keychainImage = (n) =>
  new URL(`./images/keychains/${n}.webp`, import.meta.url).href;

const CARD_TYPE = { code: "CARD", name: "NFC card" };
const KEYCHAIN_TYPE = { code: "KEYCHAIN", name: "NFC keychain" };

// Sold 2 to 10 at a time, at the shop's price per card or keychain.
const priceTiers = () =>
  Array.from({ length: 9 }, (_, i) => ({
    id: nextId(),
    cards_count: i + 2,
    price: (i + 2) * PRICE,
    discount_percentage: null,
  }));

// Dashboard-only facts the shop doesn't have: how often the seeded orders pick
// each design (0 = not sold yet) and a unit cost for the Profit tab (null =
// not set yet).
const SALES = {
  starrynight: [3, 95],
  fingerprint: [2, 90],
  evileye: [2, 90],
  graffiti: [2, 90],
  lovers: [4, 90],
  luv: [2, 90],
  memo: [3, null],
  passport: [2, 90],
  pixel: [0, 90],
  seniors: [2, null],
  sig: [4, 85],
  snowman: [1, 90],
  sprk: [2, 90],
  star: [5, 95],
  zebra: [3, 90],
  keychain: [4, 60],
  romantic: [0, null],
};

/** variants: [{ name, hex, front, back }] (image URLs or null). */
function catalogProduct({ slug, name, description, type, variants, isActive }) {
  const colors = variants.map((v) => ({
    id: nextId(),
    name: v.name,
    hex: v.hex,
  }));
  const images = variants.flatMap((v, i) =>
    [
      ["face", v.front],
      ["back", v.back],
    ]
      .filter(([, url]) => url)
      .map(([kind, url]) => ({
        id: nextId(),
        image_url: url,
        kind,
        color_id: colors[i].id,
        sort_order: 0,
      })),
  );
  // The shop lists a design with its first color's front picture.
  const cover = variants.find((v) => v.front)?.front;
  if (cover) {
    images.unshift({
      id: nextId(),
      image_url: cover,
      kind: "gallery",
      color_id: null,
      sort_order: 0,
    });
  }
  const [weight, cost] = SALES[slug];
  const product = {
    id: nextId(),
    name,
    slug,
    description,
    product_types: type,
    is_active: isActive,
    in_stock: true,
    is_new: false,
    is_limited: false,
    quantity: int(40, 400),
    unit_cost: cost,
    colors,
    product_images: images,
    card_price_tiers: priceTiers(),
  };
  for (let i = 0; i < weight; i++) orderWeightedProducts.push(product);
  return product;
}

const orderWeightedProducts = [];

const CATALOG = [
  ...CARD_DESIGNS.map((d) =>
    catalogProduct({
      slug: d.id,
      name: d.name,
      description: d.description,
      type: CARD_TYPE,
      isActive: true,
      variants: d.variants.map((v) => ({
        name: v.name,
        hex: v.hex,
        front: cardImage(`${v.file}_${v.key}`),
        back: cardImage(`${v.file}_back_${v.key}`),
      })),
    }),
  ),
  catalogProduct({
    slug: KEYCHAIN.id,
    name: KEYCHAIN.name,
    description: KEYCHAIN.description,
    type: KEYCHAIN_TYPE,
    isActive: true,
    variants: KEYCHAIN_DESIGNS.map((k) => ({
      name: k.name,
      hex: k.tint,
      front: keychainImage(k.image),
      back: null,
    })),
  }),
  // The shop keeps ROMANTIC switched off until it has a front picture; it's
  // here, inactive, as it would be in the dashboard.
  catalogProduct({
    slug: "romantic",
    name: "ROMANTIC",
    description: "",
    type: CARD_TYPE,
    isActive: false,
    variants: [
      {
        name: "Black",
        hex: "#1A1A1A",
        front: null,
        back: cardImage("romantic_back_black"),
      },
    ],
  }),
];

/** The front picture of one of a product's colors (what the card looks like). */
export const frontImageOf = (product, color) =>
  product?.product_images.find(
    (i) => i.kind === "face" && i.color_id === color?.id,
  )?.image_url ?? null;

const COUPONS = [
  ["WELCOME10", "percentage", 10, 60, null, null, 1, true],
  ["LOVE15", "percentage", 15, 30, 700, 200, null, true],
  ["FRIENDS100", "fixed", 100, 90, 1000, null, null, true],
  ["EID50", "fixed", 50, -20, null, 500, 1, true],
  ["VIP20", "percentage", 20, 10, null, 20, 1, false],
].map(
  ([
    coupon,
    type,
    value,
    expiresIn,
    min_order_amount,
    max_uses,
    per_customer_limit,
    is_active,
  ]) => ({
    id: nextId(),
    coupon,
    type,
    value,
    expiry_date: dateFromNow(expiresIn),
    min_order_amount,
    max_uses,
    per_customer_limit,
    is_active,
  }),
);

// VIP20 stays unused: the delete guard only lets you remove coupons with no orders.
const ORDER_COUPONS = COUPONS.filter((c) => c.coupon !== "VIP20");

const CUSTOM_THEMES = [
  ["Rose Gold", "#b76e79", 45, true],
  ["Midnight Blue", "#050a30", 30, true],
  ["Forest Mist", "#2f4f3e", 30, false],
  ["Sunset Peach", "#f4a582", 35, false],
  ["Monochrome", "#252525", 25, false],
  ["Retired Neon", "#39ff14", 20, false, false],
].map(([theme, bg_color, price, is_new, is_active = true]) => ({
  id: nextId(),
  theme,
  bg_color,
  price,
  is_new,
  is_active,
  preview_link: `https://zoser.example/themes/${theme.toLowerCase().replace(/\s+/g, "-")}`,
}));

const SITE_THEMES = [
  ["default", "Default", "#1a1a19", "#ffffff", "#e9979a", true],
  ["ivory", "Ivory", "#faf6ef", "#1a1a19", "#b76e79", true],
  ["ocean", "Ocean", "#0b2545", "#eef4ed", "#8da9c4", true],
  ["moss", "Moss", "#283618", "#fefae0", "#dda15e", false],
].map(
  ([name, display_name, bg_color, text_color, accent_color, is_active]) => ({
    id: nextId(),
    name,
    display_name,
    bg_color,
    text_color,
    accent_color,
    is_active,
  }),
);

/* ------------------------------------------------------------------ */
/* customers + orders                                                  */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = [
  "Sara",
  "Youssef",
  "Mariam",
  "Omar",
  "Nour",
  "Ahmed",
  "Salma",
  "Karim",
  "Laila",
  "Hassan",
  "Dina",
  "Tarek",
  "Hana",
  "Mostafa",
  "Farida",
  "Amr",
  "Yara",
  "Ziad",
  "Aya",
  "Khaled",
];
const LAST_NAMES = [
  "Hassan",
  "Ibrahim",
  "Mahmoud",
  "Fathy",
  "Saad",
  "Naguib",
  "Mansour",
  "Fawzy",
  "El-Sayed",
  "Ramadan",
  "Shawky",
  "Helmy",
];
const STREETS = [
  "El Tahrir St",
  "Abbas El Akkad St",
  "Gameat El Dowal St",
  "Corniche Rd",
  "El Nasr St",
  "Road 9",
  "Salah Salem St",
];
const GROUP_NAMES = [
  "The Squad",
  "Cairo Crew",
  "Team Forever",
  "Besties",
  "The Originals",
];
const EXTRAS = SHOP_EXTRAS.map((x) => ({
  extra_name: x.name,
  extra_price: x.price,
}));
// The shop's suggestions for the place printed on a card.
const PLACES = ["In Your Heart", "The Cinema", "Roma Cafe", "AUC University"];
const CUSTOMER_NOTES = [
  "Please deliver after 5 PM.",
  "Call before delivery.",
  "It is a surprise, please do not mention the contents.",
  "Gift wrap if possible.",
];
const PRODUCTION_NOTES = [
  "Customer asked to change the second name's spelling.",
  "Customer sent a new song link on WhatsApp.",
  "Use the darker shade for the back of the card.",
  "Please double check the anniversary date with the customer.",
];

// Listed once per share of customers: mostly Cairo and Giza, like a real order book.
const [CAIRO, GIZA, ALEXANDRIA, MANSOURA, TANTA, ASWAN] = CITIES;
const CUSTOMER_CITIES = [
  CAIRO,
  CAIRO,
  CAIRO,
  CAIRO,
  GIZA,
  GIZA,
  GIZA,
  ALEXANDRIA,
  ALEXANDRIA,
  MANSOURA,
  TANTA,
  ASWAN,
];

const CUSTOMERS = Array.from({ length: 120 }, (_, i) => {
  const city = pick(CUSTOMER_CITIES);
  return {
    full_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    // Not a reserved range (Egypt has none), but all-zero filler keeps them obviously fake.
    phone: `0100000${String(i + 1).padStart(4, "0")}`,
    address: `${int(1, 90)} ${pick(STREETS)}`,
    city_id: city.id,
    zone_id: pick(city.zones).id,
  };
});

export function recalcTotals(order) {
  order.subtotal = round2(
    order.unit_price + sum(order.extras, (x) => x.extra_price),
  );
  order.grand_total = round2(
    order.subtotal + order.shipping_fee - order.discount_amount,
  );
}

function statusForAge(age) {
  const { PENDING, DEPOSITED, PRODUCTION, SHIPPED, SHIPPED_PAID, CANCELLED } =
    ORDER_STATUS;
  if (chance(0.07)) return CANCELLED;
  if (age <= 1) return pick([PENDING, PENDING, DEPOSITED]);
  if (age <= 5) return pick([PENDING, DEPOSITED, DEPOSITED, PRODUCTION]);
  if (age <= 12) return pick([DEPOSITED, PRODUCTION, PRODUCTION, SHIPPED]);
  if (age <= 20) return pick([PRODUCTION, SHIPPED, SHIPPED, SHIPPED_PAID]);
  return SHIPPED_PAID;
}

function trackingNumber(carrier) {
  const digits = String(int(10_000_000, 99_999_999));
  return carrier === "jt"
    ? `JT${digits}`
    : carrier === "flash"
      ? `FL${digits}`
      : `MAN-${digits}`;
}

const ORDERS = [];
const SHIPMENTS = [];
const LEDGER = [];
const REFUNDS = [];
const USERS = [];

const addDeposit = (order, value, ms, description) =>
  LEDGER.push({
    id: nextId(),
    type: "deposit",
    order_id: order.id,
    value,
    created_at: isoAt(ms),
    description: description ?? `${order.full_name} Deposit`,
  });

const addShipment = (order, status, codAmount, ms, notes = null) => {
  const carrier = pick(["jt", "jt", "flash", "manual"]);
  const shipment = {
    id: nextId(),
    order_id: order.id,
    carrier,
    tracking_no: trackingNumber(carrier),
    cod_amount: codAmount,
    status,
    notes,
    created_at: isoAt(ms),
  };
  SHIPMENTS.push(shipment);
  if (status === "active" || status === "delivered")
    order.shipping_id = shipment.tracking_no;
};

// Oldest first, so ids ascend with time.
for (let i = 0; i < ORDER_COUNT; i++) {
  // The exponent clusters orders into recent weeks, so the 30-day charts aren't sparse.
  const age = HISTORY_DAYS * (1 - i / (ORDER_COUNT - 1)) ** 1.7;
  const placedAt = Date.now() - age * DAY_MS;
  const status = statusForAge(age);
  const customer = pick(CUSTOMERS);
  const product = pick(orderWeightedProducts);
  // Keychain orders carry only a name and a design per keychain; cards also
  // have the couple's/friends' date, place and song.
  const isKeychain = product.product_types.code === "KEYCHAIN";
  const cardCount = pick(
    isKeychain ? [2, 2, 2, 3, 3, 4, 5, 6] : [2, 2, 2, 2, 2, 2, 3, 3, 4, 5],
  );
  const coupon = chance(0.22) ? pick(ORDER_COUPONS) : null;
  const unitPrice = product.card_price_tiers.find(
    (t) => t.cards_count === cardCount,
  ).price;
  const city = CITIES.find((c) => c.id === customer.city_id);

  const order = {
    id: 1001 + i,
    order_time: isoAt(placedAt),
    status,
    payment_override: null, // 'refunded' | 'failed'; anything else is derived from deposits
    ...customer,
    product_id: product.id,
    unit_price: unitPrice,
    extras: chance(0.25) ? [{ ...pick(EXTRAS) }] : [],
    coupon: coupon?.coupon ?? null,
    discount_amount: !coupon
      ? 0
      : coupon.type === "fixed"
        ? coupon.value
        : Math.round((unitPrice * coupon.value) / 100),
    shipping_fee: city.zones.find((z) => z.id === customer.zone_id).shippingFee,
    group_name: !isKeychain && cardCount > 2 ? pick(GROUP_NAMES) : null,
    date: isKeychain
      ? null
      : new Date(placedAt - int(100, 3000) * DAY_MS).toISOString().slice(0, 10),
    addr: !isKeychain && chance(0.4) ? pick(PLACES) : null,
    song:
      !isKeychain && chance(0.6)
        ? `https://example.com/songs/${int(1000, 9999)}`
        : null,
    notes: chance(0.3) ? pick(CUSTOMER_NOTES) : null,
    shipping_id: null,
    profile_pid: null,
    production_notes: [],
    cards: Array.from({ length: cardCount }, () => {
      const name = pick(FIRST_NAMES);
      const color = pick(product.colors);
      return {
        id: nextId(),
        name,
        color: color.name,
        color_hex: color.hex,
        full_image_url: frontImageOf(product, color),
      };
    }),
  };
  recalcTotals(order);
  ORDERS.push(order);

  const deliveredAt = placedAt + int(4, 12) * DAY_MS;
  const shippedAt = placedAt + int(2, 4) * DAY_MS;
  const firstDeposit =
    Math.round((order.grand_total * pick([0.3, 0.4, 0.5])) / 10) * 10;
  const { PENDING, DEPOSITED, PRODUCTION, SHIPPED, SHIPPED_PAID, CANCELLED } =
    ORDER_STATUS;

  if ([DEPOSITED, PRODUCTION, SHIPPED, SHIPPED_PAID].includes(status)) {
    addDeposit(order, firstDeposit, placedAt + int(1, 20) * HOUR_MS);
  }
  if (status === SHIPPED) {
    addShipment(
      order,
      "active",
      round2(order.grand_total - firstDeposit),
      shippedAt,
    );
  }
  if (status === SHIPPED_PAID) {
    const balance = round2(order.grand_total - firstDeposit);
    if (chance(0.08))
      addShipment(order, "returned", balance, shippedAt, "Customer not home");
    addShipment(order, "delivered", balance, shippedAt + DAY_MS);
    addDeposit(
      order,
      balance,
      deliveredAt,
      `${order.full_name} balance collected on delivery`,
    );
  }
  if (status === CANCELLED) {
    if (age > 10 && chance(0.4))
      addShipment(
        order,
        pick(["returned", "cancelled"]),
        round2(order.grand_total - firstDeposit),
        shippedAt,
      );
    if (chance(0.5)) {
      const refundedAt = placedAt + int(1, 5) * DAY_MS;
      addDeposit(order, firstDeposit, placedAt + int(1, 20) * HOUR_MS);
      REFUNDS.push({
        id: nextId(),
        order_id: order.id,
        value: firstDeposit,
        created_at: isoAt(refundedAt),
        description: pick([
          "Customer changed their mind",
          "Order cancelled before production",
          "Duplicate order",
        ]),
      });
      order.payment_override = "refunded";
    } else if (chance(0.3)) {
      order.payment_override = "failed";
    }
  }

  if (status !== PENDING && status !== CANCELLED && chance(0.3)) {
    order.production_notes.push({
      id: nextId(),
      edits: pick(PRODUCTION_NOTES),
      created_at: isoAt(placedAt + int(1, 48) * HOUR_MS),
      images: chance(0.4)
        ? [{ image_url: placeholderImage("Attachment") }]
        : [],
    });
  }

  const hasProfile =
    status === SHIPPED_PAID || status === SHIPPED
      ? chance(0.85)
      : status === PRODUCTION && chance(0.3);
  if (hasProfile) {
    order.profile_pid = `p${order.id}`;
    USERS.push({
      id: nextId(),
      username: `z${order.id}`,
      name: order.full_name,
      friends_count: cardCount,
      is_blocked: false,
      pid: order.profile_pid,
      theme_ids: chance(0.25) ? [pick(CUSTOM_THEMES).id] : [],
      created_at: order.order_time,
    });
  }
}

// Accounts not tied to an order: custom cards, and one with no profile linked yet.
USERS.push(
  {
    id: nextId(),
    username: "sara.youssef",
    name: "Sara & Youssef",
    friends_count: 2,
    is_blocked: false,
    pid: "p-custom-1",
    theme_ids: [CUSTOM_THEMES[0].id],
    created_at: daysAgoIso(40),
  },
  {
    id: nextId(),
    username: "no.profile",
    name: "Account Without Profile",
    friends_count: 1,
    is_blocked: false,
    pid: null,
    theme_ids: [],
    created_at: daysAgoIso(12),
  },
);

// Monthly running costs and the odd bit of other income, for Profit and Cash flow.
for (let month = 0; month < 8; month++) {
  const at = (day) => daysAgoIso(month * 30 + day);
  LEDGER.push(
    {
      id: nextId(),
      type: "expense",
      order_id: null,
      value: int(2500, 4000),
      description: "Meta ads",
      created_at: at(int(1, 8)),
    },
    {
      id: nextId(),
      type: "expense",
      order_id: null,
      value: int(800, 1500),
      description: "Packaging restock",
      created_at: at(int(9, 16)),
    },
    {
      id: nextId(),
      type: "expense",
      order_id: null,
      value: int(1500, 2500),
      description: "NFC chips order",
      created_at: at(int(17, 28)),
    },
  );
  if (month % 3 === 1) {
    LEDGER.push({
      id: nextId(),
      type: "income",
      order_id: null,
      value: int(3000, 6000),
      description: "Corporate gifting order",
      created_at: at(int(1, 28)),
    });
  }
}

/* ------------------------------------------------------------------ */
/* staff activity + sessions                                           */
/* ------------------------------------------------------------------ */

const ACTIVITY_KINDS = [
  ["auth.login", null],
  ["auth.login", null],
  ["auth.login_failed", null],
  ["order.status_changed", "order"],
  ["order.status_changed", "order"],
  ["order.shipment_created", "order"],
  ["order.note_added", "order"],
  ["order.design_updated", "order"],
  ["finance.deposit_recorded", "order"],
  ["shipment.status_changed", "shipment"],
  ["product.updated", "product"],
  ["coupon.updated", "coupon"],
];

const ACTIVITY = Array.from({ length: 140 }, (_, i) => {
  const [action, entityType] = pick(ACTIVITY_KINDS);
  return {
    id: nextId(),
    adminId: pick(STAFF).id,
    action,
    entityType,
    entityId:
      entityType === "order"
        ? String(pick(ORDERS).id)
        : entityType
          ? String(int(1, 200))
          : null,
    ipAddress: `203.0.113.${int(1, 254)}`,
    createdAt: daysAgoIso(i * 0.2 + rand() * 0.2),
  };
});

const SESSIONS = [
  {
    id: nextId(),
    ip: "203.0.113.24",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/138.0 Safari/537.36",
    created_at: daysAgoIso(1),
    last_seen_at: nowIso(),
    current: true,
  },
  {
    id: nextId(),
    ip: "198.51.100.7",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) Safari/604.1",
    created_at: daysAgoIso(6),
    last_seen_at: daysAgoIso(2),
    current: false,
  },
  {
    id: nextId(),
    ip: "198.51.100.91",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/140.0",
    created_at: daysAgoIso(19),
    last_seen_at: daysAgoIso(9),
    current: false,
  },
];

/* ------------------------------------------------------------------ */
/* the database + shared lookups                                       */
/* ------------------------------------------------------------------ */

export const db = {
  permissionCatalog: PERMISSIONS,
  roles: ROLES,
  staff: STAFF,
  cities: CITIES,
  products: CATALOG,
  coupons: COUPONS,
  customThemes: CUSTOM_THEMES,
  siteThemes: SITE_THEMES,
  orders: ORDERS,
  shipments: SHIPMENTS,
  ledger: LEDGER,
  refunds: REFUNDS,
  users: USERS,
  activity: ACTIVITY,
  sessions: SESSIONS,
};

export const newestFirst = (a, b) =>
  String(b.created_at).localeCompare(String(a.created_at));
export const productOf = (order) =>
  db.products.find((p) => p.id === order.product_id) ?? null;
export const cityOf = (order) =>
  db.cities.find((c) => c.id === order.city_id) ?? null;
export const zoneOf = (order) =>
  cityOf(order)?.zones.find((z) => z.id === order.zone_id) ?? null;
export const depositsOf = (order) =>
  db.ledger.filter((e) => e.type === "deposit" && e.order_id === order.id);
export const paidOf = (order) => sum(depositsOf(order), (e) => e.value);

export function paymentStatus(order) {
  if (order.payment_override) return order.payment_override;
  const paid = paidOf(order);
  if (paid >= order.grand_total) return "paid";
  return paid > 0 ? "pending" : "unpaid";
}

/** Case-insensitive match on id, customer name, phone or group name. */
export function orderMatchesSearch(order, search) {
  const term = String(search ?? "")
    .trim()
    .toLowerCase();
  if (!term) return true;
  return [order.id, order.full_name, order.phone, order.group_name].some(
    (field) =>
      String(field ?? "")
        .toLowerCase()
        .includes(term),
  );
}
