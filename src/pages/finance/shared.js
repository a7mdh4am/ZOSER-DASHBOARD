// Helpers shared by the Finance tabs.

import { useApiData } from "../../hooks/useApiData.js";
import { financeApi } from "../../lib/api.js";

export const shortMoney = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
};

export const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;

export const PAYMENT_STATUS_COLOR = {
  paid: "var(--st-paid)",
  pending: "var(--st-deposited)",
  unpaid: "var(--st-pending)",
  failed: "var(--st-cancelled)",
  refunded: "var(--st-cancelled)",
};

export function qs(filters, extra = {}) {
  const p = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
    if (v !== "" && v != null) p.set(k, v);
  });
  return p.toString();
}

/**
 * Fetch a finance section, cached by section + query so switching tabs back
 * and forth is instant. The cache is emptied when you leave the Finance page
 * (see index.jsx), so edits made elsewhere show up when you come back.
 */
export const sectionCache = new Map();

export function useSection(section, filters, extra = {}) {
  const query = qs(filters, extra);
  const key = `${section}?${query}`;

  // A cached answer comes back as a plain value, so it shows without a spinner.
  const { data, error, loading, reload } = useApiData(
    () =>
      sectionCache.get(key) ??
      financeApi.section(section, query).then((d) => {
        sectionCache.set(key, d);
        return d;
      }),
    [section, query, key],
  );

  return {
    data,
    error,
    loading,
    reload: () => {
      sectionCache.delete(key);
      return reload();
    },
  };
}
