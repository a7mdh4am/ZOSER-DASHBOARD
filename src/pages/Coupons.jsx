import { useCallback, useEffect, useState } from "react";
import { IconPlus, IconTag } from "../components/Icons.jsx";
import { Empty, Modal, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { couponsApi } from "../lib/api.js";
import { fmtDate } from "../lib/format.js";

const BLANK = {
  coupon: "",
  type: "percentage",
  value: "",
  expiry_date: "",
  min_order_total: "",
  max_uses: "",
  per_customer: "",
  is_active: true,
};

/** Discount coupons over the shop's discount_coupon table. */
export default function Coupons() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("coupons.manage");
  const [coupons, setCoupons] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // row or 'new'

  const load = useCallback(
    () =>
      couponsApi
        .list()
        .then(setCoupons)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  // One at a time: a double-click would otherwise toggle a coupon twice.
  const [toggle] = useAction(async (c) => {
    try {
      await couponsApi.toggle(c.id, !c.is_active);
      toast(c.is_active ? `${c.coupon} disabled` : `${c.coupon} enabled`);
      await load();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  const [remove] = useAction(async (c) => {
    if (!window.confirm(`Delete coupon ${c.coupon}?`)) return;
    try {
      await couponsApi.remove(c.id);
      toast(`${c.coupon} deleted`);
      await load();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (error) return <Empty title="Couldn't load coupons" hint={error} />;
  if (!coupons)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

  return (
    <div className="card">
      <div className="card-head">
        <IconTag size={17} />
        <h3>Discount coupons</h3>
        <div className="grow" />
        {canEdit && (
          <button className="btn sm primary" onClick={() => setEditing("new")}>
            <IconPlus size={14} /> New coupon
          </button>
        )}
      </div>

      {coupons.length === 0 ? (
        <Empty
          title="No coupons yet"
          hint={canEdit ? "Create one to start offering discounts." : undefined}
        />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Min order</th>
                <th>Usage</th>
                <th>Expiry</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const expired =
                  new Date(c.expiry_date) < new Date(new Date().toDateString());
                return (
                  <tr
                    key={c.id}
                    style={{ opacity: c.is_active && !expired ? 1 : 0.55 }}
                  >
                    <td className="strong mono">{c.coupon}</td>
                    <td>
                      {c.type === "fixed" ? `${c.value} EGP` : `${c.value}%`}
                    </td>
                    <td className="small">
                      {c.min_order_amount ? (
                        `${Number(c.min_order_amount)} EGP`
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small mono">
                      {c.max_uses ? `up to ${c.max_uses}` : "unlimited"}
                      {c.per_customer_limit ? (
                        <span className="muted">
                          {" "}
                          · {c.per_customer_limit}/cust
                        </span>
                      ) : null}
                    </td>
                    <td className="small muted">
                      {fmtDate(c.expiry_date)}
                      {expired ? " · expired" : ""}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          "--badge-c": c.is_active
                            ? "var(--st-paid)"
                            : "var(--ink-3)",
                        }}
                      >
                        <span className="dot" />
                        {c.is_active ? "active" : "inactive"}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: "right" }}>
                        <div
                          className="row"
                          style={{ gap: 6, justifyContent: "flex-end" }}
                        >
                          <button
                            className="btn sm ghost"
                            onClick={() => setEditing(c)}
                          >
                            Edit
                          </button>
                          <button className="btn sm" onClick={() => toggle(c)}>
                            {c.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="btn sm danger"
                            onClick={() => remove(c)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CouponModal
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CouponModal({ coupon, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(
    coupon
      ? {
          coupon: coupon.coupon || "",
          type: coupon.type || "percentage",
          value: String(coupon.value ?? ""),
          expiry_date: (coupon.expiry_date || "").slice(0, 10),
          min_order_total: coupon.min_order_amount
            ? String(Number(coupon.min_order_amount))
            : "",
          max_uses: coupon.max_uses ? String(coupon.max_uses) : "",
          per_customer: coupon.per_customer_limit
            ? String(coupon.per_customer_limit)
            : "",
          is_active: Boolean(coupon.is_active),
        }
      : BLANK,
  );
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        type: form.type,
        value: Number(form.value),
        expiryDate: form.expiry_date,
        minOrderAmount: form.min_order_total
          ? Number(form.min_order_total)
          : undefined,
        maxUses: form.max_uses ? Number(form.max_uses) : undefined,
        perCustomerLimit: form.per_customer
          ? Number(form.per_customer)
          : undefined,
      };
      if (!coupon) body.coupon = form.coupon.trim();
      await couponsApi.save(coupon?.id, body);
      toast(coupon ? "Coupon updated" : "Coupon created");
      onDone();
    } catch (err) {
      toast(err.message, "err");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={coupon ? `Edit ${coupon.coupon}` : "New coupon"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={
              busy || !form.coupon.trim() || !form.value || !form.expiry_date
            }
          >
            {busy ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Code (max 10)</span>
            <input
              className="input mono"
              value={form.coupon}
              maxLength={10}
              disabled={!!coupon}
              onChange={(e) =>
                setForm({ ...form, coupon: e.target.value.toUpperCase() })
              }
              autoFocus
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Expiry date</span>
            <input
              className="input"
              type="date"
              value={form.expiry_date}
              onChange={set("expiry_date")}
            />
          </label>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Type</span>
            <div className="seg" style={{ display: "flex" }}>
              {[
                ["percentage", "Percentage %"],
                ["fixed", "Fixed EGP"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  style={{ flex: 1 }}
                  className={form.type === v ? "active" : ""}
                  onClick={() => setForm({ ...form, type: v })}
                >
                  {l}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>
              {form.type === "fixed" ? "Amount (EGP)" : "Percent off"}
            </span>
            <input
              className="input"
              type="number"
              min="1"
              max={form.type === "percentage" ? 100 : undefined}
              value={form.value}
              onChange={set("value")}
            />
          </label>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Minimum order (EGP, optional)</span>
            <input
              className="input"
              type="number"
              min="0"
              value={form.min_order_total}
              onChange={set("min_order_total")}
            />
          </label>
          <label className="field">
            <span>Max total uses (optional)</span>
            <input
              className="input"
              type="number"
              min="1"
              value={form.max_uses}
              onChange={set("max_uses")}
            />
          </label>
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Per-customer limit (optional)</span>
            <input
              className="input"
              type="number"
              min="1"
              value={form.per_customer}
              onChange={set("per_customer")}
            />
          </label>
        </div>
        <div className="small muted">
          Usage limits and the minimum-order threshold are enforced by the shop
          at checkout.
        </div>
      </div>
    </Modal>
  );
}
