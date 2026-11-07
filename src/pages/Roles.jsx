import { useState } from "react";
import { IconKey, IconPlus } from "../components/Icons.jsx";
import { Badge, Empty, Modal, PageLoader } from "../components/ui.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { rolesApi } from "../lib/api.js";

/** Groups a flat permission code list by its prefix before the first dot (e.g. "orders.view" -> "orders"). */
function groupByArea(permissionCatalog) {
  const groups = new Map();
  for (const p of permissionCatalog) {
    const area = p.code.split(".")[0];
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(p);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Staff roles: each one grants a set of the dashboard's permission codes (lib/permissions.js). */
export default function Roles() {
  const toast = useToast();
  const [editing, setEditing] = useState(null); // role row, or 'new'
  const { data, error, reload: load } = useApiData(() => rolesApi.list(), []);

  const [remove] = useAction(async (role) => {
    if (!window.confirm(`Delete the "${role.name}" role?`)) return;
    try {
      await rolesApi.remove(role.id);
      toast(`${role.name} deleted`);
      await load();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (error) return <Empty title="Couldn't load roles" hint={error} />;
  if (!data) return <PageLoader />;

  return (
    <div className="card">
      <div className="card-head">
        <IconKey size={17} />
        <h3>Staff roles</h3>
        <div className="grow" />
        <button className="btn sm primary" onClick={() => setEditing("new")}>
          <IconPlus size={14} /> New role
        </button>
      </div>

      <div className="card-body">
        <div className="stack" style={{ gap: 12 }}>
          {data.roles.map((r) => (
            <div
              key={r.id}
              className="row"
              style={{ gap: 12, alignItems: "flex-start" }}
            >
              <div className="grow">
                <div
                  className="row wrap"
                  style={{ gap: 8, alignItems: "center" }}
                >
                  <span className="strong">{r.name}</span>
                  <span className="small mono muted">{r.code}</span>
                  {r.isSystem && (
                    <Badge color="var(--st-cancelled)">built-in</Badge>
                  )}
                </div>
                {r.description && (
                  <div className="small muted" style={{ marginTop: 2 }}>
                    {r.description}
                  </div>
                )}
                <div className="small muted" style={{ marginTop: 2 }}>
                  {r.userCount} staff · {r.permissions.length} permissions
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {!r.isSystem && (
                  <button
                    className="btn sm ghost"
                    onClick={() => setEditing(r)}
                  >
                    Edit
                  </button>
                )}
                {!r.isSystem && (
                  <button className="btn sm danger" onClick={() => remove(r)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <RoleEditor
          role={editing === "new" ? null : editing}
          permissionCatalog={data.permissionCatalog}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RoleEditor({ role, permissionCatalog, onClose, onDone }) {
  const toast = useToast();
  const [code, setCode] = useState(role?.code || "");
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [selected, setSelected] = useState(
    () => new Set(role?.permissions || []),
  );
  const areas = groupByArea(permissionCatalog);

  const toggle = (permCode) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(permCode)) next.delete(permCode);
      else next.add(permCode);
      return next;
    });

  const [submit, busy] = useAction(async () => {
    try {
      const body = {
        name,
        description: description || undefined,
        permissionCodes: [...selected],
      };
      if (role) {
        await rolesApi.update(role.id, body);
        toast(`${name} updated`);
      } else {
        await rolesApi.create({ ...body, code: code.trim().toUpperCase() });
        toast(`${name} created`);
      }
      onDone();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <Modal
      wide
      title={role ? `Edit role — ${role.name}` : "New role"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !name.trim() || (!role && !code.trim())}
          >
            {busy ? "Saving…" : role ? "Save changes" : "Create role"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Role name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Sales"
            />
          </label>
          {!role && (
            <label className="field">
              <span>Code (UPPER_SNAKE, permanent)</span>
              <input
                className="input mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SALES_AGENT"
              />
            </label>
          )}
        </div>
        <label className="field">
          <span>Description (optional)</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role is for"
          />
        </label>

        <div className="stack" style={{ gap: 6 }}>
          <span className="perm-title">Permissions</span>
          {areas.map(([area, perms]) => (
            <div key={area} className="perm-row">
              <div className="perm-area">{area}</div>
              <div className="row wrap" style={{ gap: 14 }}>
                {perms.map((p) => (
                  <label
                    key={p.code}
                    className="check"
                    title={p.description || p.code}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.code)}
                      onChange={() => toggle(p.code)}
                    />
                    <span>{p.code.slice(area.length + 1)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
