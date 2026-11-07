import { useCallback, useEffect, useState } from "react";
import {
  IconDownload,
  IconMusic,
  IconPhone,
  IconWhatsapp,
} from "../components/Icons.jsx";
import {
  CopyButton,
  Empty,
  Modal,
  Pager,
  SearchInput,
  Spinner,
  StatusBadge,
} from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { designerApi } from "../lib/api.js";
import {
  colorHex,
  fmtDate,
  fmtProductionDate,
  relDay,
  waLink,
} from "../lib/format.js";

export default function Designer() {
  const [tab, setTab] = useState("1"); // '1' deposited (to design) | '5' in production
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return designerApi
      .list({ status: tab, search, page: String(page) })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, search, page]);

  // Fetch on mount and whenever the tab, search or page changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flags loading first
    load();
  }, [load]);

  return (
    <div className="stack">
      <div className="row wrap">
        <div className="seg" role="group" aria-label="Queue">
          <button
            className={tab === "1" ? "active" : ""}
            aria-pressed={tab === "1"}
            onClick={() => {
              setTab("1");
              setPage(1);
            }}
          >
            To design{data ? ` · ${data.counts.deposited}` : ""}
          </button>
          <button
            className={tab === "5" ? "active" : ""}
            aria-pressed={tab === "5"}
            onClick={() => {
              setTab("5");
              setPage(1);
            }}
          >
            In production{data ? ` · ${data.counts.production}` : ""}
          </button>
        </div>
        <div className="grow" style={{ minWidth: 200, maxWidth: 380 }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search id, name, group…"
          />
        </div>
      </div>

      {loading && !data ? (
        <div style={{ padding: 60 }}>
          <Spinner />
        </div>
      ) : error ? (
        <Empty title="Couldn't load the queue" hint={error} />
      ) : !data.orders.length ? (
        <Empty
          title={
            tab === "1" ? "Design queue is clear 🎉" : "Nothing in production"
          }
          hint={
            tab === "1"
              ? "Deposited orders appear here, oldest first."
              : undefined
          }
        />
      ) : (
        <>
          <div className="design-grid" style={{ opacity: loading ? 0.6 : 1 }}>
            {data.orders.map((o) => (
              <div
                className="card design-card"
                key={o.id}
                onClick={() => setOpenId(o.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault(); // Space would also scroll the page
                  setOpenId(o.id);
                }}
              >
                <div className="card-body" style={{ padding: 14 }}>
                  <div className="row">
                    <span className="strong" style={{ fontSize: 15 }}>
                      #{o.id}
                    </span>
                    <StatusBadge status={o.status} />
                    <div className="grow" />
                    <span className="small muted">{relDay(o.order_time)}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div className="strong">{o.full_name}</div>
                    <div className="small muted">
                      {o.product_name || "—"} · {o.item_count} card
                      {o.item_count === 1 ? "" : "s"}
                      {o.group_name ? ` · ${o.group_name}` : ""}
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 6 }}>
                    {[
                      ...new Set(
                        (o.item_colors || "").split(",").filter(Boolean),
                      ),
                    ].map((c, i) => (
                      <span
                        key={i}
                        className="badge"
                        style={{ "--badge-c": colorHex(c) || "var(--ink-3)" }}
                      >
                        <span className="dot" />
                        {c}
                      </span>
                    ))}
                    {o.song && <IconMusic />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <Pager
              page={page}
              perPage={data.per_page}
              total={data.total}
              onPage={setPage}
            />
          </div>
        </>
      )}

      {openId && (
        <DesignDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DesignDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    designerApi
      .get(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const moveToProduction = async () => {
    setBusy(true);
    try {
      await designerApi.setStatus(id);
      toast(`Order #${id} moved to production`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
      setBusy(false);
    }
  };

  const order = data?.order;
  const fields = order
    ? [
        ["Group name", order.group_name],
        ["Anniversary date", order.date ? fmtProductionDate(order.date) : null],
        ["Addr", order.addr],
      ].filter(([, v]) => v)
    : [];

  return (
    <Modal
      wide
      title={order ? `Order #${order.id} — ${order.full_name}` : `Order #${id}`}
      onClose={onClose}
      footer={
        order && String(order.status) === "1" ? (
          <>
            <button className="btn" onClick={onClose}>
              Close
            </button>
            <button
              className="btn primary"
              onClick={moveToProduction}
              disabled={busy}
            >
              {busy ? "Moving…" : "Design done → Production"}
            </button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <Empty title="Couldn't load order" hint={error} />
      ) : !data ? (
        <div style={{ padding: 40 }}>
          <Spinner />
        </div>
      ) : (
        <div className="stack" style={{ gap: 18 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <StatusBadge status={order.status} />
            <span className="small muted">{order.product_name}</span>
            <div className="grow" />
            <span className="small muted">
              Ordered {fmtDate(order.order_time, true)}
            </span>
          </div>

          {/* cards to produce */}
          {data.items.length > 0 && (
            <div>
              <div className="small strong muted" style={{ marginBottom: 8 }}>
                CARDS ({data.items.length})
              </div>
              <div className="items-grid">
                {data.items.map((it, i) => (
                  <div className="item-cell" key={i}>
                    {it.full_image_url ? (
                      <a
                        href={it.full_image_url}
                        target="_blank"
                        rel="noreferrer"
                      >
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
                      <span className="copy-line">
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
                              background:
                                colorHex(it.color) || "var(--surface-2)",
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
            </div>
          )}

          {/* customization */}
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

          {/* production notes */}
          {data.notes.length > 0 && (
            <div>
              <div className="small strong muted" style={{ marginBottom: 8 }}>
                PRODUCTION NOTES
              </div>
              <div className="timeline">
                {data.notes.map((n, i) => (
                  <div className="tl-item" key={i}>
                    <div className="tl-rail">
                      <div
                        className="tl-dot"
                        style={{ "--tl-c": "var(--st-production)" }}
                      />
                      <div className="tl-line" />
                    </div>
                    <div className="grow">
                      <div style={{ whiteSpace: "pre-wrap" }}>{n.edits}</div>
                      {n.image_url && (
                        <a
                          className="small"
                          style={{ color: "var(--accent)" }}
                          href={n.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View attachment
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* contact — name + phone only (no address, no money on this page) */}
          <div
            className="row"
            style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}
          >
            <IconPhone />
            <span>
              {order.full_name} · <span className="mono">{order.phone}</span>
            </span>
            <CopyButton text={order.phone} label="phone" />
            <a
              className="copy-btn"
              style={{ color: "var(--st-shipped)" }}
              href={waLink(order.phone)}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              aria-label="Message on WhatsApp"
            >
              <IconWhatsapp />
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
