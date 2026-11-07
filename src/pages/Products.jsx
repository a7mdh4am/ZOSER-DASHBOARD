import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlus, IconX } from "../components/Icons.jsx";
import { Can, Empty, Modal, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { productsApi } from "../lib/api.js";
import { money } from "../lib/format.js";

/**
 * Product catalog (admin): card designs + colors (each with its own
 * face/back photo) + card-count price tiers. No more couples/friends
 * category — a design just has price tiers by card count, and the
 * storefront labels 2 cards "Couples" / 3+ "Friends" purely from the
 * customer's own selection (see docs/API_MIGRATION_STATUS.md).
 */
export default function Products() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // product summary object or 'new'

  const load = useCallback(
    () =>
      productsApi
        .list()
        .then((products) => setData({ products }))
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Empty title="Couldn't load products" hint={error} />;
  if (!data)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

  return (
    <div className="stack">
      <div className="row no-print">
        <div className="small muted">
          A design is sellable only when it's <strong>active + in stock</strong>{" "}
          and has at least one color and one price tier.
        </div>
        <div className="grow" />
        <Can perm="catalog.products.add">
          <button className="btn primary sm" onClick={() => setEditing("new")}>
            <IconPlus size={14} /> New design
          </button>
        </Can>
      </div>

      <div className="design-grid">
        {data.products.map((p) => (
          <ProductCard key={p.id} product={p} onEdit={() => setEditing(p)} />
        ))}
      </div>

      {editing && (
        <ProductModal
          productId={editing === "new" ? null : editing.id}
          onClose={() => setEditing(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductImg({ url, size = 64 }) {
  if (!url) {
    return (
      <div
        className="item-thumb"
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-3)",
          fontSize: 10,
        }}
      >
        none
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="item-thumb"
      style={{ width: size, height: size, aspectRatio: "auto" }}
    />
  );
}

function flagBadges(p) {
  const flags = [];
  if (!p.is_active) flags.push(["inactive", "var(--ink-3)"]);
  if (!p.in_stock) flags.push(["out of stock", "var(--st-cancelled)"]);
  if (p.is_new) flags.push(["new", "var(--accent)"]);
  if (p.is_limited) flags.push(["limited", "var(--st-pending)"]);
  return flags;
}

function ProductCard({ product: p, onEdit }) {
  const priceSummary = p.card_price_tiers.length
    ? p.card_price_tiers
        .map((r) => `${r.cards_count}→${Number(r.price)}`)
        .join(" · ")
    : "no price tiers!";

  return (
    <div
      className="card design-card"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault(); // Space would also scroll the page
        onEdit();
      }}
    >
      <div className="card-body" style={{ padding: 14 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <ProductImg url={p.product_images[0]?.image_url} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong">{p.name}</div>
            <div className="small muted">
              {p.product_types.name} · qty {p.quantity}
            </div>
            <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
              {flagBadges(p).map(([label, color]) => (
                <span
                  key={label}
                  className="badge"
                  style={{ "--badge-c": color }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 4 }}>
          {p.colors.map((c) => (
            <span
              key={c.id}
              className="color-dot"
              title={c.name}
              style={{ background: c.hex, width: 14, height: 14 }}
            />
          ))}
          {!p.colors.length && (
            <span className="small" style={{ color: "var(--danger)" }}>
              no colors!
            </span>
          )}
        </div>
        <div
          className="small muted mono"
          style={{
            marginTop: 6,
            color: p.card_price_tiers.length ? undefined : "var(--danger)",
          }}
        >
          {priceSummary}
        </div>
      </div>
    </div>
  );
}

/* ---------------- create / edit modal ---------------- */

const BLANK = {
  name: "",
  slug: "",
  description: "",
  is_active: true,
  is_new: true,
  in_stock: true,
  is_limited: false,
  quantity: 999,
};

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formFrom = (p) => ({
  name: p.name,
  slug: p.slug,
  description: p.description || "",
  is_active: p.is_active,
  is_new: p.is_new,
  in_stock: p.in_stock,
  is_limited: p.is_limited,
  quantity: p.quantity,
});

function ProductModal({ productId, onClose, onChanged }) {
  const toast = useToast();
  const isNew = !productId;
  const [product, setProduct] = useState(null); // full detail once loaded/created
  const [form, setForm] = useState(BLANK);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);

  // Re-reads the design without touching the form, so unsaved edits to the
  // name or description survive adding a color, image or price tier.
  const fetchProduct = useCallback(
    (id) =>
      productsApi.get(id).then((p) => {
        setProduct(p);
        return p;
      }),
    [],
  );

  // Opening the modal, and after a save: the form shows what's saved.
  const load = useCallback(
    (id) => fetchProduct(id).then((p) => setForm(formFrom(p))),
    [fetchProduct],
  );

  useEffect(() => {
    if (productId) load(productId);
  }, [productId, load]);

  // Colors, images and price tiers show on the grid behind the modal too.
  const onPartsChanged = () => {
    fetchProduct(product.id);
    onChanged();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setFlag = (k) => (e) => setForm({ ...form, [k]: e.target.checked });

  const onName = (e) => {
    const name = e.target.value;
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugify(name),
    }));
  };

  const save = async () => {
    setBusy(true);
    try {
      if (product) {
        await productsApi.save(product.id, {
          name: form.name,
          description: form.description,
          isNew: form.is_new,
          inStock: form.in_stock,
          isLimited: form.is_limited,
          quantity: Number(form.quantity) || 0,
        });
        // Retiring or reactivating a design has its own endpoint; the edit
        // body above doesn't carry it.
        if (form.is_active !== product.is_active)
          await productsApi.toggle(product.id, form.is_active);
        toast("Design updated");
        await load(product.id);
      } else {
        const created = await productsApi.save(null, {
          typeCode: "CARD",
          slug: form.slug,
          name: form.name,
          description: form.description,
          isNew: form.is_new,
          inStock: form.in_stock,
          isLimited: form.is_limited,
          quantity: Number(form.quantity) || 0,
        });
        toast("Design created — now add colors and a price tier");
        await load(created.id);
      }
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title={product ? `Edit — ${form.name}` : "New design"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <Can
            perm={product ? "catalog.products.update" : "catalog.products.add"}
          >
            {/* The shop shows every design's description next to it, so it's required. */}
            <button
              className="btn primary"
              onClick={save}
              disabled={
                busy ||
                !form.name.trim() ||
                !form.description.trim() ||
                (!product && !form.slug.trim())
              }
            >
              {busy ? "Saving…" : product ? "Save changes" : "Create design"}
            </button>
          </Can>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              value={form.name}
              onChange={onName}
              autoFocus={isNew}
            />
          </label>
          <label className="field">
            <span>Slug (URL)</span>
            <input
              className="input mono"
              value={form.slug}
              disabled={!!product}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug")(e);
              }}
              placeholder="minimal-couples-card"
            />
          </label>
        </div>

        <label className="field">
          <span>Description (shop copy)</span>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={set("description")}
          />
        </label>

        <div className="row wrap" style={{ gap: 16 }}>
          {[
            ["is_active", "Active"],
            ["in_stock", "In stock"],
            ["is_new", "New badge"],
            ["is_limited", "Limited"],
          ].map(([k, l]) => (
            <label
              key={k}
              className="row"
              style={{ gap: 6, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={form[k]}
                onChange={setFlag(k)}
                disabled={k === "is_active" && !product}
              />{" "}
              {l}
            </label>
          ))}
          <label className="field" style={{ width: 110 }}>
            <span>Quantity</span>
            <input
              className="input"
              type="number"
              min="0"
              value={form.quantity}
              onChange={set("quantity")}
            />
          </label>
        </div>

        {product ? (
          <>
            <CoverImageEditor product={product} onChanged={onPartsChanged} />
            <ColorsEditor product={product} onChanged={onPartsChanged} />
            <PricesEditor product={product} onChanged={onPartsChanged} />
          </>
        ) : (
          <div className="small muted">
            Create the design first, then add its cover image, colors and price
            tiers here.
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The shop-listing thumbnail — a single kind="gallery" image, no color. */
function CoverImageEditor({ product, onChanged }) {
  const toast = useToast();
  const inputRef = useRef();
  const [busy, setBusy] = useState(false);
  const cover = product.product_images.find(
    (i) => i.kind === "gallery" && !i.color_id,
  );

  const upload = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", "gallery");
      fd.append("sortOrder", "0");
      fd.append("file", picked);
      await productsApi.uploadColorImage(product.id, fd);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setBusy(false);
    }
  };

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
      <div className="small strong muted" style={{ marginBottom: 8 }}>
        COVER IMAGE (shop listing)
      </div>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
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

function ColorsEditor({ product, onChanged }) {
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
      <div className="small strong muted" style={{ marginBottom: 8 }}>
        COLORS ({product.colors.length})
      </div>
      <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
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
              <div className="row" style={{ gap: 10 }}>
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
          <span className="small" style={{ color: "var(--danger)" }}>
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
  const [busy, setBusy] = useState(false);
  const image = images.find((i) => i.color_id === color.id && i.kind === side);

  const upload = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

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

function PricesEditor({ product, onChanged }) {
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
      <div className="small strong muted" style={{ marginBottom: 8 }}>
        PRICE TIERS (by card count)
      </div>
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
                  <td style={{ textAlign: "right" }}>
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
        <div
          className="small"
          style={{ color: "var(--danger)", marginBottom: 8 }}
        >
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
