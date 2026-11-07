// Finance > Payments: deposits and cash on delivery.

import { StatCard } from "../../components/charts.jsx";
import { money } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { pct, useSection } from "./shared.js";

export function PaymentsTab({ filters }) {
  const hook = useSection("payments", filters);

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const totals = d.carriers.reduce(
          (acc, c) => ({
            delivered: acc.delivered + Number(c.delivered),
            returned: acc.returned + Number(c.returned),
            cancelled: acc.cancelled + Number(c.cancelled),
            in_transit: acc.in_transit + Number(c.in_transit),
            cod: acc.cod + Number(c.cod_collected),
            pending: acc.pending + Number(c.cod_pending),
          }),
          {
            delivered: 0,
            returned: 0,
            cancelled: 0,
            in_transit: 0,
            cod: 0,
            pending: 0,
          },
        );
        const settled = totals.delivered + totals.returned + totals.cancelled;

        return (
          <div className="stack">
            <div className="stat-grid">
              <StatCard
                label="Deposits collected"
                value={money(d.deposits.total)}
                deltaLabel={`${d.deposits.n} deposit entries`}
              />
              <StatCard
                label="COD collected"
                value={money(totals.cod)}
                deltaLabel={`${totals.delivered} delivered shipments`}
              />
              <StatCard
                label="COD pending"
                value={money(totals.pending)}
                deltaLabel={`${totals.in_transit} shipments in transit`}
              />
              <StatCard
                label="Failed deliveries"
                value={totals.returned + totals.cancelled}
                deltaLabel="returned + cancelled shipments"
              />
              <StatCard
                label="Delivery success rate"
                value={settled > 0 ? pct(totals.delivered / settled) : "—"}
                deltaLabel="delivered ÷ settled shipments"
              />
            </div>
            <FormulaBox
              items={[
                [
                  "Payment methods",
                  "deposits (recorded in the ledger) + cash-on-delivery via couriers — no card gateway exists in the schema",
                ],
                [
                  "COD collected",
                  "SUM(cod_amount) of shipments with status='delivered'",
                ],
                [
                  "Success rate",
                  "delivered ÷ (delivered + returned + cancelled)",
                ],
              ]}
            />
            <div className="card">
              <div className="card-head">
                <h3>Courier performance</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Courier</th>
                      <th className="num">Shipments</th>
                      <th className="num">Delivered</th>
                      <th className="num">In transit</th>
                      <th className="num">Returned</th>
                      <th className="num">Success</th>
                      <th className="num">COD collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.carriers.map((c) => {
                      const cs =
                        Number(c.delivered) +
                        Number(c.returned) +
                        Number(c.cancelled);
                      return (
                        <tr key={c.carrier}>
                          <td className="strong">{c.carrier.toUpperCase()}</td>
                          <td className="num">{c.shipments}</td>
                          <td className="num">{c.delivered}</td>
                          <td className="num">{c.in_transit}</td>
                          <td className="num">{c.returned}</td>
                          <td className="num">
                            {cs > 0 ? pct(Number(c.delivered) / cs) : "—"}
                          </td>
                          <td className="num strong">
                            {money(c.cod_collected)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }}
    </SectionShell>
  );
}
