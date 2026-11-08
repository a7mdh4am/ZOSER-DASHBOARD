// Finance: shared filters (date range, status, product, city) and the report tabs.

import { useEffect, useState } from "react";
import { ChipGroup } from "../../components/ui.jsx";
import { localISODate } from "../../lib/dates.js";
import { statusOf, STATUS_ORDER } from "../../lib/format.js";
import { CashflowTab } from "./CashflowTab.jsx";
import { CustomersTab } from "./CustomersTab.jsx";
import { DiscountsTab } from "./DiscountsTab.jsx";
import { OrdersTab } from "./OrdersTab.jsx";
import { OverviewTab } from "./OverviewTab.jsx";
import { PaymentsTab } from "./PaymentsTab.jsx";
import { ProductsTab } from "./ProductsTab.jsx";
import { ProfitTab } from "./ProfitTab.jsx";
import { RefundsTab } from "./RefundsTab.jsx";
import { ShippingTab } from "./ShippingTab.jsx";
import { sectionCache } from "./shared.js";

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
        <ChipGroup
          label="Date range"
          style={{ flex: "1 1 auto" }}
          value={preset}
          onChange={applyPreset}
          options={PRESETS}
        />
        <button className="btn sm no-print" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>
      {preset === "custom" && (
        <div className="row wrap no-print" style={{ alignItems: "flex-end" }}>
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
      <ChipGroup
        label="Finance sections"
        className="no-print"
        value={tab}
        onChange={setTab}
        options={TABS}
      />

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
