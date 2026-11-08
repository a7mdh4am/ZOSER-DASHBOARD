// Every permission code the dashboard checks, and what it allows. The dashboard
// owns this list: the Roles page offers exactly these codes, and a backend should
// grant and enforce the same ones. Hiding UI is only a convenience — a server
// must still check every request itself.
//
// Codes are `area.action`; the Roles page groups the checkboxes by `area`.
export const PERMISSIONS = [
  { code: "dashboard.view", description: "See the dashboard" },
  { code: "orders.view", description: "See orders and their details" },
  { code: "orders.status.update", description: "Change an order's status" },
  {
    code: "orders.details.update",
    description: "Edit an order's design, cards and customization",
  },
  {
    code: "orders.customer_info.update",
    description: "Edit the customer's phone and address on an order",
  },
  { code: "orders.shipment.create", description: "Create shipments" },
  {
    code: "orders.shipment.status.update",
    description: "Mark shipments delivered, returned or cancelled",
  },
  {
    code: "designer.view",
    description:
      "Open the Design Studio and move designed orders to production",
  },
  {
    code: "production.notes.add",
    description: "Add production notes to orders",
  },
  { code: "customers.view", description: "Open the Customers page" },
  {
    code: "users.view",
    description: "Look up customer accounts and their profile links",
  },
  { code: "users.password.reset", description: "Reset a customer's password" },
  {
    code: "profiles.create",
    description: "Create customer accounts and order profiles",
  },
  {
    code: "profiles.themes.add",
    description: "Give profile themes to customers or take them back",
  },
  { code: "themes.view", description: "Open the Themes page" },
  {
    code: "catalog.themes.manage",
    description: "Create, edit and disable themes",
  },
  { code: "products.view", description: "Open the Products page" },
  { code: "catalog.products.add", description: "Create designs" },
  {
    code: "catalog.products.update",
    description: "Edit designs, their colors and images",
  },
  { code: "catalog.prices.update", description: "Edit price tiers" },
  { code: "coupons.view", description: "Open the Coupons page" },
  {
    code: "coupons.manage",
    description: "Create, edit, disable and delete coupons",
  },
  { code: "finance.view", description: "Open the Finance reports" },
  { code: "finance.deposit.add", description: "Record deposits on orders" },
  {
    code: "finance.entry.add",
    description: "Record income and expense entries",
  },
  { code: "finance.costs.manage", description: "Set product unit costs" },
  {
    code: "team.manage",
    description: "Manage staff accounts and see staff activity",
  },
  { code: "roles.manage", description: "Create, edit and delete staff roles" },
];

let knownCodes;

export function hasPermission(perms, code) {
  // Catches typos and codes missing from PERMISSIONS while developing; this
  // whole branch is dropped from production builds.
  if (import.meta.env.DEV) {
    knownCodes ??= new Set(PERMISSIONS.map((p) => p.code));
    if (!knownCodes.has(code))
      console.warn(
        `Unknown permission code "${code}" — add it to PERMISSIONS in lib/permissions.js`,
      );
  }
  if (!perms) return false;
  return perms.includes(code);
}
