import { useState } from "react";
import { IconExternal, IconPlus, IconX } from "../components/Icons.jsx";
import { ThemeChips } from "../components/ThemeChips.jsx";
import { Badge, Can, Empty, Modal, PageLoader } from "../components/ui.jsx";
import { useToast } from "../context/toast.js";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { customersApi, themesApi } from "../lib/api.js";
import { money } from "../lib/format.js";

/** Color picker next to its hex value; editing either updates both. */
function ColorInput({ value, onChange }) {
  return (
    <div className="row">
      <input
        type="color"
        value={value}
        style={{
          width: 44,
          height: 36,
          border: "none",
          background: "none",
          cursor: "pointer",
        }}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * Themes: purchasable custom profile themes (create/edit + assign to a
 * customer) and site themes (profile color schemes).
 */
export default function Themes() {
  const { data, error, reload: load } = useApiData(() => themesApi.list(), []);

  if (error) return <Empty title="Couldn't load themes" hint={error} />;
  if (!data) return <PageLoader />;

  return (
    <div className="stack">
      <CustomThemes themes={data.custom} onChanged={load} />
      <Can perm="profiles.themes.add">
        <AssignCard />
      </Can>
      <SiteThemes themes={data.site} onChanged={load} />
    </div>
  );
}

/* ---------------- custom (purchasable) themes ---------------- */

const BLANK_CUSTOM = {
  id: null,
  theme: "",
  bg_color: "#252525",
  preview_link: "",
  price: 30,
  is_new: true,
  is_active: true,
};

function CustomThemes({ themes, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const [save, busy] = useAction(async () => {
    try {
      await themesApi.saveCustom({
        id: editing.id ?? undefined,
        theme: editing.theme,
        bgColor: editing.bg_color,
        previewLink: editing.preview_link,
        price: editing.price,
        isNew: editing.is_new,
        isActive: editing.is_active,
      });
      toast(editing.id ? "Theme updated" : "Theme created");
      setEditing(null);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [toggle] = useAction(async (t) => {
    try {
      await themesApi.toggleCustom(t.id, !t.is_active);
      toast(`${t.theme} ${Number(t.is_active) ? "disabled" : "enabled"}`);
      await onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Profile themes (purchasable)</h3>
        <div className="grow" />
        <Can perm="catalog.themes.manage">
          <button
            className="btn sm primary"
            onClick={() => setEditing({ ...BLANK_CUSTOM })}
          >
            <IconPlus size={14} /> New theme
          </button>
        </Can>
      </div>
      <div className="card-body">
        {!themes.length ? (
          <Empty title="No custom themes yet" />
        ) : (
          <div className="design-grid">
            {themes.map((t) => (
              <div className="card" key={t.id} style={{ boxShadow: "none" }}>
                <div
                  style={{
                    height: 56,
                    borderRadius: "12px 12px 0 0",
                    background: t.bg_color,
                    borderBottom: "1px solid var(--hairline)",
                  }}
                />
                <div className="card-body" style={{ padding: 12 }}>
                  <div className="row">
                    <span className="strong">{t.theme}</span>
                    {!!Number(t.is_new) && (
                      <Badge color="var(--accent)" dot={false}>
                        new
                      </Badge>
                    )}
                    {!Number(t.is_active) && (
                      <Badge color="var(--ink-3)" dot={false}>
                        disabled
                      </Badge>
                    )}
                    <div className="grow" />
                    <span className="strong mono">{money(t.price)}</span>
                  </div>
                  <div className="small muted" style={{ margin: "4px 0 8px" }}>
                    {t.owners} owner{Number(t.owners) === 1 ? "" : "s"}
                    {t.preview_link && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          className="text-accent"
                          href={t.preview_link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          preview <IconExternal size={10} />
                        </a>
                      </>
                    )}
                  </div>
                  <Can perm="catalog.themes.manage">
                    <div className="row gap-6">
                      <button
                        className="btn sm"
                        onClick={() =>
                          setEditing({
                            id: t.id,
                            theme: t.theme,
                            bg_color: t.bg_color,
                            preview_link: t.preview_link || "",
                            price: Number(t.price),
                            is_new: !!Number(t.is_new),
                            is_active: !!Number(t.is_active),
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn sm ghost"
                        onClick={() => toggle(t)}
                      >
                        {Number(t.is_active) ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </Can>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={
            editing.id ? `Edit theme — ${editing.theme}` : "New profile theme"
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={save}
                disabled={busy || !editing.theme.trim()}
              >
                {busy ? "Saving…" : "Save theme"}
              </button>
            </>
          }
        >
          <div className="stack gap-14">
            <div className="grid-2 gap-12">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={editing.theme}
                  onChange={(e) =>
                    setEditing({ ...editing, theme: e.target.value })
                  }
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Price (EGP)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={editing.price}
                  onChange={(e) =>
                    setEditing({ ...editing, price: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Background color</span>
              <ColorInput
                value={editing.bg_color}
                onChange={(bg_color) => setEditing({ ...editing, bg_color })}
              />
            </label>
            <label className="field">
              <span>Preview link (optional)</span>
              <input
                className="input"
                value={editing.preview_link}
                placeholder="https://…"
                onChange={(e) =>
                  setEditing({ ...editing, preview_link: e.target.value })
                }
              />
            </label>
            <div className="row gap-18">
              <label className="row gap-6" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editing.is_new}
                  onChange={(e) =>
                    setEditing({ ...editing, is_new: e.target.checked })
                  }
                />
                Mark as new
              </label>
              <label className="row gap-6" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                Active (purchasable)
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- assign to a customer ---------------- */

function AssignCard() {
  const toast = useToast();
  const [username, setUsername] = useState("");
  // {found, themes, link, username}: remembers which account it's for, so
  // editing the box afterwards can't send theme changes to another one.
  const [lookup, setLookup] = useState(null);

  const [find, busy] = useAction(async () => {
    const name = username.trim();
    setLookup(null);
    try {
      setLookup({ ...(await customersApi.lookup(name)), username: name });
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Assign themes to a customer</h3>
      </div>
      <div className="card-body stack gap-12">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
          style={{ maxWidth: 420 }}
        >
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (e.g. z123)"
            aria-label="Customer username"
            required
          />
          <button className="btn" disabled={busy}>
            {busy ? "…" : "Find"}
          </button>
        </form>

        {lookup && !lookup.found && (
          <div className="small text-danger">
            No account with that username.
          </div>
        )}

        {lookup?.found && (
          <>
            <div className="small muted">
              Click a theme to give it to / take it from{" "}
              <strong style={{ color: "var(--ink)" }}>{lookup.username}</strong>
              :
            </div>
            <ThemeChips
              username={lookup.username}
              themes={lookup.themes}
              onChange={(themes) =>
                setLookup((current) => ({ ...current, themes }))
              }
              gap={8}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- site themes ---------------- */

const BLANK_SITE = {
  name: "",
  display_name: "",
  bg_color: "#1a1a19",
  text_color: "#ffffff",
  accent_color: "#e9979a",
};

function SiteThemes({ themes, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(null);

  const [act] = useAction(async (fn, okMsg) => {
    try {
      await fn();
      toast(okMsg);
      await onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const remove = (t) => {
    if (!window.confirm(`Delete the "${t.display_name}" site theme?`)) return;
    act(() => themesApi.deleteSite(t.id), `${t.display_name} deleted`);
  };

  const [create, busy] = useAction(async () => {
    try {
      await themesApi.createSite({
        name: adding.name,
        displayName: adding.display_name,
        bgColor: adding.bg_color,
        textColor: adding.text_color,
        accentColor: adding.accent_color,
      });
      toast("Site theme created");
      setAdding(null);
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const sw = (c) => (
    <span
      title={c}
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        background: c,
        border: "1px solid var(--hairline)",
        display: "inline-block",
      }}
    />
  );

  return (
    <div className="card">
      <div className="card-head">
        <h3>Site themes (profile color schemes)</h3>
        <div className="grow" />
        <Can perm="catalog.themes.manage">
          <button
            className="btn sm"
            onClick={() => setAdding({ ...BLANK_SITE })}
          >
            <IconPlus size={14} /> New
          </button>
        </Can>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Display name</th>
              <th>Colors</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {themes.map((t) => (
              <tr key={t.id}>
                <td className="mono small">{t.name}</td>
                <td className="strong">{t.display_name}</td>
                <td>
                  <div className="row" style={{ gap: 5 }}>
                    {sw(t.bg_color)}
                    {sw(t.text_color)}
                    {sw(t.accent_color)}
                  </div>
                </td>
                <td>
                  <Badge
                    color={
                      Number(t.is_active) ? "var(--st-paid)" : "var(--ink-3)"
                    }
                  >
                    {Number(t.is_active) ? "active" : "disabled"}
                  </Badge>
                </td>
                <td className="text-right">
                  <Can perm="catalog.themes.manage">
                    <div
                      className="row gap-6"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <button
                        className="btn sm ghost"
                        onClick={() =>
                          act(
                            () =>
                              themesApi.toggleSite(t.id, !Number(t.is_active)),
                            `${t.display_name} toggled`,
                          )
                        }
                      >
                        {Number(t.is_active) ? "Disable" : "Enable"}
                      </button>
                      {t.name !== "default" && (
                        <button
                          className="btn sm danger"
                          aria-label={`Delete ${t.display_name}`}
                          onClick={() => remove(t)}
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                  </Can>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Modal
          title="New site theme"
          onClose={() => setAdding(null)}
          footer={
            <>
              <button className="btn" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={create}
                disabled={
                  busy || !adding.name.trim() || !adding.display_name.trim()
                }
              >
                {busy ? "Saving…" : "Create"}
              </button>
            </>
          }
        >
          <div className="stack gap-14">
            <div className="grid-2 gap-12">
              <label className="field">
                <span>Internal name (unique)</span>
                <input
                  className="input"
                  value={adding.name}
                  onChange={(e) =>
                    setAdding({ ...adding, name: e.target.value })
                  }
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Display name</span>
                <input
                  className="input"
                  value={adding.display_name}
                  onChange={(e) =>
                    setAdding({ ...adding, display_name: e.target.value })
                  }
                />
              </label>
            </div>
            {[
              ["bg_color", "Background"],
              ["text_color", "Text"],
              ["accent_color", "Accent"],
            ].map(([k, label]) => (
              <label className="field" key={k}>
                <span>{label}</span>
                <ColorInput
                  value={adding[k]}
                  onChange={(color) => setAdding({ ...adding, [k]: color })}
                />
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
