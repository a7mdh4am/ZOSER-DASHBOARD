// Finance > Customers.

import { StatCard } from "../../components/charts.jsx";
import { IconDownload } from "../../components/Icons.jsx";
import { downloadCsv } from "../../lib/csv.js";
import { fmtDate, money } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { pct, useSection } from "./shared.js";

export function CustomersTab({ filters }) {
  const hook = useSection("customers", filters);

  return (
    <SectionShell hook={hook}>
      {(d) => (
        <div className="stack">
          <div className="stat-grid">
            <StatCard
              label="Customers"
              value={d.aggregates.customers}
              deltaLabel="unique phone numbers"
            />
            <StatCard
              label="Returning"
              value={d.aggregates.returning}
              deltaLabel={`repeat rate ${pct(d.aggregates.repeat_rate)}`}
            />
            <StatCard
              label="One-time"
              value={d.aggregates.one_time}
              deltaLabel="single order so far"
            />
            <StatCard
              label="Avg spend"
              value={money(d.aggregates.avg_spend)}
              deltaLabel="net revenue ÷ customers, in range"
            />
          </div>
          <FormulaBox
            items={[
              [
                "Customer",
                "orders grouped by normalized phone number (the schema has no account link)",
              ],
              [
                "Spend",
                "SUM(grand_total) of the customer's non-cancelled orders in the selected range",
              ],
              ["Returning", "customers with more than one order in range"],
            ]}
          />
          <div className="card">
            <div className="card-head">
              <h3>Top customers</h3>
              <div className="grow" />
              <button
                className="btn sm no-print"
                onClick={() => downloadCsv("customers", d.top)}
              >
                <IconDownload /> CSV
              </button>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th className="num">Orders</th>
                    <th className="num">Spend</th>
                    <th className="num">Avg order</th>
                    <th>Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {d.top.map((c) => (
                    <tr key={c.phone}>
                      <td className="strong">{c.full_name}</td>
                      <td className="mono small">{c.phone}</td>
                      <td className="num">{c.orders}</td>
                      <td className="num strong">{money(c.lifetime_net)}</td>
                      <td className="num">{money(c.avg_order)}</td>
                      <td className="small muted">{fmtDate(c.last_order)}</td>
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
