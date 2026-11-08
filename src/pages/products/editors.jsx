// The parts of a design edited inside ProductModal.

import { useRef, useState } from "react";
import { IconPlus, IconX } from "../../components/Icons.jsx";
import { Can } from "../../components/ui.jsx";
import { useAuth } from "../../context/auth.js";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { productsApi } from "../../lib/api.js";
import { money } from "../../lib/format.js";
import { ProductImg } from "./ProductImg.jsx";

/** The shop-listing thumbnail — a single kind="gallery" image, no color. */
export function CoverImageEditor({ product, onChanged }) {
  const toast = useToast();
  const inputRef = useRef();
  const cover = product.product_images.find(
    (i) => i.kind === "gallery" && !i.color_id,
  );

  const [upload, busy] = useAction(async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    try {
      const fd = new FormData();
      fd.append("kind", "gallery");
      fd.append("sortOrder", "0");
      fd.append("file", picked);
      await productsApi.uploadColorImage(product.id, fd);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [clear] = useAction(async () => {
    try {
      await productsApi.deleteColorImage(cover.id);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div>
      <div className="section-label">COVER IMAGE (shop listing)</div>
      <div className="row" style={{ alignItems: "center" }}>
        <ProductImg url={cover?.image_url} size={56} />
        <Can perm="catalog.products.update">
          <button
            type="button"
            className="btn sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : cover ? "Replace" : "Upload"}
          </button>
          {cover && (
            <button type="button" className="btn sm ghost" onClick={clear}>
              Remove
            </button>
          )}
        </Can>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={upload}
        />
      </div>
    </div>
  );
}

export function ColorsEditor({ product, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const canImages = can("catalog.products.update");
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#050a30");

  const [add] = useAction(async () => {
    try {
      await productsApi.addColor(product.id, { name: name.trim(), hex });
      setName("");
      toast("Color added");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [remove] = useAction(async (c) => {
    try {
      await productsApi.deleteColor(c.id);
      toast("Color removed");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div>
      <div className="section-label">COLORS ({product.colors.length})</div>
      <div className="stack gap-10" style={{ marginBottom: 12 }}>
        {product.colors.map((c) => (
          <div key={c.id} className="color-row">
            <span
              className="color-dot"
              style={{ background: c.hex, width: 16, height: 16 }}
            />
            <span className="strong" style={{ minWidth: 90 }}>
              {c.name}
            </span>
            {canImages && (
              <div className="row">
                <ColorImage
                  productId={product.id}
                  color={c}
                  images={product.product_images}
                  side="face"
                  onChanged={onChanged}
                />
                <ColorImage
                  productId={product.id}
                  color={c}
                  images={product.product_images}
                  side="back"
                  onChanged={onChanged}
                />
              </div>
            )}
            <div className="grow" />
            <Can perm="catalog.products.update">
              <button
                type="button"
                className="btn sm ghost icon"
                title="Remove color"
                aria-label={`Remove color ${c.name}`}
                onClick={() => remove(c)}
              >
                <IconX size={13} />
              </button>
            </Can>
          </div>
        ))}
        {!product.colors.length && (
          <span className="small text-danger">
            The shop can't sell this design without at least one color.
          </span>
        )}
      </div>
      <Can perm="catalog.products.update">
        <div className="row">
          <input
            type="color"
            value={hex}
            style={{
              width: 40,
              height: 34,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            onChange={(e) => setHex(e.target.value)}
          />
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Color name (e.g. navy)"
            style={{ maxWidth: 220 }}
          />
          <button
            type="button"
            className="btn sm"
            onClick={add}
            disabled={!name.trim()}
          >
            <IconPlus size={13} /> Add color
          </button>
        </div>
      </Can>
    </div>
  );
}

/** Face/back image slot for one color: preview + upload/replace + clear. */
function ColorImage({ productId, color, images, side, onChanged }) {
  const toast = useToast();
  const inputRef = useRef();
  const image = images.find((i) => i.color_id === color.id && i.kind === side);

  const [upload, busy] = useAction(async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    try {
      const fd = new FormData();
      fd.append("colorId", String(color.id));
      fd.append("kind", side);
      fd.append("sortOrder", "0");
      fd.append("file", picked);
      await productsApi.uploadColorImage(productId, fd);
      toast(`${side === "back" ? "Back" : "Front"} image saved`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [clear] = useAction(async () => {
    try {
      await productsApi.deleteColorImage(image.id);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="color-img">
      <button
        type="button"
        className="color-img-btn"
        title={`${side === "back" ? "Back" : "Front"} image`}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {image ? (
          <ProductImg url={image.image_url} size={40} />
        ) : (
          <span className="color-img-empty">
            {busy ? "…" : side === "back" ? "Back" : "Front"}
          </span>
        )}
      </button>
      {image && (
        <button
          type="button"
          className="color-img-x"
          title="Remove image"
          aria-label={`Remove ${side === "back" ? "back" : "front"} image`}
          onClick={clear}
        >
          <IconX size={11} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={upload}
      />
    </div>
  );
}

export function PricesEditor({ product, onChanged }) {
  const toast = useToast();
  const [row, setRow] = useState({
    cardsCount: 2,
    price: "",
    discountPercentage: "",
  });

  const [save] = useAction(async () => {
    try {
      await productsApi.savePriceTier(product.id, {
        cardsCount: Number(row.cardsCount),
        price: Number(row.price),
        discountPercentage:
          row.discountPercentage === ""
            ? undefined
            : Number(row.discountPercentage),
      });
      toast("Price tier saved");
      setRow({ cardsCount: 2, price: "", discountPercentage: "" });
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [remove] = useAction(async (tier) => {
    try {
      await productsApi.deletePriceTier(tier.id);
      toast("Price tier removed");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div>
      <div className="section-label">PRICE TIERS (by card count)</div>
      {product.card_price_tiers.length > 0 && (
        <div className="table-scroll" style={{ marginBottom: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cards</th>
                <th className="num">Price (EGP)</th>
                <th className="num">Discount %</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {product.card_price_tiers.map((t) => (
                <tr key={t.id}>
                  <td>{t.cards_count}</td>
                  <td className="num strong">{money(t.price)}</td>
                  <td className="num">{t.discount_percentage ?? "—"}</td>
                  <td className="text-right">
                    <Can perm="catalog.prices.update">
                      <button
                        type="button"
                        className="btn sm danger"
                        aria-label={`Remove the ${t.cards_count}-card price tier`}
                        onClick={() => remove(t)}
                      >
                        <IconX size={12} />
                      </button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!product.card_price_tiers.length && (
        <div className="small text-danger" style={{ marginBottom: 8 }}>
          The shop can't price this design without at least one tier.
        </div>
      )}
      <Can perm="catalog.prices.update">
        <div className="row wrap">
          <label className="field" style={{ width: 110 }}>
            <span>Cards</span>
            <input
              className="input"
              type="number"
              min="1"
              max="99"
              value={row.cardsCount}
              onChange={(e) => setRow({ ...row, cardsCount: e.target.value })}
            />
          </label>
          <label className="field" style={{ width: 130 }}>
            <span>Price (EGP)</span>
            <input
              className="input"
              type="number"
              min="0"
              value={row.price}
              onChange={(e) => setRow({ ...row, price: e.target.value })}
            />
          </label>
          <label className="field" style={{ width: 120 }}>
            <span>Discount %</span>
            <input
              className="input"
              type="number"
              min="0"
              max="100"
              value={row.discountPercentage}
              onChange={(e) =>
                setRow({ ...row, discountPercentage: e.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="btn sm"
            style={{ alignSelf: "flex-end" }}
            onClick={save}
            disabled={row.price === ""}
          >
            <IconPlus size={13} /> Save tier
          </button>
        </div>
      </Can>
    </div>
  );
}
