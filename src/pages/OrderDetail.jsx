import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconChevronL,
  IconExternal,
  IconPlus,
  IconTruck,
  IconUser,
} from "../components/Icons.jsx";
import {
  CustomizationFields,
  OrderItemsGrid,
  PhoneActions,
} from "../components/order.jsx";
import { ThemeChips } from "../components/ThemeChips.jsx";
import {
  Badge,
  Can,
  CopyButton,
  CopyField,
  Empty,
  Modal,
  PageLoader,
  Segmented,
  StatusBadge,
  TimelineItem,
} from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { geoApi, ordersApi, shipmentsApi } from "../lib/api.js";
import {
  colorHex,
  fmtDate,
  money2,
  statusOf,
  STATUS_ORDER,
} from "../lib/format.js";

const SHIP_STATUS = {
  active: { label: "In transit", color: "var(--st-deposited)" },
  delivered: { label: "Delivered", color: "var(--st-paid)" },
  returned: { label: "Returned", color: "var(--st-pending)" },
  cancelled: { label: "Cancelled", color: "var(--st-cancelled)" },
};

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

  const {
    order,
    items,
    extras,
    deposits,
    financial,
    shipments,
    notes,
    profile,
  } = data;
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
          <ItemsCard items={items} extras={extras} />
          <CustomizationCard
            order={order}
            items={items}
            products={data.edit_products}
            cardCount={data.card_count}
            onChanged={load}
          />
          <NotesCard orderId={order.id} notes={notes} onChanged={load} />
        </div>

        {/* ============ right column ============ */}
        <div className="stack">
          {/* Keyed by status: after a change it starts over on the saved status. */}
          <StatusCard key={order.status} order={order} onChanged={load} />
          <ProfileCard orderId={order.id} profile={profile} onChanged={load} />

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

/* ---------------- payment ---------------- */

