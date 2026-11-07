// Finance > Refunds.

import { AreaChart, StatCard } from "../../components/charts.jsx";
import { Empty } from "../../components/ui.jsx";
import { fmtDate, money } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { shortMoney, pct, useSection } from "./shared.js";

export function RefundsTab({ filters }) {
  const hook = useSection("refunds", filters);
  const overview = useSection("overview", filters, { granularity: "month" });

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const netRev = Number(overview.data?.summary?.orders?.net_revenue || 0);
        return (
          <div className="stack">
            <div className="stat-grid">
              <StatCard
                label="Refunded"
                value={money(d.totals.total)}
                deltaLabel={`${d.totals.n} refunded orders`}
              />
              <StatCard
                label="Refund rate"
                value={netRev > 0 ? pct(Number(d.totals.total) / netRev) : "—"}
                deltaLabel="refunds ÷ net revenue"
              />
            </div>
            <FormulaBox
              items={[
                [
                  "Refunds",
                  "orders with payment_status = 'refunded' (set from the order's payment-status control)",
                ],
              ]}
            />
            {d.trend.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Refund trend (monthly)</h3>
                </div>
                <div className="card-body">
                  <AreaChart
                    data={d.trend.map((t) => ({
                      x: t.period,
                      y: Number(t.total),
                    }))}
                    formatY={shortMoney}
                    color="var(--st-cancelled)"
                  />
                </div>
              </div>
            )}
            <div className="card">
              <div className="card-head">
                <h3>Recent refunds</h3>
              </div>
              {d.recent.length === 0 ? (
                <Empty title="No refunds recorded" />
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Order</th>
                        <th>Product</th>
                        <th>Notes</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recent.map((r) => (
                        <tr key={r.id}>
                          <td className="small muted">
                            {fmtDate(r.created_at)}
                          </td>
                          <td>#{r.order_id}</td>
                          <td>{r.product_name || "—"}</td>
                          <td>{r.description || "—"}</td>
                          <td
                            className="num strong"
                            style={{ color: "var(--danger)" }}
                          >
                            −{money(r.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </SectionShell>
  );
}
