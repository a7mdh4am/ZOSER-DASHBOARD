// Pieces of an order shown both on the order page and in the Design Studio.

import { colorHex, fmtProductionDate, waLink } from "../lib/format.js";
import { IconDownload, IconMusic, IconWhatsapp } from "./Icons.jsx";
import { CopyButton } from "./ui.jsx";

// Saves a file under a name of ours. A link's own `download` is ignored for another
// origin (the API's), so it's fetched first; failing that, it opens in a new tab
async function saveFile(url, name) {
  try {
    const blob = await (await fetch(url)).blob();
    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.${ext}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch {
    window.open(url, "_blank", "noreferrer");
  }
}

/**
 * The order's items: the photo the customer picked for each person (a card's), or else
 * the design's picture (keychains, necklaces, bracelets have no photo); it opens full
 * size. Then the name with a copy button, the color, and a download of that picture.
 * `nameClassName` wraps the name and its copy button ("copy-line" puts a gap between
 * them, as in the Design Studio).
 */
export function OrderItemsGrid({ items, nameClassName }) {
  return (
    <div className="items-grid">
      {items.map((it, i) => {
        const picture = it.photo_url || it.full_image_url;
        return (
          <div className="item-cell" key={it.id ?? i}>
            {picture ? (
              <a href={picture} target="_blank" rel="noreferrer">
                <img
                  className="item-thumb"
                  src={picture}
                  alt={it.photo_url ? `${it.name}'s photo` : it.name}
                  loading="lazy"
                  decoding="async"
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
            <div className="row gap-6" style={{ marginTop: 2 }}>
              {it.color && (
                <>
                  <span
                    className="color-dot"
                    style={{
                      background:
                        it.color_hex ||
                        colorHex(it.color) ||
                        "var(--surface-2)",
                    }}
                    title={it.color}
                  />
                  <span className="small muted">{it.color}</span>
                </>
              )}
              {picture && (
                <button
                  type="button"
                  className="small text-accent gap-4"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    saveFile(
                      picture,
                      it.photo_url ? `${it.name} photo` : it.name,
                    )
                  }
                >
                  <IconDownload size={12} /> Download
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * What the customer asked for: group name, anniversary date, on-card address,
 * song and notes of one order item, each with a copy button.
 */
export function CustomizationFields({ order }) {
  const fields = [
    ["Group name", order.group_name],
    ["Anniversary date", order.date ? fmtProductionDate(order.date) : null],
    ["Addr", order.addr],
  ].filter((field) => field[1]);

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
              className="text-accent break-anywhere"
              href={order.song}
              target="_blank"
              rel="noreferrer"
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
          <div className="v copy-line pre-wrap">
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
