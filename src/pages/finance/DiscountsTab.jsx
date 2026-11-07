// Finance > Discounts.

import { BarList, StatCard } from "../../components/charts.jsx";
import { Empty } from "../../components/ui.jsx";
import { money } from "../../lib/format.js";
import { SectionShell } from "./parts.jsx";
import { useSection } from "./shared.js";

export function DiscountsTab({ filters }) {
  const hook = useSection("discounts", filters);

  return (
    <SectionShell hook={hook}>
      {(d) => (
        <div className="stack">
          <div className="stat-grid">
            <StatCard
              label="Couponed orders"
              value={d.totals.couponed_orders}
              deltaLabel={`${Math.round((d.totals.couponed_orders / Math.max(1, d.totals.orders)) * 100)}% of orders`}
            />
            <StatCard
              label="Revenue lost to discounts"
              value={money(d.totals.discount_total)}
              deltaLabel="SUM(discount_amount)"
            />
            <StatCard
              label="Average discount"
              value={money(d.totals.avg_discount)}
              deltaLabel="among discounted orders"
            />
          </div>
          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>Most used coupons</h3>
              </div>
              <div className="card-body">
                {d.per_coupon.length ? (
                  <BarList
                    data={d.per_coupon
                      .slice(0, 8)
                      .map((c) => ({ name: c.coupon, value: Number(c.uses) }))}
                    formatV={(v) => `${v} uses`}
                  />
                ) : (
                  <Empty title="No coupons used in this range" />
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Coupon economics</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Coupon</th>
                      <th className="num">Uses</th>
                      <th className="num">Discount given</th>
                      <th className="num">Order total brought</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.per_coupon.map((c) => (
                      <tr key={c.coupon}>
                        <td className="strong mono">{c.coupon}</td>
                        <td className="num">{c.uses}</td>
                        <td className="num text-danger">
                          −{money(c.discount_total)}
                        </td>
                        <td className="num strong">{money(c.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}
