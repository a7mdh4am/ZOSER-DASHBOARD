import { useState } from "react";
import { IconPlus } from "../../components/Icons.jsx";
import { Can, Modal } from "../../components/ui.jsx";
import { useAuth } from "../../context/auth.js";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";
import { money2 } from "../../lib/format.js";

const OTHER = "__other";

/** One order item's add-ons (star theme, sticker pack...), and editing them. */
export function ExtrasSection({ orderId, line, options, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  // null: closed; "new": adding; an add-on: editing that one.
  const [editing, setEditing] = useState(null);

  const [remove, removing] = useAction(async (extra) => {
    if (
      !window.confirm(
        `Remove ${extra.extra_name}?\n\nThe order total goes down by ${money2(extra.extra_price)}.`,
      )
    )
      return;
    try {
      await ordersApi.deleteExtra(orderId, line.id, extra.id);
      toast(`${extra.extra_name} removed`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (!line.extras.length && !can("orders.details.update")) return null;

  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 6 }}>
        <div className="small strong muted">Add-ons</div>
        <div className="grow" />
        <Can perm="orders.details.update">
          <button className="btn sm" onClick={() => setEditing("new")}>
            <IconPlus size={14} /> Add
          </button>
        </Can>
      </div>
      {line.extras.length === 0 && (
        <div className="small muted">No add-ons on this item.</div>
      )}
      <div className="price-rows">
        {line.extras.map((x) => (
          <div className="pr" key={x.id}>
            <span>{x.extra_name}</span>
            <span className="row gap-6">
              <span className="mono">+{money2(x.extra_price)}</span>
              <Can perm="orders.details.update">
                <button
                  className="btn sm ghost"
                  aria-label={`Edit ${x.extra_name}`}
                  onClick={() => setEditing(x)}
                >
                  Edit
                </button>
                <button
                  className="btn sm ghost danger"
                  aria-label={`Remove ${x.extra_name}`}
                  onClick={() => remove(x)}
                  disabled={removing}
                >
                  Remove
                </button>
              </Can>
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <ExtraModal
          orderId={orderId}
          line={line}
          extra={editing === "new" ? null : editing}
          options={options}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/** Add an add-on from the shop's list or a custom one, or edit an existing one. */
function ExtraModal({ orderId, line, extra, options, onClose, onDone }) {
  const toast = useToast();
  // Only what this item doesn't have yet can be added.
  const available = options.filter(
    (o) => !line.extras.some((x) => x.extra_name === o.extra_name),
  );
  const [choice, setChoice] = useState(
    extra || !available.length ? OTHER : available[0].extra_name,
  );
  const [name, setName] = useState(extra?.extra_name ?? "");
  const [price, setPrice] = useState(
    String(extra?.extra_price ?? available[0]?.extra_price ?? ""),
  );
  const custom = choice === OTHER;
  const finalName = custom ? name.trim() : choice;

  const onChoice = (e) => {
    const next = e.target.value;
    setChoice(next);
    const option = options.find((o) => o.extra_name === next);
    if (option) setPrice(String(option.extra_price));
  };

  const [submit, busy] = useAction(async () => {
    const body = { name: finalName, price };
    try {
      if (extra) await ordersApi.updateExtra(orderId, line.id, extra.id, body);
      else await ordersApi.addExtra(orderId, line.id, body);
      toast(extra ? "Add-on updated" : "Add-on added");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title={extra ? `Edit ${extra.extra_name}` : "Add an add-on"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !finalName || !(Number(price) >= 0) || !price}
          >
            {busy ? "Saving…" : extra ? "Save changes" : "Add"}
          </button>
        </>
      }
    >
      <div className="stack gap-10">
        {!extra && (
          <label className="field">
            <span>Add-on</span>
            <select className="input" value={choice} onChange={onChoice}>
              {available.map((o) => (
                <option key={o.extra_name} value={o.extra_name}>
                  {o.extra_name}
                </option>
              ))}
              <option value={OTHER}>Other…</option>
            </select>
          </label>
        )}
        {custom && (
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
        )}
        <label className="field">
          <span>Price (EGP)</span>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
