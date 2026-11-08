import { useState } from "react";
import { IconPlus } from "../../components/Icons.jsx";
import { Badge, Can, Empty, PageLoader } from "../../components/ui.jsx";
import { useApiData } from "../../hooks/useApiData.js";
import { productsApi } from "../../lib/api.js";
import { ProductImg } from "./ProductImg.jsx";
import { ProductModal } from "./ProductModal.jsx";

/**
 * Product catalog (admin): card designs + colors (each with its own
 * face/back photo) + card-count price tiers. No more couples/friends
 * category — a design just has price tiers by card count, and the
 * storefront labels 2 cards "Couples" / 3+ "Friends" purely from the
 * customer's own selection (see docs/API_MIGRATION_STATUS.md).
 */
export default function Products() {
  const [editing, setEditing] = useState(null); // product summary object or 'new'
  const {
    data: products,
    error,
    reload: load,
  } = useApiData(() => productsApi.list(), []);

  if (error) return <Empty title="Couldn't load products" hint={error} />;
  if (!products) return <PageLoader />;

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
        {products.map((p) => (
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
            <div className="row wrap gap-4" style={{ marginTop: 6 }}>
              {flagBadges(p).map(([label, color]) => (
                <Badge key={label} color={color} dot={false}>
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="row gap-4" style={{ marginTop: 10 }}>
          {p.colors.map((c) => (
            <span
              key={c.id}
              className="color-dot"
              title={c.name}
              style={{ background: c.hex, width: 14, height: 14 }}
            />
          ))}
          {!p.colors.length && (
            <span className="small text-danger">no colors!</span>
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
