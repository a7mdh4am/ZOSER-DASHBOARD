// Pieces of an order shown both on the order page and in the Design Studio.

import { colorHex, fmtProductionDate, waLink } from "../lib/format.js";
import { IconDownload, IconMusic, IconWhatsapp } from "./Icons.jsx";
import { CopyButton } from "./ui.jsx";

/**
 * The order's cards: photo (opens full size), name with a copy button, color
 * and a download link. `nameClassName` wraps the name and its copy button
 * ("copy-line" puts a gap between them, as in the Design Studio).
 */
export function OrderItemsGrid({ items, nameClassName }) {
  return (
    <div className="items-grid">
      {items.map((it, i) => (
        <div className="item-cell" key={it.id ?? i}>
          {it.full_image_url ? (
            <a href={it.full_image_url} target="_blank" rel="noreferrer">
              <img
                className="item-thumb"
                src={it.full_image_url}
                alt={it.name}
                loading="lazy"
              />
            </a>
          ) : (
            <div
              className="item-thumb"
              style={{
                display: "grid",
                placeItems: "center",
                color: "var(--ink-3)",
              }}
            >
              No image
            </div>
          )}
          <div className="in">
            <span className={nameClassName}>
              {it.name}
              <CopyButton text={it.name} label="name" />
            </span>
          </div>
          <div className="row" style={{ gap: 6, marginTop: 2 }}>
            {it.color && (
              <>
                <span
                  className="color-dot"
                  style={{
                    background: colorHex(it.color) || "var(--surface-2)",
                  }}
                  title={it.color}
                />
                <span className="small muted">{it.color}</span>
              </>
            )}
            {it.full_image_url && (
              <a
                className="small"
                style={{
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                href={it.full_image_url}
                download
              >
                <IconDownload size={12} /> Download
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * What the customer asked for: group name, anniversary date, on-card address,
 * song and notes, each with a copy button. `showDesign` adds the design name.
 */
export function CustomizationFields({ order, showDesign = false }) {
  const fields = [
    showDesign && ["Design", order.product_name],
    ["Group name", order.group_name],
    ["Anniversary date", order.date ? fmtProductionDate(order.date) : null],
    ["Addr", order.addr],
  ].filter((field) => field && field[1]);

  return (
    <div className="kv">
      {fields.map(([k, v]) => (
        <div className="kv-item" key={k}>
          <div className="k">{k}</div>
          <div className="v copy-line">
            {v}
            <CopyButton text={v} label={k} />
          </div>
        </div>
      ))}
      {order.song && (
        <div className="kv-item full">
          <div className="k">Song</div>
          <div className="v copy-line">
            <IconMusic />
            <a
              href={order.song}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", overflowWrap: "anywhere" }}
            >
              {order.song}
            </a>
            <CopyButton text={order.song} label="song URL" />
          </div>
        </div>
      )}
      {order.notes && (
        <div className="kv-item full">
          <div className="k">Customer notes</div>
          <div className="v copy-line" style={{ whiteSpace: "pre-wrap" }}>
            {order.notes}
            <CopyButton text={order.notes} label="notes" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Copy-the-number and message-on-WhatsApp buttons for a customer's phone. */
export const PhoneActions = ({ phone }) => (
  <>
    <CopyButton text={phone} label="phone" />
    <a
      className="copy-btn"
      style={{ color: "var(--st-shipped)" }}
      href={waLink(phone)}
      target="_blank"
      rel="noreferrer"
      title="WhatsApp"
      aria-label="Message on WhatsApp"
    >
      <IconWhatsapp />
    </a>
  </>
);
