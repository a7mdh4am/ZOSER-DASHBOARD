// Returned parcels, as the Returns page and the dashboard's card list them: which order,
// who and when marked it returned, the parcel, and whether the order has gone out again.
import { useNavigate } from "react-router-dom";
import { fmtDate, money, relDay } from "../lib/format.js";
import { Badge, OrderLink, StatusBadge } from "./ui.jsx";

// What happened since: still waiting to go out again, on its way again, or delivered
const NEXT = {
  null: { label: "Waiting", color: "var(--st-pending)" },
  active: { label: "Re-shipped", color: "var(--st-production)" },
  delivered: { label: "Delivered again", color: "var(--good)" },
};

export function ReturnsTable({ rows, compact = false }) {
  const navigate = useNavigate();
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Returned</th>
            {!compact && <th>Parcel</th>}
            <th>Now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const next = NEXT[r.reshipped] ?? NEXT.null;
            return (
              <tr
                key={r.shipment_id}
                className="row-link"
                onClick={() => navigate(`/orders/${r.order.id}`)}
              >
                <td>
                  <div className="strong">
                    <OrderLink id={r.order.id} />
                  </div>
                  <div className="small muted mono">{r.order.public_ref}</div>
                </td>
                <td>
                  <div>{r.order.full_name}</div>
                  <div className="small muted">
                    {[r.order.phone, r.order.zone, r.order.city]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td>
                  <div title={fmtDate(r.returned_at, true)}>
                    {relDay(r.returned_at)}
                  </div>
                  <div className="small muted">
                    {r.returned_by ? `by ${r.returned_by}` : "—"}
                  </div>
                </td>
                {!compact && (
                  <td>
                    <div className="mono">
                      {r.carrier.toUpperCase()}
                      {r.tracking_no ? ` · ${r.tracking_no}` : ""}
                    </div>
                    <div className="small muted">
                      COD {money(r.cod_amount)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </td>
                )}
                <td>
                  <Badge color={next.color}>{next.label}</Badge>
                  {!compact && (
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={r.order.status} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
