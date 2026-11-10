import { useState } from "react";
import { IconExternal, IconPlus, IconUser } from "../../components/Icons.jsx";
import { ThemeChips } from "../../components/ThemeChips.jsx";
import { Badge, Can, CopyField, Modal } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { nfcApi, ordersApi } from "../../lib/api.js";
import { fmtDate } from "../../lib/format.js";

/**
 * The NFC links of an order. Each order item gets one shared profile, and
 * each physical card or keychain in it gets its own link. The customer
 * connects an item to their account by scanning it.
 */
export function ProfileCard({
  orderId,
  lines,
  lineTitle,
  profiles,
  onChanged,
}) {
  const toast = useToast();
  const hasProfile = (line) => profiles.some((p) => p.line_id === line.id);
  const missing = lines.filter((line) => !hasProfile(line));

  const [create, busy] = useAction(async () => {
    try {
      const res = await ordersApi.createProfile(orderId);
      const links = res.profiles.reduce((n, p) => n + p.items.length, 0);
      toast(`${links} link${links === 1 ? "" : "s"} created`);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>NFC links</h3>
      </div>
      <div className="card-body stack gap-18">
        {profiles.map((profile) => (
          <ProfileBlock
            key={profile.id}
            profile={profile}
            title={lineTitle(lines.find((l) => l.id === profile.line_id))}
            onChanged={onChanged}
          />
        ))}
        {missing.length > 0 && (
          <Can
            perm="profiles.create"
            fallback={
              <div className="small muted">No profile created yet.</div>
            }
          >
            <button className="btn primary" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create profile & get link"}
            </button>
          </Can>
        )}
      </div>
    </div>
  );
}

/** One order item's shared profile: its links and its themes. */
function ProfileBlock({ profile, title, onChanged }) {
  const [adding, setAdding] = useState(false);

  // Toggling a chip updates these right away; a reload of the order replaces
  // them (adjusting state during render rather than in an effect).
  const [themes, setThemes] = useState(profile.themes);
  const [themesFrom, setThemesFrom] = useState(profile.themes);
  if (profile.themes !== themesFrom) {
    setThemesFrom(profile.themes);
    setThemes(profile.themes);
  }

  return (
    <div className="stack gap-10">
      <div className="row wrap gap-8">
        <div>
          <div className="strong">{title}</div>
          <div className="small muted">
            Shared profile <span className="mono">{profile.pid}</span>
          </div>
        </div>
        <div className="grow" />
        <Can perm="profiles.items.manage">
          <button className="btn sm" onClick={() => setAdding(true)}>
            <IconPlus size={14} /> Add item
          </button>
        </Can>
      </div>

      {profile.items.length === 0 && (
        <div className="small muted">
          No items left on this profile. Add one to make a new link.
        </div>
      )}
      {profile.items.map((item) => (
        <NfcItemRow key={item.id} item={item} onChanged={onChanged} />
      ))}

      {themes.length > 0 && (
        <Can perm="profiles.themes.add">
          <div>
            <div className="small strong muted" style={{ margin: "6px 0" }}>
              PROFILE THEMES — click to assign / remove
            </div>
            <ThemeChips
              holder={{ profileId: profile.id }}
              themes={themes}
              onChange={setThemes}
              gap={6}
            />
          </div>
        </Can>
      )}

      {adding && (
        <AddItemModal
          profile={profile}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ItemStatus({ item }) {
  if (item.status === "blocked")
    return <Badge color="var(--danger)">Blocked</Badge>;
  if (item.owner) return <Badge color="var(--st-shipped)">Connected</Badge>;
  return <Badge color="var(--ink-3)">Not connected</Badge>;
}

/** One physical item: its link, who it's connected to, and what staff can do. */
function NfcItemRow({ item, onChanged }) {
  const toast = useToast();
  const blocked = item.status === "blocked";

  // `confirmText` guards the actions that can't be undone.
  const [run, busy] = useAction(async (action, done, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await action();
      toast(done);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const toggleBlock = () =>
    run(
      () => nfcApi.setStatus(item.id, blocked ? "active" : "blocked"),
      blocked ? `${item.label} unblocked` : `${item.label} blocked`,
    );
  const disconnect = () =>
    run(
      () => nfcApi.disconnect(item.id),
      `${item.label} disconnected`,
      `Disconnect ${item.label} from @${item.owner.username}?\n\nThe next person to scan it can connect it.`,
    );
  const replace = () =>
    run(
      () => nfcApi.replaceLink(item.id),
      "New link made",
      `Replace the link of ${item.label}?\n\nThe old link stops working for good, so the item must be programmed again.`,
    );
  const remove = () =>
    run(
      () => nfcApi.remove(item.id),
      `${item.label} deleted`,
      `Delete ${item.label}?\n\nIts link stops working for good. This can't be undone.`,
    );

  return (
    <div className="nfc-item stack gap-6">
      <div className="row wrap gap-6">
        <span className="strong">{item.label}</span>
        <span className="small muted">
          {item.kind}
          {item.is_extra ? " · extra" : ""}
        </span>
        <div className="grow" />
        <ItemStatus item={item} />
      </div>
      {item.owner && (
        <div className="small muted">
          @{item.owner.username} · {fmtDate(item.connected_at)}
        </div>
      )}
      <CopyField
        value={item.link}
        label={`link of ${item.label}`}
        style={{ width: "100%" }}
      />
      <div className="row wrap gap-6">
        <a className="btn sm" href={item.link} target="_blank" rel="noreferrer">
          <IconExternal /> Open
        </a>
        <Can perm="profiles.items.manage">
          <button className="btn sm" onClick={toggleBlock} disabled={busy}>
            {blocked ? "Unblock" : "Block"}
          </button>
          {item.owner && (
            <button className="btn sm" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          )}
          <button className="btn sm" onClick={replace} disabled={busy}>
            Replace link
          </button>
          <button
            className="btn sm ghost danger"
            onClick={remove}
            disabled={busy}
          >
            Delete
          </button>
        </Can>
      </div>
    </div>
  );
}

/** One more link on this profile. The order's price doesn't change. */
function AddItemModal({ profile, onClose, onDone }) {
  const toast = useToast();
  const [label, setLabel] = useState("");

  const [submit, busy] = useAction(async () => {
    try {
      await nfcApi.add(profile.id, label.trim());
      toast("Item added");
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      title="Add an item"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !label.trim()}
          >
            {busy ? "Adding…" : "Add item"}
          </button>
        </>
      }
    >
      <div className="stack gap-10">
        <label className="field">
          <span>Whose item is it?</span>
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
          />
        </label>
        <div className="small muted">
          This makes one more link on profile{" "}
          <span className="mono">{profile.pid}</span>. It doesn&apos;t change
          the order&apos;s price or production list.
        </div>
      </div>
    </Modal>
  );
}
