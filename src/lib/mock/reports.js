// Dashboard and Finance reports for the dummy admin API. Computed from the
// same orders and ledger the other endpoints read, so totals agree between
// pages and a write (deposit, expense, unit cost, ...) shows up in them.
// Definitions follow the formulas listed on the Finance page itself. "Net
// revenue" is subtotal − discounts everywhere (shipping is reported on its
// own), while an order's total is what the customer pays, shipping included.
//
// Days, weeks and months are calendar days where the staff are (the browser's
// time zone), the same days the Finance date presets pick.

import { localISODate } from "../dates.js";
import {
  cityOf,
  db,
  newestFirst,
  ORDER_STATUS,
  orderMatchesSearch,
  paidOf,
  paymentStatus,
  productOf,
  round2,
  sum,
  zoneOf,
} from "./db.js";

const { PENDING, DEPOSITED, PRODUCTION, SHIPPED, SHIPPED_PAID, CANCELLED } =
  ORDER_STATUS;

const isLive = (order) => order.status !== CANCELLED;
const netOf = (order) => order.subtotal - order.discount_amount;
const cardCount = (order) => order.cards.length;
const countWhere = (list, test) => list.filter(test).length;

function groupBy(list, keyOf) {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

const localDay = (iso) => localISODate(new Date(iso));

/** Bucket key for an ISO timestamp; sorts chronologically as a plain string. */
function periodKey(iso, granularity = "month") {
  const day = localDay(iso);
  if (granularity === "day") return day;
  if (granularity === "year") return day.slice(0, 4);
  if (granularity === "week") {
    const monday = new Date(iso);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return localISODate(monday);
  }
  return day.slice(0, 7);
}

const sortedPeriods = (...lists) => [...new Set(lists.flat())].sort();

/* ------------------------------------------------------------------ */
/* filters shared by the Finance tabs                                  */
/* ------------------------------------------------------------------ */

function inDateRange(iso, query) {
  const day = localDay(iso);
  return (!query.from || day >= query.from) && (!query.to || day <= query.to);
}

const matchesFilters = (order, query) =>
  (!query.status || String(order.status) === query.status) &&
  (!query.productId || String(order.product_id) === query.productId) &&
  (!query.cityId || String(order.city_id) === query.cityId);

const ordersFor = (query) =>
  db.orders.filter(
    (o) => inDateRange(o.order_time, query) && matchesFilters(o, query),
  );
const ledgerFor = (query) =>
  db.ledger.filter((e) => inDateRange(e.created_at, query));

/** Refunds and shipments date by their own timestamp but filter by their order. */
const refundsFor = (query) =>
  db.refunds.filter(
    (r) =>
      inDateRange(r.created_at, query) &&
      matchesFilters(
        db.orders.find((o) => o.id === r.order_id),
        query,
      ),
  );

function profitFigures(query) {
  const live = ordersFor(query).filter(isLive);
  const net_revenue = sum(live, netOf);
  const priced = live.filter((o) => productOf(o)?.unit_cost != null);
  const cogs = sum(priced, (o) => productOf(o).unit_cost * cardCount(o));
  const expenses = sum(
    ledgerFor(query).filter((e) => e.type === "expense"),
    (e) => e.value,
  );
  const refunds = sum(refundsFor(query), (r) => r.value);
  return {
    cost_configured: db.products.some((p) => p.unit_cost != null),
    net_revenue,
    cogs,
    units_missing_cost: sum(
      live.filter((o) => productOf(o)?.unit_cost == null),
      cardCount,
    ),
    gross_profit: round2(net_revenue - cogs),
    expenses,
    refunds,
    net_profit: round2(net_revenue - refunds - expenses - cogs),
  };
}

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

export function dashboard() {
  const live = db.orders.filter(isLive);
  const thisMonth = periodKey(new Date().toISOString());
  const lastMonthDate = new Date();
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = periodKey(lastMonthDate.toISOString());
  const inMonth = (list, month) =>
    list.filter((o) => periodKey(o.order_time) === month);
  const statusCount = (...statuses) =>
    countWhere(db.orders, (o) => statuses.includes(o.status));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const byDay = groupBy(
    db.orders.filter((o) => o.order_time >= thirtyDaysAgo),
    (o) => periodKey(o.order_time, "day"),
  );

  return {
    summary: {
      net_revenue: sum(live, netOf),
      total_orders: db.orders.length,
      this_month_orders: inMonth(db.orders, thisMonth).length,
      last_month_orders: inMonth(db.orders, lastMonth).length,
      this_month_revenue: sum(inMonth(live, thisMonth), netOf),
      last_month_revenue: sum(inMonth(live, lastMonth), netOf),
      deposits_collected: sum(
        db.ledger.filter((e) => e.type === "deposit"),
        (e) => e.value,
      ),
      deposited_orders: statusCount(DEPOSITED),
      production_orders: statusCount(PRODUCTION),
      shipped_orders: statusCount(SHIPPED, SHIPPED_PAID),
      pending_orders: statusCount(PENDING),
    },
    daily_series: [...byDay].map(([day, orders]) => ({
      day,
      order_count: orders.length,
      revenue: sum(orders.filter(isLive), netOf),
    })),
    status_breakdown: [...groupBy(db.orders, (o) => o.status)].map(
      ([status, orders]) => ({ status, order_count: orders.length }),
    ),
    product_performance: [...groupBy(live, (o) => productOf(o)?.name)]
      .map(([product_name, orders]) => ({
        product_name,
        total_revenue: sum(orders, (o) => o.subtotal),
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue),
    recent_orders: [...db.orders]
      .sort((a, b) => b.order_time.localeCompare(a.order_time))
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        order_time: o.order_time,
        full_name: o.full_name,
        product_name: productOf(o)?.name ?? null,
        status: o.status,
        net_total: o.grand_total,
      })),
    top_zones: [...groupBy(db.orders, (o) => zoneOf(o)?.name ?? null)]
      .map(([zone, orders]) => ({ zone, order_count: orders.length }))
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 6),
  };
}

