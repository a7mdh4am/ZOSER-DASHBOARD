import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  BarList,
  Donut,
  GroupedBars,
  StatCard,
} from "../components/charts.jsx";
import { IconDownload, IconPlus, IconRefresh } from "../components/Icons.jsx";
import {
  Can,
  Empty,
  Modal,
  OrderLink,
  Pager,
  SearchInput,
  Spinner,
  StatusBadge,
} from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { financeApi } from "../lib/api.js";
import { datedFileName, downloadCsv, saveFile } from "../lib/csv.js";
import { localISODate } from "../lib/dates.js";
import { fmtDate, money, statusOf, STATUS_ORDER } from "../lib/format.js";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const shortMoney = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
};

const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;

const PAYMENT_STATUS_COLOR = {
  paid: "var(--st-paid)",
  pending: "var(--st-deposited)",
  unpaid: "var(--st-pending)",
  failed: "var(--st-cancelled)",
  refunded: "var(--st-cancelled)",
};

const PRESETS = [
  ["all", "All time"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
  ["90", "Last 90 days"],
  ["mtd", "This month"],
  ["ytd", "This year"],
  ["custom", "Custom"],
];

function presetRange(preset) {
  const iso = localISODate;
  const now = new Date();
  if (preset === "all") return { from: "", to: "" };
  if (preset === "mtd")
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: iso(now),
    };
  if (preset === "ytd")
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  const d = new Date();
  d.setDate(d.getDate() - Number(preset));
  return { from: iso(d), to: iso(now) };
}

function qs(filters, extra = {}) {
  const p = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
    if (v !== "" && v != null) p.set(k, v);
  });
  return p.toString();
}

/**
 * Fetch a finance section, cached by section + query so switching tabs back
 * and forth is instant. The cache is emptied when you leave the Finance page
 * (see Finance below), so edits made elsewhere show up when you come back.
 */
