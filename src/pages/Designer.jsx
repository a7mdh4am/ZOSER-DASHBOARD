import { useState } from "react";
import { IconMusic, IconPhone } from "../components/Icons.jsx";
import {
  CustomizationFields,
  OrderItemsGrid,
  PhoneActions,
} from "../components/order.jsx";
import {
  Badge,
  Empty,
  Modal,
  PageLoader,
  Pager,
  SearchInput,
  Segmented,
  StatusBadge,
  TimelineItem,
} from "../components/ui.jsx";
import { useToast } from "../context/toast.js";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { designerApi } from "../lib/api.js";
import { colorHex, fmtDate, relDay } from "../lib/format.js";

export default function Designer() {
  const [tab, setTab] = useState("1"); // '1' deposited (to design) | '5' in production
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const { data, error, loading, reload } = useApiData(
    () => designerApi.list({ status: tab, search, page: String(page) }),
    [tab, search, page],
  );

  return (
    <div className="stack">
      <div className="row wrap">
        <Segmented
          label="Queue"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={[
            ["1", `To design${data ? ` · ${data.counts.deposited}` : ""}`],
            ["5", `In production${data ? ` · ${data.counts.production}` : ""}`],
          ]}
        />
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
        <PageLoader />
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
                    ].map((c) => (
                      <Badge key={c} color={colorHex(c) || "var(--ink-3)"}>
                        {c}
                      </Badge>
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
            reload();
          }}
        />
      )}
    </div>
  );
}

function DesignDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, error } = useApiData(() => designerApi.get(id), [id]);

  const [moveToProduction, busy] = useAction(async () => {
    try {
      await designerApi.setStatus(id);
      toast(`Order #${id} moved to production`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const order = data?.order;

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
        <PageLoader padding={40} />
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
              <OrderItemsGrid items={data.items} nameClassName="copy-line" />
            </div>
          )}

          <CustomizationFields order={order} />

          {/* production notes */}
          {data.notes.length > 0 && (
            <div>
              <div className="small strong muted" style={{ marginBottom: 8 }}>
                PRODUCTION NOTES
              </div>
              <div className="timeline">
                {data.notes.map((n, i) => (
                  <TimelineItem key={i} color="var(--st-production)">
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
                  </TimelineItem>
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
            <PhoneActions phone={order.phone} />
          </div>
        </div>
      )}
    </Modal>
  );
}
