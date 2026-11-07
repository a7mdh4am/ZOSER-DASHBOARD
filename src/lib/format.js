// Order-status map (mirrors OrderModel::STATUS_LABELS) + formatters.

export const STATUS = {
  0: { label: "Pending", color: "var(--st-pending)", key: "pending" },
  1: { label: "Deposited", color: "var(--st-deposited)", key: "deposited" },
  5: { label: "Production", color: "var(--st-production)", key: "production" },
  2: { label: "Shipped", color: "var(--st-shipped)", key: "shipped" },
  4: { label: "Shipped + Paid", color: "var(--st-paid)", key: "paid" },
  3: { label: "Cancelled", color: "var(--st-cancelled)", key: "cancelled" },
};

/** Order of statuses in filters and charts (workflow order). */
export const STATUS_ORDER = ["0", "1", "5", "2", "4", "3"];

export const statusOf = (s) =>
  STATUS[String(s)] ?? {
    label: "Unknown",
    color: "var(--ink-3)",
    key: "unknown",
  };

const egp = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 });
const egp2 = new Intl.NumberFormat("en-EG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (v) => `${egp.format(Number(v) || 0)} EGP`;
export const money2 = (v) => `${egp2.format(Number(v) || 0)} EGP`;

export function fmtDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function fmtProductionDate(value, withTime = false) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function relDay(value) {
  if (!value) return "";
  const d = new Date(String(value).replace(" ", "T"));
  const today = new Date();
  const startOf = (x) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return fmtDate(value);
}

export const waLink = (phone) => {
  const p = String(phone || "").replace(/[\s\-()]/g, "");
  return `https://wa.me/${p.startsWith("+") ? p : "+20" + p.replace(/^0/, "")}`;
};

/** Known card color names → swatch hex (best effort; falls back to text). */
const COLOR_HEX = {
  black: "#111111",
  grey: "#9ca3af",
  gray: "#9ca3af",
  navy: "#1e3a8a",
  green: "#16a34a",
  neon: "#a3e635",
  brick: "#b91c1c",
  pink: "#ec4899",
  skyblue: "#38bdf8",
  "sky blue": "#38bdf8",
  white: "#f8fafc",
  red: "#dc2626",
  blue: "#2563eb",
  purple: "#7c3aed",
  gold: "#d4a017",
  silver: "#c0c0c0",
};
export const colorHex = (name) =>
  COLOR_HEX[
    String(name || "")
      .trim()
      .toLowerCase()
  ] || null;
