import { useState } from "react";
import {
  Badge,
  Can,
  CopyButton,
  Empty,
  Modal,
  Segmented,
  TimelineItem,
} from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi, shipmentsApi } from "../../lib/api.js";
import { fmtDate, money2 } from "../../lib/format.js";

const SHIP_STATUS = {
  active: { label: "In transit", color: "var(--st-deposited)" },
  delivered: { label: "Delivered", color: "var(--st-paid)" },
  returned: { label: "Returned", color: "var(--st-pending)" },
  cancelled: { label: "Cancelled", color: "var(--st-cancelled)" },
};

export function ShipmentList({ shipments, onChanged }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  const setStatus = async (shipmentId, status) => {
    setBusyId(shipmentId);
    try {
      await shipmentsApi.updateStatus(shipmentId, status);
      toast(`Shipment marked ${SHIP_STATUS[status].label.toLowerCase()}`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setBusyId(null);
    }
  };

  if (!shipments.length) {
    return (
      <Empty
        title="Not shipped yet"
        hint="Create a shipment to get a tracking number."
      />
    );
  }

  return (
    <div className="timeline">
      {shipments.map((s) => {
        const st = SHIP_STATUS[s.status] ?? SHIP_STATUS.active;
        return (
          <TimelineItem key={s.id} color={st.color}>
            <div className="row gap-8">
              <span className="mono strong">{s.tracking_no}</span>
              <CopyButton text={s.tracking_no} label="tracking number" />
            </div>
            <div className="small muted" style={{ margin: "2px 0 6px" }}>
              <Badge color={st.color} style={{ marginRight: 6 }}>
                {st.label}
              </Badge>
              {s.carrier.toUpperCase()} · {fmtDate(s.created_at, true)}
              {Number(s.cod_amount) > 0 && <> · COD {money2(s.cod_amount)}</>}
            </div>
            {s.notes && <div className="small muted">“{s.notes}”</div>}
            {s.status === "active" && (
              <Can perm="orders.shipment.status.update">
                <div className="row gap-6" style={{ marginTop: 4 }}>
                  <button
                    className="btn sm"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, "delivered")}
                  >
                    Delivered
                  </button>
                  <button
                    className="btn sm"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, "returned")}
                  >
                    Returned
                  </button>
                  <button
                    className="btn sm danger"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, "cancelled")}
                  >
                    Cancel
                  </button>
                </div>
              </Can>
            )}
          </TimelineItem>
        );
      })}
    </div>
  );
}

export function ShipmentModal({
  orderId,
  defaultAmount,
  hasActive,
  onClose,
  onDone,
}) {
  const toast = useToast();
  const [carrier, setCarrier] = useState("jt");
  const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(String(defaultAmount.toFixed(2)));
  const [notesTxt, setNotesTxt] = useState("");

  const [submit, busy] = useAction(async () => {
    try {
      const res = await ordersApi.createShipment(orderId, {
        carrier,
        trackingNo: tracking.trim(),
        codAmount: Number(amount) || 0,
        notes: notesTxt || undefined,
      });
      toast(`Shipment created — ${res.tracking_no}`);
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Create shipment"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !tracking.trim()}
          >
            {busy ? "Creating…" : "Create shipment"}
          </button>
        </>
      }
    >
      <div className="stack gap-14">
        {hasActive && (
          <div
            className="small"
            style={{
              background: "var(--warn-soft)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            ⚠ This order already has a shipment in transit. Creating a new one
            is meant for re-shipping a returned parcel — mark the old shipment
            as returned first if you haven't.
          </div>
        )}

        <label className="field">
          <span>Courier</span>
          <Segmented
            fill
            value={carrier}
            onChange={setCarrier}
            options={[
              ["jt", "J&T Express"],
              ["flash", "Flash Express"],
              ["manual", "Manual"],
            ]}
          />
        </label>

        {/* No live Flash/J&T Express API integration yet (see docs) — every
            carrier takes a manually-entered tracking number for now. */}
        <label className="field">
          <span>Tracking number</span>
          <input
            className="input"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Courier tracking no."
            autoFocus
          />
        </label>

        <label className="field">
          <span>COD amount (remaining balance)</span>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Notes (optional)</span>
          <input
            className="input"
            value={notesTxt}
            onChange={(e) => setNotesTxt(e.target.value)}
            placeholder="e.g. re-ship after return"
          />
        </label>
      </div>
    </Modal>
  );
}
