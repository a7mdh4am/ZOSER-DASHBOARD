import { useState } from "react";
import { PhoneActions } from "../../components/order.jsx";
import { Can, CopyButton, Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { useApiData } from "../../hooks/useApiData.js";
import { geoApi, ordersApi } from "../../lib/api.js";

export function CustomerCard({ order, onChanged }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="card">
      <div className="card-head">
        <h3>Customer</h3>
        <div className="grow" />
        <Can perm="orders.customer_info.update">
          <button className="btn sm ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </Can>
      </div>
      {editing && (
        <EditContactModal
          order={order}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body">
        <div className="kv" style={{ gridTemplateColumns: "1fr" }}>
          <div className="kv-item">
            <div className="k">Name</div>
            <div className="v copy-line">
              {order.full_name}
              <CopyButton text={order.full_name} label="name" />
            </div>
          </div>
          <div className="kv-item">
            <div className="k">Phone</div>
            <div className="v copy-line">
              {order.phone}
              <PhoneActions phone={order.phone} />
            </div>
          </div>
          <div className="kv-item">
            <div className="k">Address</div>
            <div className="v copy-line">
              {order.address}, {order.city}, {order.zone}
              <CopyButton
                text={`${order.address}, ${order.city}, ${order.zone}`}
                label="address"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Edit the customer's contact record (phone + shipping address). */
function EditContactModal({ order, onClose, onDone }) {
  const toast = useToast();
  // A failed load just leaves the city list empty.
  const { data: geo } = useApiData(() => geoApi.cities(), []);
  const cities = geo?.cities ?? [];
  const [form, setForm] = useState({
    phone: order.phone || "",
    address: order.address || "",
    cityId: order.city_id || "",
    zoneId: order.zone_id || "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const selectedCity = cities.find((c) => String(c.id) === String(form.cityId));

  const [submit, busy] = useAction(async () => {
    try {
      await ordersApi.updateCustomer(order.id, {
        phone: form.phone,
        address: form.address,
        cityId: form.cityId ? Number(form.cityId) : undefined,
        zoneId: form.zoneId ? Number(form.zoneId) : undefined,
      });
      toast("Customer details updated");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Edit customer details"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !form.phone.trim() || !form.address.trim()}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <label className="field">
          <span>Phone</span>
          <input
            className="input"
            value={form.phone}
            onChange={set("phone")}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Address</span>
          <input
            className="input"
            value={form.address}
            onChange={set("address")}
          />
        </label>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>City</span>
            <select
              className="input"
              value={form.cityId}
              onChange={(e) =>
                setForm({ ...form, cityId: e.target.value, zoneId: "" })
              }
            >
              <option value="">— select —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Zone</span>
            <select
              className="input"
              value={form.zoneId}
              onChange={set("zoneId")}
              disabled={!selectedCity}
            >
              <option value="">— select —</option>
              {(selectedCity?.zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}
