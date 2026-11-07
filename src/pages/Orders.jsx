import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Empty,
  OrderLink,
  Pager,
  SearchInput,
  Spinner,
  StatusBadge,
} from "../components/ui.jsx";
import { ordersApi } from "../lib/api.js";
import {
  fmtDate,
  money,
  relDay,
  statusOf,
  STATUS_ORDER,
} from "../lib/format.js";

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // Node's flat permission model has no per-status visibility restriction —
  // anyone with orders.view (which gates this whole route) sees every status.
  const visibleStatuses = STATUS_ORDER;

  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setParam = (patch) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(patch).forEach(([k, v]) =>
          v ? next.set(k, v) : next.delete(k),
        );
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dims the table while the next page/filter loads
    setLoading(true);
    setError("");
    ordersApi
      .list({ status, search, page: String(page), per_page: "25" })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status, search, page]);

  return (
    <div className="stack">
      <div className="row wrap">
        <div className="grow" style={{ minWidth: 220, maxWidth: 420 }}>
          <SearchInput
            value={search}
            onChange={(v) => setParam({ q: v })}
            placeholder="Search id, name or phone…"
          />
        </div>
      </div>

      <div className="chips" role="group" aria-label="Status filter">
        <button
          className={`chip${status === "" ? " active" : ""}`}
          aria-pressed={status === ""}
          onClick={() => setParam({ status: "" })}
        >
          All
        </button>
        {visibleStatuses.map((s) => (
          <button
            key={s}
            className={`chip${status === s ? " active" : ""}`}
            aria-pressed={status === s}
            onClick={() => setParam({ status: s })}
          >
            {statusOf(s).label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && !data ? (
          <div style={{ padding: 60 }}>
            <Spinner />
          </div>
        ) : error ? (
          <Empty title="Couldn't load orders" hint={error} />
        ) : !data.orders.length ? (
          <Empty
            title="No orders found"
            hint={
              search
                ? "Try a different search."
                : "New orders will appear here."
            }
          />
        ) : (
          <>
            <div
              className="table-scroll"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Paid</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => {
                    // What the customer pays: subtotal − discount + shipping,
                    // the same total as the order page and the shop's cart.
                    const total = Number(o.grand_total);
                    const paid = Number(o.total_deposit);
                    const fullyPaid = paid >= total && total > 0;
                    return (
                      <tr
                        key={o.id}
                        className="row-link"
                        onClick={() => navigate(`/orders/${o.id}`)}
                      >
                        <td>
                          <div className="strong">
                            <OrderLink id={o.id} />
                          </div>
                          <div
                            className="small muted"
                            title={fmtDate(o.order_time, true)}
                          >
                            {relDay(o.order_time)}
                          </div>
                        </td>
                        <td>
                          <div>{o.full_name}</div>
                          <div className="small muted">
                            {o.phone} · {o.city}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                          {o.shipping_id && (
                            <div
                              className="small muted mono"
                              style={{ marginTop: 3 }}
                            >
                              {o.shipping_id}
                            </div>
                          )}
                        </td>
                        <td className="num">
                          <span
                            className={fullyPaid ? "strong" : ""}
                            style={
                              fullyPaid ? { color: "var(--good)" } : undefined
                            }
                          >
                            {paid > 0 ? money(paid) : "—"}
                          </span>
                        </td>
                        <td className="num strong">{money(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              perPage={data.per_page}
              total={data.total}
              onPage={(p) => setParam({ page: String(p) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