function PaymentCard({ order, financial, deposits, onChanged }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");

  const [addDeposit, busy] = useAction(async () => {
    try {
      await ordersApi.addDeposit(order.id, Number(amount));
      toast("Deposit recorded");
      setAmount("");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Payment</h3>
      </div>
      <div className="card-body">
        <div className="price-rows">
          <div className="pr">
            <span className="muted">Subtotal</span>
            <span className="mono">{money2(financial.gross)}</span>
          </div>
          {financial.discount > 0 && (
            <div className="pr good">
              <span>
                Discount
                {order.applied_coupon ? ` · ${order.applied_coupon}` : ""}
              </span>
              <span className="mono">−{money2(financial.discount)}</span>
            </div>
          )}
          {financial.shipping != null && (
            <div className="pr">
              <span className="muted">Shipping</span>
              <span className="mono">{money2(financial.shipping)}</span>
            </div>
          )}
          <div className="pr">
            <span className="strong">Order total</span>
            <span className="mono strong">{money2(financial.net_total)}</span>
          </div>

          {deposits.map((d) => (
            <div className="pr good" key={d.id}>
              <span>
                Deposit{" "}
                <span className="muted small">· {fmtDate(d.created_at)}</span>
              </span>
              <span className="mono">−{money2(d.value)}</span>
            </div>
          ))}

          <div className="pr total">
            <span>Remaining balance</span>
            <span
              className="mono"
              style={{
                color: financial.remaining <= 0 ? "var(--good)" : undefined,
              }}
            >
              {money2(financial.remaining)}
            </span>
          </div>
        </div>

        <Can perm="finance.deposit.add">
          <form
            className="row"
            style={{ marginTop: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              addDeposit();
            }}
          >
            <input
              className="input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Deposit amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <button className="btn primary" disabled={busy || !amount}>
              {busy ? "Saving…" : "Add deposit"}
            </button>
          </form>
        </Can>
      </div>
    </div>
  );
}

/* ---------------- items ---------------- */

function ItemsCard({ items, extras }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Cards & extras</h3>
      </div>
      <div className="card-body stack">
        {items.length > 0 && <OrderItemsGrid items={items} />}

        {extras.length > 0 && (
          <div>
            <div className="small strong muted" style={{ marginBottom: 6 }}>
              Add-ons
            </div>
            <div className="price-rows">
              {extras.map((x, i) => (
                <div className="pr" key={i}>
                  <span>{x.extra_name}</span>
                  <span className="mono">+{money2(x.extra_price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!items.length && !extras.length && <Empty title="No items recorded" />}
      </div>
    </div>
  );
}

/* ---------------- customization ---------------- */

function CustomizationCard({ order, items, products, cardCount, onChanged }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Customization</h3>
        <div className="grow" />
        <Can perm="orders.details.update">
          <button className="btn sm ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        </Can>
      </div>
      {editing && (
        <EditDesignModal
          order={order}
          items={items || []}
          products={products || []}
          cardCount={cardCount}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body stack">
        <CustomizationFields order={order} showDesign />
      </div>
    </div>
  );
}

function NotesCard({ orderId, notes, onChanged }) {
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);

  // Nothing to show and nothing to add → don't render an empty card.
  if (!notes.length && !can("production.notes.add")) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Production notes</h3>
        <div className="grow" />
        <Can perm="production.notes.add">
          <button className="btn sm primary" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Add note
          </button>
        </Can>
      </div>
      {adding && (
        <NoteModal
          orderId={orderId}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
      <div className="card-body">
        {notes.length === 0 ? (
          <div className="small muted">
            No production notes yet. Add one when the customer sends updates
            after ordering.
          </div>
        ) : (
          <div className="timeline">
            {notes.map((n, i) => (
              <TimelineItem key={i} color="var(--st-production)">
                <div style={{ whiteSpace: "pre-wrap" }}>{n.edits}</div>
                {n.images?.length > 0 && (
                  <div className="row wrap" style={{ gap: 10, marginTop: 2 }}>
                    {n.images.map((img, imgIdx) => (
                      <a
                        key={imgIdx}
                        className="small"
                        style={{ color: "var(--accent)" }}
                        href={img.image_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Attachment {n.images.length > 1 ? imgIdx + 1 : ""}{" "}
                        <IconExternal size={11} />
                      </a>
                    ))}
                  </div>
                )}
                {n.created_at && (
                  <div className="small muted">
                    {fmtDate(n.created_at, true)}
                  </div>
                )}
              </TimelineItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Add a production note with optional image attachments (multipart). */
function NoteModal({ orderId, onClose, onDone }) {
  const toast = useToast();
  const [edits, setEdits] = useState("");
  const [files, setFiles] = useState([]);

  const [submit, busy] = useAction(async () => {
    try {
      const fd = new FormData();
      fd.append("edits", edits);
      files.forEach((f) => fd.append("photos", f));
      await ordersApi.addNote(orderId, fd);
      toast("Production note added");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Add production note"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !edits.trim()}
          >
            {busy ? "Saving…" : "Save note"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <label className="field">
          <span>Note — what the customer needs / changed</span>
          <textarea
            className="input"
            rows={4}
            value={edits}
            onChange={(e) => setEdits(e.target.value)}
            placeholder="e.g. Customer asked to change the boy's name spelling and the song link."
            autoFocus
          />
        </label>
        <label className="field">
          <span>Attachments (optional — PNG, JPG, WebP or GIF)</span>
          <input
            className="input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <span className="small muted">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </span>
          )}
        </label>
      </div>
    </Modal>
  );
}

/* ---------------- status ---------------- */

function StatusCard({ order, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(String(order.status));

  const [save, busy] = useAction(async () => {
    try {
      await ordersApi.updateStatus(order.id, value);
      toast(`Status updated to ${statusOf(value).label}`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  // Node's flat permission model has no per-status target restriction —
  // orders.status.update allows setting any status.
  const cur = String(order.status);
  const options = can("orders.status.update") ? STATUS_ORDER : [cur];
  const canSetAny = options.some((s) => String(s) !== cur);
  if (!canSetAny) return null;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Order status</h3>
      </div>
      <div className="card-body row">
        <select
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {statusOf(s).label}
            </option>
          ))}
        </select>
        <button
          className="btn primary"
          onClick={save}
          disabled={busy || value === String(order.status)}
        >
          {busy ? "…" : "Update"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- profile ---------------- */

function ProfileCard({ orderId, profile, onChanged }) {
  const toast = useToast();
  // Shown straight after "Create profile", before the order has reloaded.
  const [createdLink, setCreatedLink] = useState(null);
  const link = profile.link || createdLink;
  const [tempPassword, setTempPassword] = useState(null);

  // Toggling a chip updates these right away; a reload of the order replaces
  // them (adjusting state during render rather than in an effect).
  const [themes, setThemes] = useState(profile.themes || []);
  const [themesFrom, setThemesFrom] = useState(profile.themes);
  if (profile.themes !== themesFrom) {
    setThemesFrom(profile.themes);
    setThemes(profile.themes || []);
  }

  const [create, busy] = useAction(async () => {
    try {
      const res = await ordersApi.createProfile(orderId);
      setCreatedLink(res.link);
      setTempPassword(res.temporaryPassword);
      toast("Profile created");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Card profile</h3>
      </div>
      <div className="card-body stack" style={{ gap: 10 }}>
        <div className="small muted">
          Username:{" "}
          <span className="mono strong" style={{ color: "var(--ink)" }}>
            {profile.username}
          </span>
        </div>
        {link ? (
          <>
            <CopyField
              value={link}
              label="profile link"
              style={{ width: "100%" }}
            />
            {tempPassword && (
              <div
                className="copy-line"
                style={{
                  background: "var(--warn-soft, #fff3cd)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  width: "100%",
                }}
              >
                <span className="small">
                  Temporary password:{" "}
                  <span className="mono strong">{tempPassword}</span> — save it
                  now, it won't be shown again.
                </span>
                <CopyButton text={tempPassword} label="temporary password" />
              </div>
            )}
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">
              <IconExternal /> Open profile
            </a>
            {themes.length > 0 && (
              <Can perm="profiles.themes.add">
                <div>
                  <div
                    className="small strong muted"
                    style={{ margin: "6px 0" }}
                  >
                    PROFILE THEMES — click to assign / remove
                  </div>
                  <ThemeChips
                    username={profile.username}
                    themes={themes}
                    onChange={setThemes}
                    gap={6}
                  />
                </div>
              </Can>
            )}
          </>
        ) : (
          <Can
            perm="profiles.create"
            fallback={
              <div className="small muted">No profile card created yet.</div>
            }
          >
            <button className="btn primary" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create profile & get link"}
            </button>
          </Can>
        )}
      </div>
    </div>
  );
}

/* ---------------- customer ---------------- */

function CustomerCard({ order, onChanged }) {
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

/**
 * Edit the order's customization ("design"). Swapping the product
 * auto-suggests the tier price for this order's card count; the price
 * stays editable so the admin has the final say.
 */
function EditDesignModal({
  order,
  items,
  products,
  cardCount,
  onClose,
  onDone,
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    product_id: String(order.product_id || ""),
    price: order.price != null ? String(order.price) : "",
    group_name: order.group_name || "",
    date: order.date ? String(order.date).slice(0, 10) : "",
    addr: order.addr || "",
    song: order.song || "",
    notes: order.notes || "",
  });
  // Per-card name + colour come from order_list now (was orders.bcolor/gcolor).
  const [cards, setCards] = useState(() =>
    items.map((it) => ({
      id: it.id,
      name: it.name || "",
      color: it.color || "",
    })),
  );
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setCard = (idx, key, val) =>
    setCards((cs) => cs.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));

  const selProduct = products.find(
    (x) => String(x.id) === String(form.product_id),
  );
  const colorOptions = selProduct?.colors || [];
  // Group name only matters for friends designs (3+ cards) — couples (2)
  // don't use it. No more products.category to key off; card count is the
  // single source of truth for the couples/friends distinction now.
  const isFrnds = Number(cardCount) > 2;

  const tierPrice = (productId) => {
    const p = products.find((x) => String(x.id) === String(productId));
    return p?.prices?.find((r) => Number(r.friends_count) === Number(cardCount))
      ?.price;
  };

  const hexFor = (name) =>
    colorOptions.find((c) => c.name === name)?.hex ||
    colorHex(name) ||
    "transparent";

  const colorSelect = (value, onChange) => {
    const names = colorOptions.map((c) => c.name);
    const missing = value && !names.includes(value);
    return (
      <div className="row" style={{ gap: 8 }}>
        <span
          className="color-dot"
          style={{
            background: hexFor(value),
            width: 18,
            height: 18,
            flex: "0 0 auto",
          }}
        />
        <select className="input" value={value} onChange={onChange}>
          <option value="">— none —</option>
          {colorOptions.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
          {missing && (
            <option value={value}>{value} (not in this design)</option>
          )}
        </select>
      </div>
    );
  };

  const onProduct = (e) => {
    const product_id = e.target.value;
    const suggested = tierPrice(product_id);
    setForm((f) => ({
      ...f,
      product_id,
      price: suggested != null ? String(suggested) : f.price,
    }));
  };

  const [submit, busy] = useAction(async () => {
    try {
      await ordersApi.updateDesign(order.id, {
        productId: form.product_id ? Number(form.product_id) : undefined,
        price: form.price === "" ? undefined : Number(form.price),
        groupName: form.group_name || undefined,
        date: form.date || undefined,
        addr: form.addr || undefined,
        song: form.song || undefined,
        notes: form.notes || undefined,
        items: cards.map((c) => ({ id: c.id, name: c.name, color: c.color })),
      });
      toast("Design updated");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const noTier = form.product_id && tierPrice(form.product_id) == null;

  return (
    <Modal
      wide
      title="Edit design"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !form.product_id}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Product / design</span>
            <select
              className="input"
              value={form.product_id}
              onChange={onProduct}
            >
              {!products.some(
                (p) => String(p.id) === String(form.product_id),
              ) && (
                <option value={form.product_id}>
                  {order.product_name || "Current product"}
                </option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>
              Price (EGP) — {cardCount} card{Number(cardCount) === 1 ? "" : "s"}
            </span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={set("price")}
            />
            {noTier && (
              <span className="small" style={{ color: "var(--danger)" }}>
                No preset price for {cardCount} cards — enter it manually.
              </span>
            )}
          </label>
        </div>
        {isFrnds && (
          <label className="field">
            <span>Group name</span>
            <input
              className="input"
              value={form.group_name}
              onChange={set("group_name")}
            />
          </label>
        )}
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Anniversary date</span>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={set("date")}
            />
          </label>
          <label className="field">
            <span>On-card address</span>
            <input className="input" value={form.addr} onChange={set("addr")} />
          </label>
        </div>

        {cards.length > 0 && (
          <div className="field">
            <span>Cards — name &amp; colour</span>
            <div className="stack" style={{ gap: 10 }}>
              {cards.map((c, i) => (
                <div
                  key={c.id ?? i}
                  className="grid-2"
                  style={{ gap: 12, alignItems: "flex-end" }}
                >
                  <label className="field">
                    <span className="small muted">Card {i + 1} name</span>
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) => setCard(i, "name", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span className="small muted">Colour</span>
                    {colorSelect(c.color, (e) =>
                      setCard(i, "color", e.target.value),
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span>Song URL</span>
          <input className="input" value={form.song} onChange={set("song")} />
        </label>
        <label className="field">
          <span>Customer notes</span>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={set("notes")}
          />
        </label>
      </div>
    </Modal>
  );
}

/* ---------------- shipments ---------------- */

function ShipmentList({ shipments, onChanged }) {
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
            <div className="row" style={{ gap: 8 }}>
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
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
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

function ShipmentModal({ orderId, defaultAmount, hasActive, onClose, onDone }) {
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
      <div className="stack" style={{ gap: 14 }}>
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
