import axios from "axios";

// The dashboard's connection to ZOSER's API (backend/, /api/v1/admin/*), plus every
// endpoint the admin app calls, grouped by domain. Pages import the domain objects below
// (e.g. `ordersApi.list(...)`) — nothing outside this file should make requests directly.
//
// Sign-in gives a short access token, kept in memory only and sent as a bearer header,
// and the API sets a long-lived refresh cookie (HttpOnly) for /auth/refresh. When the
// access token runs out, one refresh (shared by every request that ran out together)
// gets a new one and the request is tried again; when that fails, `zoser:unauthorized`
// sends the app to sign-in.
//
// VITE_MOCK_API=true answers from dummy data instead (./mock, through an Axios adapter);
// it's on by default in the dev server. VITE_API_URL: the API's address (default: this
// site's own /api, which the dev server proxies to localhost:4000).
const USE_MOCK = import.meta.env.VITE_MOCK_API
  ? import.meta.env.VITE_MOCK_API === "true"
  : import.meta.env.DEV;

const BASE = "/api/v1/admin";
const API_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let accessToken = null;

/** The access token from sign-in or a refresh (memory only). */
export function setAccessToken(token) {
  accessToken = token || null;
}

// The dummy API speaks fetch: this hands it each request and turns its Response back
// into Axios's shape
async function mockAdapter(config) {
  const { mockFetch } = await import("dummy-api"); // src/lib/mock (vite.config.js)
  const url = `${BASE}${config.url}`;
  const isForm =
    typeof FormData !== "undefined" && config.data instanceof FormData;
  const res = await mockFetch(url, {
    method: config.method.toUpperCase(),
    headers: isForm ? {} : { "Content-Type": "application/json" },
    body: config.data,
  });
  const type = res.headers?.get?.("Content-Type") ?? "";
  const data =
    config.responseType === "blob" && res.ok && !type.includes("json")
      ? await res.blob()
      : await res.json().catch(() => null);
  const response = {
    data,
    status: res.status,
    statusText: "",
    headers: {},
    config,
    request: {},
  };
  if (res.ok) return response;
  throw new axios.AxiosError("Request failed", null, config, null, response);
}

const http = axios.create({
  baseURL: `${API_URL}${BASE}`,
  withCredentials: true,
  timeout: 60000,
  ...(USE_MOCK ? { adapter: mockAdapter } : {}),
});

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

