// One order: payment, order items and notes on the left; status, NFC links,
// shipments and customer on the right.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { IconChevronL, IconPlus, IconTruck } from "../../components/Icons.jsx";
import { Can, Empty, PageLoader, StatusBadge } from "../../components/ui.jsx";
import { useApiData } from "../../hooks/useApiData.js";
import { ordersApi } from "../../lib/api.js";
import { fmtDate } from "../../lib/format.js";
import { CustomerCard } from "./CustomerCard.jsx";
import { LineCard } from "./LineCard.jsx";
import { NotesCard } from "./NotesCard.jsx";
import { PaymentCard } from "./PaymentCard.jsx";
import { ProfileCard } from "./ProfileCard.jsx";
import { ShipmentList, ShipmentModal } from "./Shipments.jsx";
import { StatusCard } from "./StatusCard.jsx";

export default function OrderDetail() {
  const { id } = useParams();

  const [shipModal, setShipModal] = useState(false);

  const {
    data: loaded,
    error,
    reload: load,
  } = useApiData(() => ordersApi.get(id), [id]);
  // After moving to another order, the previous one stays loaded until the
  // new one arrives; show the spinner instead of the wrong order.
  const data = loaded && String(loaded.order.id) === String(id) ? loaded : null;

  if (error) return <Empty title="Couldn't load this order" hint={error} />;
  if (!data) return <PageLoader />;

  const { order, lines, deposits, financial, shipments, notes, profiles } =
    data;
  const lineTitle = (line) =>
    lines.length > 1
      ? `Item ${lines.indexOf(line) + 1} · ${line.product_name}`
      : line.product_name;
  const hasActiveShipment = shipments.some((s) => s.status === "active");

  return (
    <div className="stack">
      {/* header */}
      <div className="row wrap">
        <Link to="/orders" className="btn ghost sm">
          <IconChevronL /> Orders
        </Link>
        <h2 style={{ fontSize: 20 }}>
          #{order.id} · {order.full_name}
        </h2>
        <StatusBadge status={order.status} />
        <div className="grow" />
        <span className="small muted">{fmtDate(order.order_time, true)}</span>
      </div>

      <div className="detail-grid">
        {/* ============ left column ============ */}
        <div className="stack">
          <PaymentCard
            order={order}
            financial={financial}
            deposits={deposits}
            onChanged={load}
          />
          {lines.map((line) => (
            <LineCard
              key={line.id}
              orderId={order.id}
              line={line}
              title={lineTitle(line)}
              products={data.edit_products}
              extraOptions={data.edit_extras}
              onChanged={load}
            />
          ))}
          <NotesCard orderId={order.id} notes={notes} onChanged={load} />
        </div>

        {/* ============ right column ============ */}
        <div className="stack">
          {/* Keyed by status: after a change it starts over on the saved status. */}
          <StatusCard key={order.status} order={order} onChanged={load} />
          <ProfileCard
            orderId={order.id}
            lines={lines}
            lineTitle={lineTitle}
            profiles={profiles}
            onChanged={load}
          />

          <div className="card">
            <div className="card-head">
              <IconTruck />
              <h3>Shipments</h3>
              <div className="grow" />
              <Can perm="orders.shipment.create">
                <button
                  className="btn sm primary"
                  onClick={() => setShipModal(true)}
                >
                  <IconPlus size={14} />{" "}
                  {hasActiveShipment ? "Re-ship" : "Create"}
                </button>
              </Can>
            </div>
            <div className="card-body">
              <ShipmentList shipments={shipments} onChanged={load} />
            </div>
          </div>

          <CustomerCard order={order} onChanged={load} />
        </div>
      </div>

      {shipModal && (
        <ShipmentModal
          orderId={order.id}
          defaultAmount={Math.max(0, financial.remaining)}
          hasActive={hasActiveShipment}
          onClose={() => setShipModal(false)}
          onDone={() => {
            setShipModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
