import { useState } from "react";
import { useAuth } from "../../context/auth.js";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { statusOf, STATUS_ORDER } from "../../lib/format.js";

export function StatusCard({ order, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(String(order.status));

  const [save, busy] = useAction(async () => {
    try {
      await ordersApi.updateStatus(order.id, value);
      toast(`Status updated to ${statusOf(value).label}`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  // Node's flat permission model has no per-status target restriction —
  // orders.status.update allows setting any status.
  const cur = String(order.status);
  const options = can("orders.status.update") ? STATUS_ORDER : [cur];
  const canSetAny = options.some((s) => String(s) !== cur);
  if (!canSetAny) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Order status</h3>
      </div>
      <div className="card-body row">
        <select
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {statusOf(s).label}
            </option>
          ))}
        </select>
        <button
          className="btn primary"
          onClick={save}
          disabled={busy || value === String(order.status)}
        >
          {busy ? "…" : "Update"}
        </button>
      </div>
    </div>
  );
}
