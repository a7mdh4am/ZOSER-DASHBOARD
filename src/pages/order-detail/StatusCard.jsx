import { useState } from "react";
import { useAuth } from "../../context/auth.js";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import {
  CANCELLABLE,
  isNormalMove,
  NEXT_STATUS,
  statusOf,
  STATUS_ORDER,
} from "../../lib/format.js";

const SUPER_ADMIN = "SUPER_ADMIN";

// The order's status. Staff move it one step forward with a button (like the Design
// Studio's "Move to production"), and cancel it while it's Pending or Deposited. The
// Super Admin picks any status from a list; anything but those normal moves asks why.
export function StatusCard({ order, onChanged }) {
  const { can, user } = useAuth();
  const toast = useToast();
  const cur = String(order.status);
  const isSuper = user?.role === SUPER_ADMIN;
  const [value, setValue] = useState(cur);
  const [reason, setReason] = useState("");

  const [change, busy] = useAction(async (to, why) => {
    try {
      await ordersApi.updateStatus(order.id, to, why);
      toast(`Status updated to ${statusOf(to).label}`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (!can("orders.status.update")) return null;

  if (isSuper) {
    const needsReason = value !== cur && !isNormalMove(cur, value);
    return (
      <div className="card">
        <div className="card-head">
          <h3>Order status</h3>
        </div>
        <div className="card-body stack" style={{ gap: 10 }}>
          <div className="row">
            <select
              className="input"
              aria-label="Order status"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {statusOf(s).label}
                </option>
              ))}
            </select>
            <button
              className="btn primary"
              onClick={() => change(value, reason.trim())}
              disabled={
                busy || value === cur || (needsReason && !reason.trim())
              }
            >
              {busy ? "…" : "Update"}
            </button>
          </div>
          {needsReason && (
            <label className="stack" style={{ gap: 4 }}>
              <span className="small muted">
                From {statusOf(cur).label} to {statusOf(value).label} isn't the
                usual next step. Why?
              </span>
              <input
                className="input"
                value={reason}
                maxLength={255}
                placeholder="The reason, kept in the order's history"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  const next = NEXT_STATUS[cur];
  const cancellable = CANCELLABLE.includes(cur);
  if (!next && !cancellable) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Order status</h3>
      </div>
      <div className="card-body row wrap">
        {next && (
          <button
            className="btn primary"
            onClick={() => change(next)}
            disabled={busy}
          >
            {busy ? "…" : `Move to ${statusOf(next).label}`}
          </button>
        )}
        {cancellable && (
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Cancel order #${order.id}? Only a Super Admin can undo this.`,
                )
              )
                change("3");
            }}
          >
            Cancel order
          </button>
        )}
      </div>
    </div>
  );
}
