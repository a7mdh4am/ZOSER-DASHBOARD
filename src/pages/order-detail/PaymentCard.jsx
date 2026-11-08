import { useState } from "react";
import { Can } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { fmtDate, money2 } from "../../lib/format.js";

export function PaymentCard({ order, financial, deposits, onChanged }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");

  const [addDeposit, busy] = useAction(async () => {
    try {
      await ordersApi.addDeposit(order.id, Number(amount));
      toast("Deposit recorded");
      setAmount("");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Payment</h3>
      </div>
      <div className="card-body">
        <div className="price-rows">
          <div className="pr">
            <span className="muted">Subtotal</span>
            <span className="mono">{money2(financial.gross)}</span>
          </div>
          {financial.discount > 0 && (
            <div className="pr good">
              <span>
                Discount
                {order.applied_coupon ? ` · ${order.applied_coupon}` : ""}
              </span>
              <span className="mono">−{money2(financial.discount)}</span>
            </div>
          )}
          {financial.shipping != null && (
            <div className="pr">
              <span className="muted">Shipping</span>
              <span className="mono">{money2(financial.shipping)}</span>
            </div>
          )}
          <div className="pr">
            <span className="strong">Order total</span>
            <span className="mono strong">{money2(financial.net_total)}</span>
          </div>

          {deposits.map((d) => (
            <div className="pr good" key={d.id}>
              <span>
                Deposit{" "}
                <span className="muted small">· {fmtDate(d.created_at)}</span>
              </span>
              <span className="mono">−{money2(d.value)}</span>
            </div>
          ))}

          <div className="pr total">
            <span>Remaining balance</span>
            <span
              className="mono"
              style={{
                color: financial.remaining <= 0 ? "var(--good)" : undefined,
              }}
            >
              {money2(financial.remaining)}
            </span>
          </div>
        </div>

        <Can perm="finance.deposit.add">
          <form
            className="row"
            style={{ marginTop: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              addDeposit();
            }}
          >
            <input
              className="input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Deposit amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <button className="btn primary" disabled={busy || !amount}>
              {busy ? "Saving…" : "Add deposit"}
            </button>
          </form>
        </Can>
      </div>
    </div>
  );
}
