// Finance > Shipping.

import { StatCard } from "../../components/charts.jsx";
import { money } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { useSection } from "./shared.js";

export function ShippingTab({ filters }) {
  const hook = useSection("shipping", filters);

  return (
    <SectionShell hook={hook}>
      {(d) => (
        <div className="stack">
          <div className="stat-grid">
            <StatCard
              label="Shipping charged"
              value={money(d.totals.fee_charged)}
              deltaLabel={`${d.totals.shipments} shipments recorded`}
            />
            <StatCard
              label="Average fee"
              value={money(d.totals.avg_fee)}
              deltaLabel="per order in range"
            />
          </div>
          <FormulaBox
            items={[
              ["Shipping charged", "SUM(orders.shipping_fee), excl. cancelled"],
              [
                "Delivered / returned / COD",
                "from the shipments table — no courier-cost or margin field exists in the schema",
              ],
            ]}
          />
          <div className="card">
            <div className="card-head">
              <h3>Shipments by region</h3>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th className="num">Orders</th>
                    <th className="num">Shipments</th>
                    <th className="num">Delivered</th>
                    <th className="num">Returned</th>
                    <th className="num">COD collected</th>
                  </tr>
                </thead>
                <tbody>
                  {d.by_region.map((r) => (
                    <tr key={r.name}>
                      <td className="strong">{r.name || "—"}</td>
                      <td className="num">{r.order_count}</td>
                      <td className="num">{r.shipments}</td>
                      <td className="num">{r.delivered}</td>
                      <td className="num">{r.returned}</td>
                      <td className="num strong">{money(r.cod_collected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}
