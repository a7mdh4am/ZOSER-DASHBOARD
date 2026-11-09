// Thin fetch wrapper (JSON in/out, CSRF header on writes, 401 propagation)
// plus every backend endpoint the admin app calls, grouped by domain.
// Pages import the domain objects below (e.g. `ordersApi.list(...)`) —
// nothing outside this file should call fetch() or the request() helper
// directly.
//
// Points at the Node backend (_backend, /api/v1/admin/*) — see
// _frontend/vite.config.js's dev proxy and docs/API_MIGRATION_STATUS.md for
// the PHP endpoints this replaced.
//
// There's no backend to run yet, so the dev server answers these calls from
// dummy data instead (./mock). Production builds still call the real API.
// VITE_MOCK_API=true|false overrides this either way, e.g. for a demo build.
const USE_MOCK = import.meta.env.VITE_MOCK_API
  ? import.meta.env.VITE_MOCK_API === "true"
  : import.meta.env.DEV;

const send = USE_MOCK
  ? async (url, opts) => (await import("dummy-api")).mockFetch(url, opts) // src/lib/mock (vite.config.js)
  : (url, opts) => fetch(url, opts);

let csrfToken = "";

export function setCsrf(token) {
  csrfToken = token || "";
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const BASE = "/api/v1/admin";

async function request(method, url, body, retrying = false) {
  const opts = {
    method,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  };

  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.headers["X-CSRF-Token"] = csrfToken;
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await send(url, opts);
  } catch {
    throw new ApiError("Network error — check your connection", 0, null);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const payload = data?.data ?? data;

  if (!res.ok) {
    if (!retrying && !url.startsWith(`${BASE}/auth/`)) {
      // 401: 2h access token may just need a refresh-token rotation.
      if (res.status === 401 && (await tryRefresh())) {
        return request(method, url, body, true);
      }
    }
    if (res.status === 401 && !url.startsWith(`${BASE}/auth/`)) {
      window.dispatchEvent(new Event("zoser:unauthorized"));
    }
    const msg = data?.error?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data?.error ?? null);
  }

  return payload;
}

let refreshPromise = null;