const sectionCache = new Map();
function useSection(section, filters, extra = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const query = qs(filters, extra);
  const url = `${section}?${query}`;

  const load = useCallback(
    (fresh = false) => {
      setLoading(true);
      setError("");
      if (!fresh && sectionCache.has(url)) {
        setData(sectionCache.get(url));
        setLoading(false);
        return Promise.resolve();
      }
      return financeApi
        .section(section, query)
        .then((d) => {
          sectionCache.set(url, d);
          setData(d);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [section, query, url],
  );

  // Fetch on mount and whenever the filters change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flags loading first
    load();
  }, [load]);

  return {
    data,
    error,
    loading,
    reload: () => {
      sectionCache.delete(url);
      return load(true);
    },
  };
}

function FormulaBox({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="no-print">
      <button className="btn ghost sm" onClick={() => setOpen(!open)}>
        ⓘ How are these calculated?
      </button>
      {open && (
        <div className="formula-box" style={{ marginTop: 8 }}>
          {items.map(([name, formula]) => (
            <div key={name}>
              <strong>{name}</strong> — <code>{formula}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionShell({ hook, children }) {
  if (hook.error)
    return <Empty title="Couldn't load this section" hint={hook.error} />;
  if (!hook.data)
    return (
      <div style={{ padding: 50 }}>
        <Spinner />
      </div>
    );
  return children(hook.data);
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

const TABS = [
  ["overview", "Overview"],
  ["orders", "Orders"],
  ["products", "Products"],
  ["customers", "Customers"],
  ["payments", "Payments"],
  ["discounts", "Discounts"],
  ["shipping", "Shipping"],
  ["refunds", "Refunds"],
  ["profit", "Profit"],
  ["cashflow", "Cash flow"],
];

export default function Finance() {
  const [tab, setTab] = useState("overview");
  const [preset, setPreset] = useState("all");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    status: "",
    productId: "",
    cityId: "",
  });
  const [options, setOptions] = useState({ cities: [], products: [] });

  // A deposit or status change made on an order page should show here next time.
  useEffect(() => () => sectionCache.clear(), []);

  const applyPreset = (p) => {
    setPreset(p);
    // 'custom' keeps the current from/to and lets the user pick them below.
    if (p !== "custom") setFilters((f) => ({ ...f, ...presetRange(p) }));
  };

  const setDate = (key) => (e) => {
    setPreset("custom");
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <div className="stack">
      {/* filters shared by every tab */}
      <div className="row wrap no-print">
        <div className="chips" style={{ flex: "1 1 auto" }}>
          {PRESETS.map(([v, l]) => (
            <button
              key={v}
              className={`chip${preset === v ? " active" : ""}`}
              onClick={() => applyPreset(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <button className="btn sm no-print" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>
      {preset === "custom" && (
        <div
          className="row wrap no-print"
          style={{ gap: 10, alignItems: "flex-end" }}
        >
          <label className="field">
            <span>From</span>
            <input
              className="input"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={setDate("from")}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              className="input"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={setDate("to")}
            />
          </label>
          <span className="small muted">
            {filters.from || filters.to
              ? `Showing ${filters.from || "…"} → ${filters.to || "today"}`
              : "Pick a start and end date"}
          </span>
        </div>
      )}
      <div className="row wrap no-print">
        <select
          className="input"
          style={{ width: "auto" }}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {statusOf(s).label}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: "auto" }}
          value={filters.productId}
          onChange={(e) =>
            setFilters({ ...filters, productId: e.target.value })
          }
        >
          <option value="">All products</option>
          {options.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: "auto" }}
          value={filters.cityId}
          onChange={(e) => setFilters({ ...filters, cityId: e.target.value })}
        >
          <option value="">All cities</option>
          {options.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* tabs */}
      <div
        className="chips no-print"
        role="group"
        aria-label="Finance sections"
      >
        {TABS.map(([v, l]) => (
          <button
            key={v}
            className={`chip${tab === v ? " active" : ""}`}
            aria-pressed={tab === v}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab filters={filters} onOptions={setOptions} />
      )}
      {tab === "orders" && <OrdersTab filters={filters} />}
      {tab === "products" && <ProductsTab filters={filters} />}
      {tab === "customers" && <CustomersTab filters={filters} />}
      {tab === "payments" && <PaymentsTab filters={filters} />}
      {tab === "discounts" && <DiscountsTab filters={filters} />}
      {tab === "shipping" && <ShippingTab filters={filters} />}
      {tab === "refunds" && <RefundsTab filters={filters} />}
      {tab === "profit" && <ProfitTab filters={filters} />}
      {tab === "cashflow" && <CashflowTab filters={filters} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview: KPIs, revenue analytics, alerts                           */
/* ------------------------------------------------------------------ */

function OverviewTab({ filters, onOptions }) {
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
                <div className="seg">
                  {["day", "week", "month", "year"].map((g) => (
                    <button
                      key={g}
                      className={granularity === g ? "active" : ""}
                      onClick={() => setGranularity(g)}
                    >
                      {g[0].toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="seg">
                  {[
                    ["net", "Net"],
                    ["gross", "Gross"],
                    ["orders", "Orders"],
                    ["discounts", "Discounts"],
                  ].map(([v, lbl]) => (
                    <button
                      key={v}
                      className={metric === v ? "active" : ""}
                      onClick={() => setMetric(v)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
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

/* ------------------------------------------------------------------ */
/* Orders financial report                                             */
/* ------------------------------------------------------------------ */

function OrdersTab({ filters }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("order_time");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const toast = useToast();

  const query = qs(filters, { search, sort, dir, page, perPage: 25 });

  // Every matching order, not just this page.
  const [exportCsv] = useAction(async () => {
    try {
      saveFile(
        datedFileName("orders"),
        await financeApi.ordersCsv(qs(filters, { search, sort, dir })),
      );
    } catch (err) {
      toast(err.message, "err");
    }
  });

  useEffect(() => {
    let alive = true;
    financeApi
      .orders(query)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [query]);

  const th = (key, label, numeric = false) => (
    <th
      className={`sortable${numeric ? " num" : ""}`}
      onClick={() => {
        setDir(sort === key && dir === "desc" ? "asc" : "desc");
        setSort(key);
        setPage(1);
      }}
    >
      {label}
      {sort === key ? (dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  if (error) return <Empty title="Couldn't load the report" hint={error} />;

  return (
    <div className="stack">
      <div className="row wrap no-print">
        <div className="grow" style={{ minWidth: 220, maxWidth: 400 }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Order id, name, phone…"
          />
        </div>
        <button className="btn sm" onClick={exportCsv}>
          <IconDownload /> CSV / Excel
        </button>
      </div>

      <div className="card">
        {!data ? (
          <div style={{ padding: 50 }}>
            <Spinner />
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {th("id", "Order")}
                    {th("order_time", "Date")}
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Price</th>
                    <th className="num">Discount</th>
                    {th("net", "Total", true)}
                    {th("paid", "Paid", true)}
                    {th("balance", "Balance", true)}
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={r.id}
                      className="row-link"
                      onClick={() => navigate(`/orders/${r.id}`)}
                    >
                      <td className="strong">
                        <OrderLink id={r.id} />
                      </td>
                      <td className="small muted">{fmtDate(r.order_time)}</td>
                      <td>
                        <div>{r.full_name}</div>
                        <div className="small muted">
                          {r.product_name} · {r.city || "—"}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="num">{money(r.price)}</td>
                      <td className="num">
                        {Number(r.discount_amount) > 0
                          ? `−${money(r.discount_amount)}`
                          : "—"}
                      </td>
                      <td className="num strong">{money(r.net)}</td>
                      <td className="num">
                        {Number(r.dep) > 0 ? money(r.dep) : "—"}
                      </td>
                      <td className="num">{money(r.balance)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            "--badge-c": PAYMENT_STATUS_COLOR[r.payment_status],
                          }}
                        >
                          <span className="dot" />
                          {r.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={data.page}
              perPage={data.perPage}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>
      <FormulaBox
        items={[
          [
            "Total",
            "grand_total (subtotal + shipping − discount + adjustments)",
          ],
          ["Paid", "SUM of active deposit ledger entries linked to the order"],
          ["Balance", "total − paid"],
          [
            "Payment",
            "order's payment_status: unpaid / pending / paid / failed / refunded",
          ],
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function ProductsTab({ filters }) {
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
                    <span
                      key={p.id ?? p.name}
                      className="badge"
                      style={{ "--badge-c": "var(--ink-3)" }}
                    >
                      {p.name}
                      {!p.is_active && " (inactive)"}
                    </span>
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

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

function CustomersTab({ filters }) {
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

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

function PaymentsTab({ filters }) {
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

/* ------------------------------------------------------------------ */
/* Discounts                                                           */
/* ------------------------------------------------------------------ */

function DiscountsTab({ filters }) {
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
                        <td className="num" style={{ color: "var(--danger)" }}>
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

/* ------------------------------------------------------------------ */
/* Shipping                                                             */
/* ------------------------------------------------------------------ */

function ShippingTab({ filters }) {
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

/* ------------------------------------------------------------------ */
/* Refunds                                                              */
/* ------------------------------------------------------------------ */

function RefundsTab({ filters }) {
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

/* ------------------------------------------------------------------ */
/* Profit                                                               */
/* ------------------------------------------------------------------ */

function ProfitTab({ filters }) {
  const hook = useSection("profit", filters);
  const toast = useToast();
  const [editing, setEditing] = useState(null); // {id, name, unit_cost}
  const [costVal, setCostVal] = useState("");

  const [saveCost, savingCost] = useAction(async () => {
    try {
      await financeApi.setCost(editing.id, Number(costVal));
      toast(`Cost saved for ${editing.name}`);
      setEditing(null);
      sectionCache.clear();
      hook.reload();
    } catch (e) {
      toast(e.message, "err");
    }
  });

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const configured = d.cost_configured;
        const grossMargin =
          configured && Number(d.net_revenue) > 0
            ? d.gross_profit / Number(d.net_revenue)
            : null;
        const netMargin =
          Number(d.net_revenue) > 0
            ? d.net_profit / Number(d.net_revenue)
            : null;

        return (
          <div className="stack">
            {!configured && (
              <div className="alert-card warn">
                <span aria-hidden>⚠️</span>
                <div>
                  <div className="a-title">
                    Gross profit needs product costs
                  </div>
                  <div className="a-detail">
                    The schema has no product cost data, so COGS and gross
                    margin can't be computed yet. Set a unit cost per card below
                    — profit lights up immediately (net profit from recorded
                    expenses is already shown).
                  </div>
                </div>
              </div>
            )}

            <div className="stat-grid">
              <StatCard label="Net revenue" value={money(d.net_revenue)} />
              <StatCard
                label="COGS"
                value={configured ? money(d.cogs) : "—"}
                deltaLabel={
                  configured
                    ? `${d.units_missing_cost} cards missing a cost`
                    : "set costs below"
                }
              />
              <StatCard
                label="Gross profit"
                value={configured ? money(d.gross_profit) : "—"}
                deltaLabel={
                  grossMargin != null ? `margin ${pct(grossMargin)}` : undefined
                }
              />
              <StatCard
                label="Expenses"
                value={money(d.expenses)}
                deltaLabel="expense ledger entries"
              />
              <StatCard label="Refunds" value={money(d.refunds)} />
              <StatCard
                label="Net profit"
                value={money(d.net_profit)}
                deltaLabel={
                  netMargin != null ? `margin ${pct(netMargin)}` : undefined
                }
              />
            </div>
            <FormulaBox
              items={[
                [
                  "COGS",
                  "unit cost × cards in the order, summed over non-cancelled orders (only for products with a cost set)",
                ],
                ["Gross profit", "net revenue − COGS"],
                ["Net profit", "net revenue − refunds − expenses − COGS"],
                ["Margins", "profit ÷ net revenue"],
              ]}
            />

            {d.trend.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Monthly: revenue vs costs</h3>
                </div>
                <div className="card-body">
                  <GroupedBars
                    data={d.trend.map((t) => ({
                      label: t.period,
                      net: Number(t.net),
                      out:
                        Number(t.cogs) + Number(t.expenses) + Number(t.refunds),
                    }))}
                    series={[
                      {
                        key: "net",
                        label: "Net revenue",
                        color: "var(--accent)",
                      },
                      {
                        key: "out",
                        label: "COGS + expenses + refunds",
                        color: "var(--st-cancelled)",
                      },
                    ]}
                    formatV={shortMoney}
                  />
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-head">
                <h3>Unit costs (per card)</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Unit cost</th>
                      <th className="no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.costs.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td className="num">
                          {p.unit_cost != null ? (
                            money(p.unit_cost)
                          ) : (
                            <span className="muted">not set</span>
                          )}
                        </td>
                        <td className="no-print" style={{ textAlign: "right" }}>
                          <Can perm="finance.costs.manage">
                            <button
                              className="btn sm ghost"
                              onClick={() => {
                                setEditing(p);
                                setCostVal(p.unit_cost ?? "");
                              }}
                            >
                              {p.unit_cost != null ? "Update" : "Set cost"}
                            </button>
                          </Can>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editing && (
              <Modal
                title={`Unit cost — ${editing.name}`}
                onClose={() => setEditing(null)}
                footer={
                  <>
                    <button className="btn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={saveCost}
                      disabled={savingCost || !costVal || Number(costVal) < 0}
                    >
                      {savingCost ? "Saving…" : "Save"}
                    </button>
                  </>
                }
              >
                <label className="field">
                  <span>
                    Cost per card (EGP) — effective from today; history stays
                    intact
                  </span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={costVal}
                    onChange={(e) => setCostVal(e.target.value)}
                    autoFocus
                  />
                </label>
              </Modal>
            )}
          </div>
        );
      }}
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Cash flow + ledger entry form                                       */
/* ------------------------------------------------------------------ */

function CashflowTab({ filters }) {
  const hook = useSection("cashflow", filters);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    type: "expense",
    value: "",
    description: "",
    orderId: "",
  });

  const [submit, recording] = useAction(async () => {
    try {
      await financeApi.addEntry({
        type: form.type,
        value: Number(form.value),
        description: form.description,
        orderId: form.orderId ? Number(form.orderId) : undefined,
      });
      toast("Entry recorded");
      setAdding(false);
      setForm({ type: "expense", value: "", description: "", orderId: "" });
      sectionCache.clear();
      hook.reload();
    } catch (e) {
      toast(e.message, "err");
    }
  });

  return (
    <SectionShell hook={hook}>
      {(d) => {
        const inSum = d.months.reduce((s, m) => s + Number(m.money_in), 0);
        const outSum = d.months.reduce((s, m) => s + Number(m.money_out), 0);
        return (
          <div className="stack">
            <div className="row no-print">
              <div className="grow" />
              <button
                className="btn sm"
                onClick={() => downloadCsv("cashflow", d.months)}
              >
                <IconDownload /> CSV
              </button>
              <Can perm="finance.entry.add">
                <button
                  className="btn sm primary"
                  onClick={() => setAdding(true)}
                >
                  <IconPlus size={14} /> Add entry
                </button>
              </Can>
            </div>
            <div className="stat-grid">
              <StatCard
                label="Money in"
                value={money(inSum)}
                deltaLabel="deposits + other income"
              />
              <StatCard
                label="Money out"
                value={money(outSum)}
                deltaLabel="expenses"
              />
              <StatCard label="Net cash flow" value={money(inSum - outSum)} />
              <StatCard
                label="Running balance"
                value={money(
                  d.months.at(-1)?.running_balance ?? d.opening_balance,
                )}
                deltaLabel={
                  filters.from
                    ? `opening ${money(d.opening_balance)}`
                    : "entire ledger history"
                }
              />
            </div>

            {d.months.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h3>Monthly cash flow</h3>
                </div>
                <div className="card-body">
                  <GroupedBars
                    data={d.months.map((m) => ({
                      label: m.period,
                      money_in: Number(m.money_in),
                      money_out: Number(m.money_out),
                    }))}
                    series={[
                      {
                        key: "money_in",
                        label: "In",
                        color: "var(--st-shipped)",
                      },
                      {
                        key: "money_out",
                        label: "Out",
                        color: "var(--st-cancelled)",
                      },
                    ]}
                    formatV={shortMoney}
                  />
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-head">
                <h3>Latest ledger entries</h3>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Order</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="small muted">{fmtDate(e.created_at)}</td>
                        <td>{e.description}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              "--badge-c":
                                e.type === "expense"
                                  ? "var(--st-pending)"
                                  : "var(--st-paid)",
                            }}
                          >
                            <span className="dot" />
                            {e.type}
                          </span>
                        </td>
                        <td>{e.order_id ? `#${e.order_id}` : "—"}</td>
                        <td
                          className="num strong"
                          style={{
                            color:
                              e.type === "expense"
                                ? "var(--danger)"
                                : "var(--good)",
                          }}
                        >
                          {e.type === "expense" ? "−" : "+"}
                          {money(e.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {adding && (
              <Modal
                title="Add ledger entry"
                onClose={() => setAdding(false)}
                footer={
                  <>
                    <button className="btn" onClick={() => setAdding(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn primary"
                      onClick={submit}
                      disabled={
                        recording ||
                        !form.value ||
                        Number(form.value) <= 0 ||
                        !form.description.trim()
                      }
                    >
                      {recording ? "Saving…" : "Record"}
                    </button>
                  </>
                }
              >
                <div className="stack" style={{ gap: 14 }}>
                  <label className="field">
                    <span>Type</span>
                    <div className="seg" style={{ display: "flex" }}>
                      {[
                        ["expense", "Expense"],
                        ["income", "Income"],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          type="button"
                          style={{ flex: 1 }}
                          className={form.type === v ? "active" : ""}
                          onClick={() => setForm({ ...form, type: v })}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <span className="small muted">
                      Deposits are recorded from the order page; refunds are set
                      via an order's payment status.
                    </span>
                  </label>
                  <label className="field">
                    <span>Amount (EGP)</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.value}
                      onChange={(e) =>
                        setForm({ ...form, value: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <input
                      className="input"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="e.g. Meta ads, packaging restock"
                    />
                  </label>
                  <label className="field">
                    <span>Linked order id (optional)</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={form.orderId}
                      onChange={(e) =>
                        setForm({ ...form, orderId: e.target.value })
                      }
                    />
                  </label>
                </div>
              </Modal>
            )}
          </div>
        );
      }}
    </SectionShell>
  );
}
