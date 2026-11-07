// Create or edit a design: details, then its cover image, colors and price tiers.

import { useCallback, useEffect, useState } from "react";
import { Can, Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { productsApi } from "../../lib/api.js";
import { CoverImageEditor, ColorsEditor, PricesEditor } from "./editors.jsx";

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

export function ProductModal({ productId, onClose, onChanged }) {
  const toast = useToast();
  const isNew = !productId;
  const [product, setProduct] = useState(null); // full detail once loaded/created
  const [form, setForm] = useState(BLANK);
  const [slugTouched, setSlugTouched] = useState(!isNew);

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

  const [save, busy] = useAction(async () => {
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
    }
  });

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