/** A new access token from the refresh cookie; concurrent callers share one attempt. */
export function refreshSession() {
  refreshPromise ??= http
    .post("/auth/refresh", null, {
      headers: { "X-ZSR-Client": "admin" },
      _noRetry: true,
    })
    .then((res) => {
      const session = res.data?.data ?? res.data;
      setAccessToken(session?.accessToken);
      return session;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function toError(error) {
  const res = error.response;
  if (!res)
    return new ApiError("Network error — check your connection", 0, null);
  // A failed file download's body is the JSON envelope, as a Blob
  const body =
    res.data instanceof Blob
      ? await res.data
          .text()
          .then((text) => JSON.parse(text))
          .catch(() => null)
      : res.data;
  return new ApiError(
    body?.error?.message || `Request failed (${res.status})`,
    res.status,
    body?.error ?? null,
  );
}

http.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  const isAuth = config?.url?.startsWith("/auth/");
  if (response?.status === 401 && !isAuth && !config._retried) {
    config._retried = true;
    try {
      const session = await refreshSession();
      if (session?.accessToken) return http(config);
    } catch {
      /* the session is over */
    }
    setAccessToken(null);
    window.dispatchEvent(new Event("zoser:unauthorized"));
  }
  throw await toError(error);
});

const unwrap = (res) => res.data?.data ?? res.data;

const apiGet = (path) => http.get(path).then(unwrap);
const apiPost = (path, body = {}) => http.post(path, body).then(unwrap);
const apiPut = (path, body = {}) => http.put(path, body).then(unwrap);
const apiPatch = (path, body = {}) => http.patch(path, body).then(unwrap);
const apiDelete = (path, body) =>
  http.delete(path, body ? { data: body } : undefined).then(unwrap);

/** Multipart upload (FormData); the browser sets the boundary. */
const apiUpload = (path, formData) => http.post(path, formData).then(unwrap);

/** GET a file (e.g. a CSV export) as a Blob. Errors still arrive as the JSON envelope. */
const apiFile = (path) =>
  http.get(path, { responseType: "blob" }).then((res) => res.data);

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

export const authApi = {
  me: () => apiGet("/auth/me"),
  /** { accessToken | null, admin | null }, from the refresh cookie */
  refresh: () => refreshSession(),
  /** { admin (with permissions), accessToken } */
  login: async (username, password) => {
    const result = await apiPost("/auth/login", { username, password });
    setAccessToken(result.accessToken);
    return result;
  },
  logout: async () => {
    try {
      await apiPost("/auth/logout");
    } finally {
      setAccessToken(null);
    }
  },
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
  /** Staff: the next step, or Cancelled while Pending or Deposited. The Super Admin:
   *  any status, with a reason when it isn't one of those */
  updateStatus: (orderId, status, reason) =>
    apiPost(`/orders/${orderId}/status`, {
      status: Number(status),
      reason: reason || undefined,
    }),
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
  updateDesign: (orderId, lineId, formData) =>
    apiUpload(`/orders/${orderId}/lines/${lineId}/design`, formData),
  addExtra: (orderId, lineId, body) =>
    apiPost(`/orders/${orderId}/lines/${lineId}/extras`, body),
  updateExtra: (orderId, lineId, extraId, body) =>
    apiPatch(`/orders/${orderId}/lines/${lineId}/extras/${extraId}`, body),
  deleteExtra: (orderId, lineId, extraId) =>
    apiDelete(`/orders/${orderId}/lines/${lineId}/extras/${extraId}`),
  /** Makes the chips' codes now (moving to Production does too); safe to repeat */
  provision: (orderId) => apiPost(`/orders/${orderId}/provision`),
  /** Which items open which memory page; changeable until the codes are made */
  groups: (orderId) => apiGet(`/orders/${orderId}/groups`),
  setGroups: (orderId, units) => apiPut(`/orders/${orderId}/groups`, { units }),
  createShipment: (orderId, body) =>
    apiPost(`/orders/${orderId}/shipments`, body),
};

/**
 * Memory pages: who's in each (participants: a place named at checkout, waiting until its
 * person taps their item and says it's theirs), which item is whose, and how often each
 * opens. Customers claim by tapping; staff fix mistakes (a wrong claim, a lost card).
 */
export const profilesApi = {
  get: (profileId) => apiGet(`/profiles/${profileId}`),
  search: (term) => apiGet(`/profiles?search=${encodeURIComponent(term)}`),
  addPerson: (profileId, body) =>
    apiPost(`/profiles/${profileId}/participants`, body),
  renamePerson: (participantId, displayName) =>
    apiPatch(`/participants/${participantId}`, { displayName }),
  /** Puts an account (by username) in a person's place */
  assignPerson: (participantId, username) =>
    apiPost(`/participants/${participantId}/assign`, { username }),
  /** Takes the account out; the place waits for its person again */
  unassignPerson: (participantId) =>
    apiPost(`/participants/${participantId}/unassign`),
  removePerson: (participantId) => apiDelete(`/participants/${participantId}`),
  addItem: (profileId, body) => apiPost(`/profiles/${profileId}/items`, body),
  reopen: (profileId) => apiPost(`/profiles/${profileId}/reopen`),
  clearPin: (profileId) => apiDelete(`/profiles/${profileId}/pin`),
  giverLink: (profileId) => apiPost(`/profiles/${profileId}/giver-link`),
  merge: (profileId, fromProfileId, map = []) =>
    apiPost(`/profiles/${profileId}/merge`, { fromProfileId, map }),
  split: (profileId, itemIds) =>
    apiPost(`/profiles/${profileId}/split`, { itemIds }),
};

/** One physical item (a card, keychain, necklace or bracelet) and the code on its chip. */
export const nfcApi = {
  /** "active" or "off" */
  setStatus: (itemId, status) =>
    apiPost(`/nfc-items/${itemId}/status`, { status }),
  /** Moves it to another person on its page (its owner follows) */
  assign: (itemId, participantId) =>
    apiPost(`/nfc-items/${itemId}/assign`, { participantId }),
  opens: (itemId, days = 30) =>
    apiGet(`/nfc-items/${itemId}/opens?days=${days}`),
  /** A new code for a lost or broken one; the old one stops working */
  replace: (itemId) => apiPost(`/nfc-items/${itemId}/replace`),
  programmed: (itemId) => apiPost(`/nfc-items/${itemId}/programmed`),
};

/** The programming sheet: every chip to write, for orders in production (or `orderIds`) */
export const productionApi = {
  sheet: (orderIds = []) =>
    apiGet(`/production/sheet?orders=${orderIds.join(",")}`),
  sheetCsv: (orderIds = []) =>
    apiFile(`/production/sheet?format=csv&orders=${orderIds.join(",")}`),
  /** The printable page, as a Blob (it needs the sign-in, so it's fetched here) */
  sheetPrint: (orderIds = []) =>
    apiFile(`/production/sheet?format=print&orders=${orderIds.join(",")}`),
};

/** Parcels marked returned, newest first: { returns, total, per_page } */
export const returnsApi = {
  list: (params) => apiGet(`/returns?${new URLSearchParams(params)}`),
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
  types: () => apiGet("/product-types"),
  /** How many of a type one order line may have */
  saveType: (code, minUnits, maxUnits) =>
    apiPatch(`/product-types/${code}`, { minUnits, maxUnits }),
  /** Stock: { status: "available" | "limited" | "out_of_stock" }, or name/hex */
  updateColor: (colorId, body) => apiPatch(`/products/colors/${colorId}`, body),
  /** The gallery's order: its pictures' ids, first to last */
  setGallery: (productId, imageIds) =>
    apiPut(`/products/${productId}/gallery`, { imageIds }),
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
  list: (params) => apiGet(`/customers?${new URLSearchParams(params)}`),
  get: (id) => apiGet(`/customers/${id}`),
  block: (id, blocked) => apiPost(`/customers/${id}/block`, { blocked }),
  /** Emails them a reset code (staff never see or type their password) */
  sendReset: (id) => apiPost(`/customers/${id}/send-reset`),
  /** Old-system accounts with no email only */
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
