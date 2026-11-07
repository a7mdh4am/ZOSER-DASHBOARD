import { useState } from "react";
import { Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { colorHex } from "../../lib/format.js";

/**
 * Edit the order's customization ("design"). Swapping the product
 * auto-suggests the tier price for this order's card count; the price
 * stays editable so the admin has the final say.
 */
export function EditDesignModal({
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
      <div className="row gap-8">
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
      <div className="stack gap-14">
        <div className="grid-2 gap-12">
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
              <span className="small text-danger">
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
        <div className="grid-2 gap-12">
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
            <div className="stack gap-10">
              {cards.map((c, i) => (
                <div
                  key={c.id ?? i}
                  className="grid-2 gap-12"
                  style={{ alignItems: "flex-end" }}
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
