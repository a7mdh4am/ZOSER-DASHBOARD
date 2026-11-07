// Finance > Products.

import { BarList } from "../../components/charts.jsx";
import { IconDownload } from "../../components/Icons.jsx";
import { Badge } from "../../components/ui.jsx";
import { downloadCsv } from "../../lib/csv.js";
import { money } from "../../lib/format.js";
import { SectionShell } from "./parts.jsx";
import { useSection } from "./shared.js";

export function ProductsTab({ filters }) {
  const hook = useSection("products", filters);

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const perf = d.performance;
        const withProfit = perf.filter((p) => p.profit != null);
        return (
          <div className="stack">
            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <h3>Top 10 by net revenue</h3>
                </div>
                <div className="card-body">
                  <BarList
                    data={perf.slice(0, 10).map((p) => ({
                      id: p.id,
                      name: p.name,
                      value: Number(p.net),
                    }))}
                    formatV={money}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card-head">
                  <h3>Best sellers (orders)</h3>
                </div>
                <div className="card-body">
                  <BarList
                    data={[...perf]
                      .sort((a, b) => b.orders - a.orders)
                      .slice(0, 10)
                      .map((p) => ({
                        id: p.id,
                        name: p.name,
                        value: Number(p.orders),
                      }))}
                    formatV={(v) => v.toLocaleString()}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Product performance</h3>
                <div className="grow" />
                <button
                  className="btn sm no-print"
                  onClick={() => downloadCsv("products", perf)}
                >
                  <IconDownload /> CSV
                </button>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Orders</th>
                      <th className="num">Cards</th>
                      <th className="num">Net revenue</th>
                      <th className="num">Avg / order</th>
                      <th className="num">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((p) => (
                      <tr key={p.id ?? p.name}>
                        <td className="strong">{p.name}</td>
                        <td className="num">{p.orders}</td>
                        <td className="num">{p.cards}</td>
                        <td className="num strong">{money(p.net)}</td>
                        <td className="num">{money(p.avg_net)}</td>
                        <td className="num">
                          {p.profit != null ? (
                            <span
                              style={{
                                color:
                                  p.profit >= 0
                                    ? "var(--good)"
                                    : "var(--danger)",
                              }}
                            >
                              {money(p.profit)}
                            </span>
                          ) : (
                            <span className="muted small">no cost set</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {withProfit.length > 0 && (
              <div className="grid-2">
                <div className="card">
                  <div className="card-head">
                    <h3>Highest profit</h3>
                  </div>
                  <div className="card-body">
                    <BarList
                      data={[...withProfit]
                        .sort((a, b) => b.profit - a.profit)
                        .slice(0, 5)
                        .map((p) => ({
                          id: p.id,
                          name: p.name,
                          value: Number(p.profit),
                        }))}
                      formatV={money}
                    />
                  </div>
                </div>
                <div className="card">
                  <div className="card-head">
                    <h3>Lowest profit</h3>
                  </div>
                  <div className="card-body">
                    <BarList
                      data={[...withProfit]
                        .sort((a, b) => a.profit - b.profit)
                        .slice(0, 5)
                        .map((p) => ({
                          id: p.id,
                          name: p.name,
                          value: Number(p.profit),
                        }))}
                      formatV={money}
                    />
                  </div>
                </div>
              </div>
            )}

            {d.never_sold.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Never sold ({d.never_sold.length})</h3>
                </div>
                <div className="card-body row wrap">
                  {d.never_sold.map((p) => (
                    <Badge
                      key={p.id ?? p.name}
                      color="var(--ink-3)"
                      dot={false}
                    >
                      {p.name}
                      {!p.is_active && " (inactive)"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }}
    </SectionShell>
  );
}