/* ------------------------------------------------------------------ */
/* finance: one function per tab                                       */
/* ------------------------------------------------------------------ */

function overview(query) {
  const orders = ordersFor(query);
  const live = orders.filter(isLive);
  const refunds = refundsFor(query);
  const profit = profitFigures(query);
  const owing = orders.filter((o) =>
    [DEPOSITED, PRODUCTION, SHIPPED].includes(o.status),
  );
  const outstanding = sum(owing, (o) => Math.max(o.grand_total - paidOf(o), 0));
  const netByName = (groups) =>
    [...groups]
      .map(([name, rows]) => ({ name, net: sum(rows, netOf) }))
      .sort((a, b) => b.net - a.net);

  const alerts = [];
  if (!profit.cost_configured) {
    alerts.push({
      level: "warn",
      title: "Product costs not set",
      detail:
        "Gross profit can't be computed until unit costs are set in the Profit tab.",
    });
  }
  if (outstanding > 0) {
    alerts.push({
      level: "info",
      title: "Outstanding payments",
      detail: `${outstanding.toLocaleString()} EGP not yet collected across deposited/production/shipped orders.`,
    });
  }

  const byPeriod = groupBy(orders, (o) =>
    periodKey(o.order_time, query.granularity),
  );

  return {
    options: {
      cities: db.cities.map(({ id, name }) => ({ id, name })),
      products: db.products.map(({ id, name }) => ({ id, name })),
    },
    summary: {
      orders: {
        gross_revenue: sum(live, (o) => o.subtotal),
        net_revenue: profit.net_revenue,
        total_orders: orders.length,
        cancelled_orders: countWhere(orders, (o) => o.status === CANCELLED),
        paid_orders: countWhere(orders, (o) => paymentStatus(o) === "paid"),
        pending_orders: countWhere(orders, (o) => o.status === PENDING),
        deposited_orders: countWhere(orders, (o) => o.status === DEPOSITED),
        total_discounts: sum(live, (o) => o.discount_amount),
        outstanding,
        pending_revenue: sum(
          orders.filter((o) => o.status === PENDING),
          (o) => o.grand_total,
        ),
      },
      ledger: { refunds: profit.refunds, refund_count: refunds.length },
      shipping: { shipping_charged: sum(live, (o) => o.shipping_fee) },
      derived: {
        aov: live.length ? round2(profit.net_revenue / live.length) : 0,
        cost_configured: profit.cost_configured,
        gross_profit: profit.gross_profit,
        net_profit: profit.net_profit,
      },
    },
    series: [...byPeriod.keys()].sort().map((period) => {
      const rows = byPeriod.get(period);
      const liveRows = rows.filter(isLive);
      return {
        period,
        orders: rows.length,
        gross: sum(liveRows, (o) => o.subtotal),
        net: sum(liveRows, netOf),
        discounts: sum(liveRows, (o) => o.discount_amount),
      };
    }),
    alerts,
    breakdowns: {
      by_product: netByName(groupBy(live, (o) => productOf(o)?.name)),
      by_city: netByName(groupBy(live, (o) => cityOf(o)?.name ?? null)),
      by_status: [...groupBy(orders, (o) => o.status)].map(
        ([status, rows]) => ({ status, orders: rows.length }),
      ),
    },
  };
}

