import { useCallback, useEffect, useState } from "react";
import { IconExternal, IconPlus, IconX } from "../components/Icons.jsx";
import { Can, Empty, Modal, Spinner } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { customersApi, themesApi } from "../lib/api.js";
import { money } from "../lib/format.js";

/**
 * Themes: purchasable custom profile themes (create/edit + assign to a
 * customer) and site themes (profile color schemes).
 */
export default function Themes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      themesApi
        .list()
        .then(setData)
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Empty title="Couldn't load themes" hint={error} />;
  if (!data)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

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
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

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
                      <span
                        className="badge"
                        style={{ "--badge-c": "var(--accent)" }}
                      >
                        new
                      </span>
                    )}
                    {!Number(t.is_active) && (
                      <span
                        className="badge"
                        style={{ "--badge-c": "var(--ink-3)" }}
                      >
                        disabled
                      </span>
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
                          href={t.preview_link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent)" }}
                        >
                          preview <IconExternal size={10} />
                        </a>
                      </>
                    )}
                  </div>
                  <Can perm="catalog.themes.manage">
                    <div className="row" style={{ gap: 6 }}>
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
          <div className="stack" style={{ gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
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
              <div className="row">
                <input
                  type="color"
                  value={editing.bg_color}
                  style={{
                    width: 44,
                    height: 36,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                  onChange={(e) =>
                    setEditing({ ...editing, bg_color: e.target.value })
                  }
                />
                <input
                  className="input"
                  value={editing.bg_color}
                  onChange={(e) =>
                    setEditing({ ...editing, bg_color: e.target.value })
                  }
                />
              </div>
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
            <div className="row" style={{ gap: 18 }}>
              <label className="row" style={{ gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editing.is_new}
                  onChange={(e) =>
                    setEditing({ ...editing, is_new: e.target.checked })
                  }
                />
                Mark as new
              </label>
              <label className="row" style={{ gap: 6, cursor: "pointer" }}>
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
  const [lookup, setLookup] = useState(null); // {found, themes, link}
  const [busy, setBusy] = useState(false);

  const find = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLookup(null);
    try {
      setLookup(await customersApi.lookup(username.trim()));
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setBusy(false);
    }
  };

  const [toggleTheme] = useAction(async (t) => {
    try {
      const res = await themesApi.assign({
        username: username.trim(),
        themeId: t.theme_id,
        action: t.status === "owned" ? "remove" : "assign",
      });
      toast(
        t.status === "owned" ? `${t.theme} removed` : `${t.theme} assigned`,
      );
      setLookup((current) => ({ ...current, themes: res.themes }));
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Assign themes to a customer</h3>
      </div>
      <div className="card-body stack" style={{ gap: 12 }}>
        <form className="row" onSubmit={find} style={{ maxWidth: 420 }}>
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
          <div className="small" style={{ color: "var(--danger)" }}>
            No account with that username.
          </div>
        )}

        {lookup?.found && (
          <>
            <div className="small muted">
              Click a theme to give it to / take it from{" "}
              <strong style={{ color: "var(--ink)" }}>{username.trim()}</strong>
              :
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {lookup.themes.map((t) => (
                <button
                  key={t.theme_id}
                  type="button"
                  className={`chip${t.status === "owned" ? " active" : ""}`}
                  onClick={() => toggleTheme(t)}
                >
                  {t.status === "owned" ? "✓ " : ""}
                  {t.theme}
                </button>
              ))}
            </div>
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
  const [busy, setBusy] = useState(false);

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

  const create = async () => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

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
                  <span
                    className="badge"
                    style={{
                      "--badge-c": Number(t.is_active)
                        ? "var(--st-paid)"
                        : "var(--ink-3)",
                    }}
                  >
                    <span className="dot" />
                    {Number(t.is_active) ? "active" : "disabled"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Can perm="catalog.themes.manage">
                    <div
                      className="row"
                      style={{ gap: 6, justifyContent: "flex-end" }}
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
          <div className="stack" style={{ gap: 14 }}>
            <div className="grid-2" style={{ gap: 12 }}>
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
                <div className="row">
                  <input
                    type="color"
                    value={adding[k]}
                    style={{
                      width: 44,
                      height: 36,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                    onChange={(e) =>
                      setAdding({ ...adding, [k]: e.target.value })
                    }
                  />
                  <input
                    className="input"
                    value={adding[k]}
                    onChange={(e) =>
                      setAdding({ ...adding, [k]: e.target.value })
                    }
                  />
                </div>
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
