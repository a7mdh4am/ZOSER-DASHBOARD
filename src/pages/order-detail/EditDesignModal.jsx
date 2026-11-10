import { useRef, useState } from "react";
import { Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { colorHex, countLabel } from "../../lib/format.js";

/**
 * Edit one order item's customization ("design"). Swapping the product
 * auto-suggests the tier price for this item's count; the price stays
 * editable so the admin has the final say.
 */
export function EditDesignModal({ orderId, line, products, onClose, onDone }) {
  const toast = useToast();
  const cardCount = line.items.length;
  const [form, setForm] = useState({
    product_id: String(line.product_id || ""),
    price: line.price != null ? String(line.price) : "",
    group_name: line.group_name || "",
    date: line.date ? String(line.date).slice(0, 10) : "",
    addr: line.addr || "",
    song: line.song || "",
    notes: line.notes || "",
  });
  const [cards, setCards] = useState(() =>
    line.items.map((it) => ({
      id: it.id,
      name: it.name || "",
      color: it.color || "",
      image: it.full_image_url || null,
      file: null, // a new picture, uploaded on save
      preview: null,
    })),
  );
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setCard = (idx, changes) =>
    setCards((cs) => cs.map((c, i) => (i === idx ? { ...c, ...changes } : c)));

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

  // Saving swaps a card to the catalog picture of its new color or design,
  // unless a picture was uploaded for it.
  const followsColor = (card, index) =>
    !card.file &&
    colorOptions.some((c) => c.name === card.color) &&
    (card.color !== line.items[index].color ||
      String(line.product_id) !== form.product_id);

  const [submit, busy] = useAction(async () => {
    try {
      const data = new FormData();
      data.append(
        "design",
        JSON.stringify({
          productId: form.product_id ? Number(form.product_id) : undefined,
          price: form.price === "" ? undefined : Number(form.price),
          groupName: form.group_name || undefined,
          date: form.date || undefined,
          addr: form.addr || undefined,
          song: form.song || undefined,
          notes: form.notes || undefined,
          items: cards.map((c) => ({ id: c.id, name: c.name, color: c.color })),
        }),
      );
      for (const c of cards) if (c.file) data.append(`image_${c.id}`, c.file);
      await ordersApi.updateDesign(orderId, line.id, data);
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
                  {line.product_name || "Current product"}
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
            <span>Price (EGP) — {countLabel(cardCount, line.kind)}</span>
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
                No preset price for {countLabel(cardCount, line.kind)} — enter
                it manually.
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
            <span>Items — image, name &amp; colour</span>
            <div className="stack gap-14">
              {cards.map((c, i) => (
                <div key={c.id ?? i} className="edit-card">
                  <CardImage
                    card={c}
                    name={c.name || `${line.kind} ${i + 1}`}
                    followsColor={followsColor(c, i)}
                    onChange={(changes) => setCard(i, changes)}
                  />
                  <div className="grid-2 gap-12">
                    <label className="field">
                      <span className="small muted">Name</span>
                      <input
                        className="input"
                        value={c.name}
                        onChange={(e) => setCard(i, { name: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="small muted">Colour</span>
                      {colorSelect(c.color, (e) =>
                        setCard(i, { color: e.target.value }),
                      )}
                    </label>
                  </div>
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

/** A card's picture, with a button to pick a new one. Uploaded on save. */
function CardImage({ card, name, followsColor, onChange }) {
  const toast = useToast();
  const input = useRef(null);
  const shown = card.preview || card.image;

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still counts
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choose a PNG, JPG or WebP image", "err");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ file, preview: reader.result });
    reader.onerror = () => toast("Couldn't read that image", "err");
    reader.readAsDataURL(file);
  };

  return (
    <div className="stack gap-6">
      {shown ? (
        <img className="item-thumb" src={shown} alt={name} />
      ) : (
        <div className="item-thumb edit-card-empty">No image</div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={pick}
      />
      <button
        type="button"
        className="btn sm"
        aria-label={`Change image of ${name}`}
        onClick={() => input.current.click()}
      >
        Change
      </button>
      {card.file && (
        <button
          type="button"
          className="btn sm ghost"
          aria-label={`Undo new image of ${name}`}
          onClick={() => onChange({ file: null, preview: null })}
        >
          Undo
        </button>
      )}
      {followsColor && (
        <span className="small muted">Switches to the new colour on save</span>
      )}
    </div>
  );
}