function products(query) {
  const live = ordersFor(query).filter(isLive);
  const byProduct = groupBy(live, (o) => o.product_id);

  const performance = [...byProduct]
    .map(([productId, rows]) => {
      const product = db.products.find((p) => p.id === productId);
      const net = sum(rows, netOf);
      const cards = sum(rows, cardCount);
      return {
        id: product.id,
        name: product.name,
        orders: rows.length,
        cards,
        net,
        avg_net: round2(net / rows.length),
        profit:
          product.unit_cost == null
            ? null
            : round2(net - product.unit_cost * cards),
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    performance,
    never_sold: db.products
      .filter((p) => !byProduct.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, is_active: p.is_active })),
  };
}

function customers(query) {
  const live = ordersFor(query).filter(isLive);
  const byPhone = groupBy(live, (o) => o.phone);

  const rows = [...byPhone]
    .map(([phone, orders]) => {
      const lifetime_net = sum(orders, (o) => o.grand_total);
      return {
        full_name: orders[0].full_name,
        phone,
        orders: orders.length,
        lifetime_net,
        avg_order: round2(lifetime_net / orders.length),
        last_order: orders
          .map((o) => o.order_time)
          .sort()
          .at(-1),
      };
    })
    .sort((a, b) => b.lifetime_net - a.lifetime_net);

  const returning = countWhere(rows, (c) => c.orders > 1);
  return {
    aggregates: {
      customers: rows.length,
      returning,
      one_time: rows.length - returning,
      repeat_rate: rows.length ? returning / rows.length : 0,
      avg_spend: rows.length ? round2(sum(live, netOf) / rows.length) : 0,
    },
    top: rows.slice(0, 20),
  };
}

const shipmentsFor = (query) => {
  const orderIds = new Set(
    db.orders.filter((o) => matchesFilters(o, query)).map((o) => o.id),
  );
  return db.shipments.filter(
    (s) => orderIds.has(s.order_id) && inDateRange(s.created_at, query),
  );
};

const shipmentStats = (rows) => {
  const withStatus = (status) => rows.filter((s) => s.status === status);
  return {
    shipments: rows.length,
    delivered: withStatus("delivered").length,
    returned: withStatus("returned").length,
    cancelled: withStatus("cancelled").length,
    in_transit: withStatus("active").length,
    cod_collected: sum(withStatus("delivered"), (s) => s.cod_amount),
    cod_pending: sum(withStatus("active"), (s) => s.cod_amount),
  };
};

function payments(query) {
  const deposits = ledgerFor(query).filter((e) => e.type === "deposit");
  return {
    deposits: { total: sum(deposits, (e) => e.value), n: deposits.length },
    carriers: [...groupBy(shipmentsFor(query), (s) => s.carrier)].map(
      ([carrier, rows]) => ({ carrier, ...shipmentStats(rows) }),
    ),
  };
}

function discounts(query) {
  const live = ordersFor(query).filter(isLive);
  const couponed = live.filter((o) => o.coupon);
  const discounted = live.filter((o) => o.discount_amount > 0);
  const discount_total = sum(live, (o) => o.discount_amount);
  return {
    totals: {
      orders: live.length,
      couponed_orders: couponed.length,
      discount_total,
      avg_discount: discounted.length
        ? round2(discount_total / discounted.length)
        : 0,
    },
    per_coupon: [...groupBy(couponed, (o) => o.coupon)]
      .map(([coupon, rows]) => ({
        coupon,
        uses: rows.length,
        discount_total: sum(rows, (o) => o.discount_amount),
        net: sum(rows, (o) => o.grand_total),
      }))
      .sort((a, b) => b.uses - a.uses),
  };
}

function shipping(query) {
  const live = ordersFor(query).filter(isLive);
  const shipments = shipmentsFor(query);
  const fee_charged = sum(live, (o) => o.shipping_fee);
  const orderCity = (id) =>
    cityOf(db.orders.find((o) => o.id === id))?.name ?? null;
  const shipmentsByCity = groupBy(shipments, (s) => orderCity(s.order_id));

  return {
    totals: {
      fee_charged,
      shipments: shipments.length,
      avg_fee: live.length ? round2(fee_charged / live.length) : 0,
    },
    by_region: [...groupBy(live, (o) => cityOf(o)?.name ?? null)]
      .map(([name, rows]) => {
        const {
          shipments: shipped,
          delivered,
          returned,
          cod_collected,
        } = shipmentStats(shipmentsByCity.get(name) ?? []);
        return {
          name,
          order_count: rows.length,
          shipments: shipped,
          delivered,
          returned,
          cod_collected,
        };
      })
      .sort((a, b) => b.order_count - a.order_count),
  };
}