/** Rotate the refresh token; concurrent 401s share one attempt. */
async function tryRefresh() {
  refreshPromise ??= (async () => {
    try {
      const res = await send(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "same-origin",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

const apiGet = (path) => request("GET", `${BASE}${path}`);
const apiPost = (path, body = {}) => request("POST", `${BASE}${path}`, body);
const apiPatch = (path, body = {}) => request("PATCH", `${BASE}${path}`, body);
const apiDelete = (path) => request("DELETE", `${BASE}${path}`);

/** Multipart upload (FormData). CSRF header rides along; browser sets boundary. */
async function apiUpload(path, formData) {
  let res;
  try {
    res = await send(`${BASE}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "X-CSRF-Token": csrfToken },
      credentials: "same-origin",
      body: formData,
    });
  } catch {
    throw new ApiError("Network error — check your connection", 0, null);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401)
      window.dispatchEvent(new Event("zoser:unauthorized"));
    throw new ApiError(
      data?.error?.message || `Upload failed (${res.status})`,
      res.status,
      data?.error ?? null,
    );
  }
  return data?.data ?? data;
}

/** GET a file (e.g. a CSV export) as a Blob. Errors still arrive as the JSON envelope. */
async function apiFile(path) {
  let res;
  try {
    res = await send(`${BASE}${path}`, {
      headers: { Accept: "text/csv" },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Network error — check your connection", 0, null);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 401)
      window.dispatchEvent(new Event("zoser:unauthorized"));
    throw new ApiError(
      data?.error?.message || `Download failed (${res.status})`,
      res.status,
      data?.error ?? null,
    );
  }
  return res.blob();
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

export const authApi = {
  me: () => apiGet("/auth/me"),
  refresh: () => apiPost("/auth/refresh"),
  login: (username, password) => apiPost("/auth/login", { username, password }),
  logout: () => apiPost("/auth/logout"),
};

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

export const dashboardApi = {
  get: () => apiGet("/dashboard"),
};

/* ------------------------------------------------------------------ */
/* geo (shipping reference data)                                       */
/* ------------------------------------------------------------------ */

export const geoApi = {
  cities: () => apiGet("/geo/cities"),
};

/* ------------------------------------------------------------------ */
/* orders                                                               */
/* ------------------------------------------------------------------ */

export const ordersApi = {
  list: (params) => apiGet(`/orders?${new URLSearchParams(params)}`),
  get: (id) => apiGet(`/orders/${id}`),
  addDeposit: (orderId, value) =>
    apiPost(`/orders/${orderId}/deposits`, { value }),
  updateStatus: (orderId, status, reason) =>
    apiPost(`/orders/${orderId}/status`, { status: Number(status), reason }),
  addNote: (orderId, formData) =>
    apiUpload(`/orders/${orderId}/notes`, formData),
  deleteNote: (orderId, noteId) =>
    apiDelete(`/orders/${orderId}/notes/${noteId}`),
  updateCustomer: (orderId, form) =>
    Promise.all([
      apiPatch(`/orders/${orderId}/customer-info`, { shipPhone: form.phone }),
      apiPatch(`/orders/${orderId}/shipping`, {
        shipAddress: form.address,
        cityId: form.cityId,
        zoneId: form.zoneId,
      }),
    ]),
  updateDesign: (orderId, body) => apiPost(`/orders/${orderId}/design`, body),
  createProfile: (orderId) => apiPost(`/orders/${orderId}/profile`),
  createShipment: (orderId, body) =>
    apiPost(`/orders/${orderId}/shipments`, body),
};

export const shipmentsApi = {
  updateStatus: (shipmentId, status) =>
    apiPost(`/shipments/${shipmentId}/status`, { status }),
};

/* ------------------------------------------------------------------ */
/* designer / production queue                                         */
/* ------------------------------------------------------------------ */

export const designerApi = {
  list: (params) => apiGet(`/production/orders?${new URLSearchParams(params)}`),
  get: (id) => apiGet(`/production/orders/${id}`),
  setStatus: (id, reason) =>
    apiPost(`/production/orders/${id}/status`, { reason }),
};

/* ------------------------------------------------------------------ */
/* finance                                                              */
/* ------------------------------------------------------------------ */

export const financeApi = {
  /** Generic section fetch (products/customers/payments/discounts/shipping/refunds/profit/cashflow). */
  section: (section, query) => apiGet(`/finance/${section}?${query}`),
  orders: (query) => apiGet(`/finance/orders?${query}`),
  /** Every order matching the filters (not just one page), as a CSV Blob. */
  ordersCsv: (query) => apiFile(`/finance/orders?${query}&format=csv`),
  setCost: (productId, unitCost) =>
    apiPost("/finance/costs", { productId, unitCost }),
  addEntry: (body) => apiPost("/finance/entries", body),
};

/* ------------------------------------------------------------------ */
/* products                                                             */
/* ------------------------------------------------------------------ */

export const productsApi = {
  list: () => apiGet("/products"),
  get: (id) => apiGet(`/products/${id}`),
  save: (id, form) =>
    id ? apiPatch(`/products/${id}`, form) : apiPost("/products", form),
  toggle: (id, isActive) => apiPost(`/products/${id}/toggle`, { isActive }),
  addColor: (productId, body) => apiPost(`/products/${productId}/colors`, body),
  deleteColor: (colorId) => apiDelete(`/products/colors/${colorId}`),
  /** formData carries the file plus optional colorId/kind/sortOrder fields. */
  uploadColorImage: (productId, formData) =>
    apiUpload(`/products/${productId}/images/upload`, formData),
  deleteColorImage: (imageId) => apiDelete(`/products/images/${imageId}`),
  savePriceTier: (productId, row) =>
    apiPost(`/products/${productId}/card-price-tiers`, {
      ...row,
      currencyCode: "EGP",
    }),
  deletePriceTier: (tierId) =>
    apiDelete(`/products/card-price-tiers/${tierId}`),
};

/* ------------------------------------------------------------------ */
/* coupons                                                              */
/* ------------------------------------------------------------------ */

export const couponsApi = {
  list: () => apiGet("/coupons"),
  toggle: (id, isActive) => apiPost(`/coupons/${id}/toggle`, { isActive }),
  remove: (id) => apiDelete(`/coupons/${id}`),
  save: (id, form) =>
    id ? apiPatch(`/coupons/${id}`, form) : apiPost("/coupons", form),
};

/* ------------------------------------------------------------------ */
/* customers                                                            */
/* ------------------------------------------------------------------ */

export const customersApi = {
  create: (form) => apiPost("/customers", form),
  resetPassword: (id, newPassword) =>
    apiPost(`/customers/${id}/password-reset`, { newPassword }),
  lookup: (username) =>
    apiGet(`/customers/lookup?username=${encodeURIComponent(username)}`),
};

/* ------------------------------------------------------------------ */
/* roles                                                                */
/* ------------------------------------------------------------------ */

export const rolesApi = {
  list: () => apiGet("/roles"),
  create: (body) => apiPost("/roles", body),
  update: (id, body) => apiPatch(`/roles/${id}`, body),
  remove: (id) => apiDelete(`/roles/${id}`),
};

/* ------------------------------------------------------------------ */
/* team + activity                                                      */
/* ------------------------------------------------------------------ */

export const teamApi = {
  list: () => apiGet("/team"),
  toggle: (id, isBlocked) => apiPost(`/team/${id}/toggle`, { isBlocked }),
  create: (form) => apiPost("/team", form),
  assignRole: (id, roleCode) => apiPost(`/team/${id}/role`, { roleCode }),
};

export const activityApi = {
  /** Super-admin-only staff activity feed. */
  staff: (params) => apiGet(`/activity?${new URLSearchParams(params)}`),
};

/* ------------------------------------------------------------------ */
/* themes                                                               */
/* ------------------------------------------------------------------ */

export const themesApi = {
  list: () => apiGet("/themes"),
  saveCustom: (theme) => apiPost("/themes/custom", theme),
  toggleCustom: (id, isActive) =>
    apiPost(`/themes/custom/${id}/toggle`, { isActive }),
  assign: (body) => apiPost("/themes/assign", body),
  createSite: (form) => apiPost("/themes/site", form),
  toggleSite: (id, isActive) =>
    apiPost(`/themes/site/${id}/toggle`, { isActive }),
  deleteSite: (id) => apiDelete(`/themes/site/${id}`),
};

/* ------------------------------------------------------------------ */
/* own-account settings                                                 */
/* ------------------------------------------------------------------ */

export const settingsApi = {
  me: () => apiGet("/settings/me"),
  sessions: () => apiGet("/settings/sessions"),
  revokeSession: (id) => apiPost(`/settings/sessions/${id}/revoke`),
  updateProfile: (displayName) => apiPost("/settings/profile", { displayName }),
  changePassword: (currentPassword, newPassword) =>
    apiPost("/settings/password", { currentPassword, newPassword }),
  requestEmailChange: (newEmail, currentPassword) =>
    apiPost("/settings/email/request", { newEmail, currentPassword }),
  confirmEmailChange: (newEmail, code) =>
    apiPost("/settings/email/confirm", { newEmail, code }),
};
