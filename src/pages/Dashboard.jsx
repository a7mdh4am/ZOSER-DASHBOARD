import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, BarList, StatCard } from "../components/charts.jsx";
import { Empty, OrderLink, Spinner, StatusBadge } from "../components/ui.jsx";
import { IconRefresh } from "../components/Icons.jsx";
import { dashboardApi } from "../lib/api.js";
import { localISODate } from "../lib/dates.js";
import { fmtDate, money, statusOf, STATUS_ORDER } from "../lib/format.js";

const shortMoney = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
};

function pctDelta(now, prev) {
  const p = Number(prev) || 0;
  const n = Number(now) || 0;
  if (p === 0) return null;
  return ((n - p) / p) * 100;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [metric, setMetric] = useState("revenue");
  const navigate = useNavigate();

  const load = () =>
    dashboardApi
      .get()
      .then(setData)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const series = useMemo(() => {
    if (!data) return [];
    // Fill the 30-day range so quiet days show as zero instead of a gap.
    const byDay = Object.fromEntries(data.daily_series.map((d) => [d.day, d]));
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const row = byDay[localISODate(d)];
      out.push({
        x: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        y: row
          ? Number(metric === "revenue" ? row.revenue : row.order_count)
          : 0,
      });
    }
    return out;
  }, [data, metric]);

  const statusRows = useMemo(() => {
    if (!data) return [];
    const counts = Object.fromEntries(
      data.status_breakdown.map((r) => [
        String(r.status),
        Number(r.order_count),
      ]),
    );
    return STATUS_ORDER.filter((s) => counts[s]).map((s) => ({
      name: statusOf(s).label,
      value: counts[s],
      status: s,
    }));
  }, [data]);

  if (error) return <Empty title="Couldn't load the dashboard" hint={error} />;
  if (!data)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

  const s = data.summary;
  const orderDelta = pctDelta(s.this_month_orders, s.last_month_orders);
  const revDelta = pctDelta(s.this_month_revenue, s.last_month_revenue);

  return (
    <div className="stack">
      <div className="stat-grid">
        <StatCard
          label="Net revenue"
          value={money(s.net_revenue)}
          delta={revDelta}
          deltaLabel="vs last month"
        />
        <StatCard
          label="Orders"
          value={Number(s.total_orders).toLocaleString()}
          delta={orderDelta}
          deltaLabel="vs last month"
        />
        <StatCard
          label="Deposits collected"
          value={money(s.deposits_collected)}
          deltaLabel={`${s.deposited_orders} orders awaiting production`}
        />
        <StatCard
          label="In production"
          value={s.production_orders}
          deltaLabel={`${s.shipped_orders} shipped · ${s.pending_orders} pending`}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Last 30 days</h3>
          <div className="grow" />
          <div className="seg" role="group" aria-label="Metric">
            <button
              className={metric === "revenue" ? "active" : ""}
              aria-pressed={metric === "revenue"}
              onClick={() => setMetric("revenue")}
            >
              Revenue
            </button>
            <button
              className={metric === "orders" ? "active" : ""}
              aria-pressed={metric === "orders"}
              onClick={() => setMetric("orders")}
            >
              Orders
            </button>
          </div>
          <button
            className="btn ghost icon"
            onClick={load}
            title="Refresh"
            aria-label="Refresh"
          >
            <IconRefresh />
          </button>
        </div>
        <div className="card-body">
          <AreaChart
            data={series}
            formatY={(v) =>
              metric === "revenue"
                ? shortMoney(v)
                : Math.round(v).toLocaleString()
            }
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Orders by status</h3>
          </div>
          <div className="card-body">
            {statusRows.length ? (
              <BarList
                data={statusRows}
                formatV={(v) => v.toLocaleString()}
                color={(d) => statusOf(d.status).color}
              />
            ) : (
              <Empty title="No orders yet" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Product performance</h3>
          </div>
          <div className="card-body">
            {data.product_performance.length ? (
              <BarList
                data={data.product_performance.map((p) => ({
                  name: p.product_name,
                  value: Number(p.total_revenue),
                }))}
                formatV={(v) => money(v)}
              />
            ) : (
              <Empty title="No product data" />
            )}
          </div>
        </div>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-head">
            <h3>Recent orders</h3>
            <div className="grow" />
            <button
              className="btn sm ghost"
              onClick={() => navigate("/orders")}
            >
              View all
            </button>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((o) => (
                  <tr
                    key={o.id}
                    className="row-link"
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td>
                      <div className="strong">
                        <OrderLink id={o.id} />
                      </div>
                      <div className="small muted">{fmtDate(o.order_time)}</div>
                    </td>
                    <td>
                      <div>{o.full_name}</div>
                      <div className="small muted">{o.product_name}</div>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="num strong">{money(o.net_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Top zones</h3>
          </div>
          <div className="card-body">
            {data.top_zones.length ? (
              <BarList
                data={data.top_zones.map((z) => ({
                  name: z.zone || "—",
                  value: Number(z.order_count),
                }))}
                formatV={(v) => v.toLocaleString()}
              />
            ) : (
              <Empty title="No zone data" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