function refunds(query) {
  const rows = refundsFor(query);
  const byMonth = groupBy(rows, (r) => periodKey(r.created_at));
  return {
    totals: { total: sum(rows, (r) => r.value), n: rows.length },
    trend: [...byMonth.keys()].sort().map((period) => ({
      period,
      total: sum(byMonth.get(period), (r) => r.value),
    })),
    recent: [...rows]
      .sort(newestFirst)
      .slice(0, 20)
      .map((r) => ({
        ...r,
        product_name:
          productOf(db.orders.find((o) => o.id === r.order_id))?.name ?? null,
      })),
  };
}

function profit(query) {
  const live = groupBy(ordersFor(query).filter(isLive), (o) =>
    periodKey(o.order_time),
  );
  const expenses = groupBy(
    ledgerFor(query).filter((e) => e.type === "expense"),
    (e) => periodKey(e.created_at),
  );
  const refundRows = groupBy(refundsFor(query), (r) => periodKey(r.created_at));

  return {
    ...profitFigures(query),
    trend: sortedPeriods(
      [...live.keys()],
      [...expenses.keys()],
      [...refundRows.keys()],
    ).map((period) => {
      const rows = live.get(period) ?? [];
      return {
        period,
        net: sum(rows, netOf),
        cogs: sum(rows, (o) => (productOf(o)?.unit_cost ?? 0) * cardCount(o)),
        expenses: sum(expenses.get(period) ?? [], (e) => e.value),
        refunds: sum(refundRows.get(period) ?? [], (r) => r.value),
      };
    }),
    costs: db.products.map(({ id, name, unit_cost }) => ({
      id,
      name,
      unit_cost,
    })),
  };
}

function cashflow(query) {
  const signed = (entry) =>
    entry.type === "expense" ? -entry.value : entry.value;
  const opening_balance = query.from
    ? sum(
        db.ledger.filter((e) => localDay(e.created_at) < query.from),
        signed,
      )
    : 0;
  const entries = ledgerFor(query);
  const byMonth = groupBy(entries, (e) => periodKey(e.created_at));

  let running = opening_balance;
  return {
    opening_balance,
    months: [...byMonth.keys()].sort().map((period) => {
      const rows = byMonth.get(period);
      const money_in = sum(
        rows.filter((e) => e.type !== "expense"),
        (e) => e.value,
      );
      const money_out = sum(
        rows.filter((e) => e.type === "expense"),
        (e) => e.value,
      );
      running = round2(running + money_in - money_out);
      return { period, money_in, money_out, running_balance: running };
    }),
    entries: [...entries].sort(newestFirst).slice(0, 30),
  };
}

const SECTIONS = {
  overview,
  products,
  customers,
  payments,
  discounts,
  shipping,
  refunds,
  profit,
  cashflow,
};

/** Returns undefined for an unknown section, so the router can answer 404. */
export const financeSection = (section, query) => SECTIONS[section]?.(query);

/** Every order row matching the filters, search and sort (the CSV export takes them all). */
export function financeOrderRows(query) {
  const sortField =
    {
      id: "id",
      order_time: "order_time",
      net: "net",
      paid: "dep",
      balance: "balance",
    }[query.sort] ?? "order_time";
  const direction = query.dir === "asc" ? 1 : -1;

  return ordersFor(query)
    .filter((o) => orderMatchesSearch(o, query.search))
    .map((o) => {
      const dep = paidOf(o);
      return {
        id: o.id,
        order_time: o.order_time,
        full_name: o.full_name,
        product_name: productOf(o)?.name ?? null,
        city: cityOf(o)?.name ?? null,
        status: o.status,
        price: o.subtotal,
        discount_amount: o.discount_amount,
        net: o.grand_total,
        dep,
        balance: round2(o.grand_total - dep),
        payment_status: paymentStatus(o),
      };
    })
    .sort((a, b) => {
      if (a[sortField] === b[sortField]) return 0;
      return (a[sortField] > b[sortField] ? 1 : -1) * direction;
    });
}

export function financeOrders(query) {
  const page = Number(query.page) || 1;
  const perPage = Number(query.perPage) || 25;
  const rows = financeOrderRows(query);
  return {
    rows: rows.slice((page - 1) * perPage, page * perPage),
    page,
    perPage,
    total: rows.length,
  };
}
