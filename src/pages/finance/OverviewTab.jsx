// Finance > Overview: KPIs, revenue analytics, alerts.

import { useEffect, useState } from "react";
import {
  AreaChart,
  BarList,
  Donut,
  StatCard,
} from "../../components/charts.jsx";
import { IconRefresh } from "../../components/Icons.jsx";
import { Empty, Segmented } from "../../components/ui.jsx";
import { money, statusOf, STATUS_ORDER } from "../../lib/format.js";
import { FormulaBox, SectionShell } from "./parts.jsx";
import { shortMoney, useSection } from "./shared.js";

export function OverviewTab({ filters, onOptions }) {
  const [granularity, setGranularity] = useState("day");
  const [metric, setMetric] = useState("net");
  const hook = useSection("overview", filters, { granularity });

  useEffect(() => {
    if (hook.data?.options) onOptions(hook.data.options);
  }, [hook.data, onOptions]);

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const o = d.summary.orders;
        const l = d.summary.ledger;
        const s = d.summary.shipping;
        const dv = d.summary.derived;
        const series = d.series.map((r) => ({
          x: String(r.period),
          y: Number(r[metric]),
        }));

        return (
          <div className="stack">
            {d.alerts.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                {d.alerts.map((a, i) => (
                  <div key={i} className={`alert-card ${a.level}`}>
                    <span aria-hidden>{a.level === "warn" ? "⚠️" : "📈"}</span>
                    <div>
                      <div className="a-title">{a.title}</div>
                      <div className="a-detail">{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="stat-grid">
              <StatCard
                label="Gross revenue"
                value={money(o.gross_revenue)}
                deltaLabel="subtotal, excl. cancelled"
              />
              <StatCard
                label="Net revenue"
                value={money(o.net_revenue)}
                deltaLabel="gross − discounts"
              />
              <StatCard
                label="Orders"
                value={Number(o.total_orders).toLocaleString()}
                deltaLabel={`${o.cancelled_orders} cancelled`}
              />
              <StatCard
                label="Paid orders"
                value={o.paid_orders}
                deltaLabel={`${o.pending_orders} pending · ${o.deposited_orders} deposited`}
              />
              <StatCard
                label="Average order value"
                value={money(dv.aov)}
                deltaLabel="net revenue ÷ non-cancelled orders"
              />
              <StatCard
                label="Total discounts"
                value={money(o.total_discounts)}
                deltaLabel="coupon money given away"
              />
              <StatCard
                label="Outstanding payments"
                value={money(o.outstanding)}
                deltaLabel="unpaid balance on active orders"
              />
              <StatCard
                label="Pending revenue"
                value={money(o.pending_revenue)}
                deltaLabel="total of Pending-status orders"
              />
              <StatCard
                label="Refunded"
                value={money(l.refunds)}
                deltaLabel={`${l.refund_count || 0} refunds`}
              />
              <StatCard
                label="Shipping charged"
                value={money(s.shipping_charged)}
                deltaLabel="SUM(shipping_fee), excl. cancelled"
              />
              <StatCard
                label="Gross profit"
                value={dv.cost_configured ? money(dv.gross_profit) : "—"}
                deltaLabel={
                  dv.cost_configured
                    ? "net revenue − COGS"
                    : "set product costs in the Profit tab"
                }
              />
              <StatCard
                label="Net profit"
                value={money(dv.net_profit)}
                deltaLabel="net − refunds − expenses − COGS"
              />
            </div>

            <FormulaBox
              items={[
                [
                  "Gross revenue",
                  "SUM(subtotal) over non-cancelled orders in range",
                ],
                ["Net revenue", "gross − SUM(discount_amount)"],
                ["Paid order", "payment_status = 'paid'"],
                ["AOV", "net revenue ÷ count(non-cancelled orders)"],
                [
                  "Outstanding",
                  "SUM(grand_total − deposits) over deposited/production/shipped orders still short",
                ],
                [
                  "Pending revenue",
                  "SUM(grand_total) of Pending-status orders",
                ],
                [
                  "Gross profit",
                  "net revenue − COGS (unit cost × cards, from the Profit tab)",
                ],
                ["Net profit", "net revenue − refunds − expenses − COGS"],
                ["Taxes", "not tracked in the schema — no tax fields exist"],
              ]}
            />

            <div className="card">
              <div className="card-head">
                <h3>Revenue</h3>
                <div className="grow" />
                <Segmented
                  label="Group by"
                  value={granularity}
                  onChange={setGranularity}
                  options={[
                    ["day", "Day"],
                    ["week", "Week"],
                    ["month", "Month"],
                    ["year", "Year"],
                  ]}
                />
                <Segmented
                  label="Metric"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    ["net", "Net"],
                    ["gross", "Gross"],
                    ["orders", "Orders"],
                    ["discounts", "Discounts"],
                  ]}
                />
                <button
                  className="btn ghost icon"
                  onClick={hook.reload}
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <IconRefresh />
                </button>
              </div>
              <div className="card-body">
                {series.length ? (
                  <AreaChart
                    data={series}
                    formatY={(v) =>
                      metric === "orders"
                        ? Math.round(v).toLocaleString()
                        : shortMoney(v)
                    }
                  />
                ) : (
                  <Empty title="No data in this range" />
                )}
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <h3>Net revenue by product</h3>
                </div>
                <div className="card-body">
                  <BarList
                    data={d.breakdowns.by_product.map((r) => ({
                      name: r.name,
                      value: Number(r.net),
                    }))}
                    formatV={money}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card-head">
                  <h3>Order mix by status</h3>
                </div>
                <div className="card-body">
                  <Donut
                    data={[...d.breakdowns.by_status] // a copy: d is shared with the section cache
                      .sort(
                        (a, b) =>
                          STATUS_ORDER.indexOf(String(a.status)) -
                          STATUS_ORDER.indexOf(String(b.status)),
                      )
                      .map((r) => ({
                        name: statusOf(r.status).label,
                        value: Number(r.orders),
                        color: statusOf(r.status).color,
                      }))}
                    formatV={(v) => Math.round(v).toLocaleString()}
                  />
                </div>
              </div>
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="card-head">
                  <h3>Net revenue by city</h3>
                </div>
                <div className="card-body">
                  <BarList
                    data={d.breakdowns.by_city.map((r) => ({
                      name: r.name || "—",
                      value: Number(r.net),
                    }))}
                    formatV={money}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </SectionShell>
  );
}
