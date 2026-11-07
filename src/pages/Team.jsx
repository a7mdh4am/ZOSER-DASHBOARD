import { useCallback, useEffect, useState } from "react";
import { IconPlus, IconShield } from "../components/Icons.jsx";
import { Empty, Modal, Pager, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { activityApi, rolesApi, teamApi } from "../lib/api.js";
import { fmtDate } from "../lib/format.js";

const roleColor = (code) =>
  code === "SUPER_ADMIN" ? "var(--st-cancelled)" : "var(--accent)";

/**
 * Team management + activity monitoring (admin only). Session management
 * was deliberately dropped in the Node cutover (block/unblock already
 * revokes sessions instantly) — the activity feed replaces the old
 * per-user "Sessions" modal for visibility into what a staff member did.
 */
export default function Team() {
  const [tab, setTab] = useState("users");

  return (
    <div className="stack">
      <div
        className="seg"
        style={{ alignSelf: "flex-start" }}
        role="group"
        aria-label="Team sections"
      >
        <button
          className={tab === "users" ? "active" : ""}
          aria-pressed={tab === "users"}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          className={tab === "activity" ? "active" : ""}
          aria-pressed={tab === "activity"}
          onClick={() => setTab("activity")}
        >
          Activity feed
        </button>
      </div>
      {tab === "users" ? <UsersTab /> : <ActivityFeed />}
    </div>
  );
}

/* ---------------- users ---------------- */

function UsersTab() {
  const toast = useToast();
  const { user: self } = useAuth();
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [historyFor, setHistoryFor] = useState(null); // user row

  const load = useCallback(
    () =>
      teamApi
        .list()
        .then(setUsers)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    rolesApi
      .list()
      .then((d) => setRoles(d.roles))
      .catch(() => setRoles([]));
  }, []);

  const [toggle] = useAction(async (u) => {
    try {
      await teamApi.toggle(u.id, !u.isBlocked);
      toast(
        u.isBlocked ? `${u.username} activated` : `${u.username} deactivated`,
      );
      await load();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  if (error) return <Empty title="Couldn't load the team" hint={error} />;
  if (!users)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

  return (
    <div className="card">
      <div className="card-head">
        <IconShield size={17} />
        <h3>Staff accounts</h3>
        <div className="grow" />
        <button className="btn sm primary" onClick={() => setCreating(true)}>
          <IconPlus size={14} /> New user
        </button>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Email</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ opacity: u.isBlocked ? 0.55 : 1 }}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <div
                      className="avatar"
                      style={{ width: 28, height: 28, fontSize: 11 }}
                    >
                      {(u.displayName || u.username).slice(0, 2)}
                    </div>
                    <div>
                      <div className="strong">
                        {u.displayName || u.username}
                      </div>
                      <div className="small muted">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="badge"
                    style={{ "--badge-c": roleColor(u.role) }}
                  >
                    <span className="dot" />
                    {u.roleName}
                  </span>
                </td>
                <td className="small">
                  {u.email || <span className="muted">—</span>}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      "--badge-c": u.isBlocked
                        ? "var(--ink-3)"
                        : "var(--st-paid)",
                    }}
                  >
                    <span className="dot" />
                    {u.isBlocked ? "deactivated" : "active"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div
                    className="row"
                    style={{ gap: 6, justifyContent: "flex-end" }}
                  >
                    <button
                      className="btn sm ghost"
                      onClick={() => setHistoryFor(u)}
                    >
                      Activity
                    </button>
                    {u.id !== self?.id && (
                      <button
                        className={`btn sm${!u.isBlocked ? " danger" : ""}`}
                        onClick={() => toggle(u)}
                      >
                        {u.isBlocked ? "Activate" : "Deactivate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateUserModal
          roles={roles}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {historyFor && (
        <UserActivityModal
          user={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

const BLANK = { username: "", password: "", role: "", email: "" };

function CreateUserModal({ roles, onClose, onDone }) {
  const toast = useToast();
  const assignable = roles.filter((r) => !r.isSystem);
  const list = assignable.length ? assignable : roles;
  const [form, setForm] = useState({ ...BLANK, role: list[0]?.code || "" });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    try {
      await teamApi.create({
        username: form.username,
        password: form.password,
        email: form.email || undefined,
        roleCode: form.role,
      });
      toast(`User ${form.username} created`);
      onDone();
    } catch (err) {
      toast(err.message, "err");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="New staff user"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={
              busy ||
              !form.username.trim() ||
              !form.email.trim() ||
              form.password.length < 8 ||
              !form.role
            }
          >
            {busy ? "Creating…" : "Create user"}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              value={form.username}
              onChange={set("username")}
              autoFocus
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={set("email")}
            />
          </label>
        </div>
        <label className="field">
          <span>Password (min 8)</span>
          <input
            className="input"
            type="text"
            value={form.password}
            onChange={set("password")}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select className="input" value={form.role} onChange={set("role")}>
            {list.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
                {r.description ? ` — ${r.description}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="small muted">
          Each role's exact abilities are defined on the Roles page.
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- activity ---------------- */

function ActivityList({ rows }) {
  if (!rows.length) return <Empty title="No activity yet" />;
  return (
    <div className="timeline">
      {rows.map((r) => (
        <div className="tl-item" key={r.id}>
          <div className="tl-rail">
            <div
              className="tl-dot"
              style={{
                "--tl-c": r.action.startsWith("auth.")
                  ? "var(--st-deposited)"
                  : r.action.includes("fail")
                    ? "var(--st-cancelled)"
                    : "var(--accent)",
              }}
            />
            <div className="tl-line" />
          </div>
          <div className="grow">
            <div className="row wrap" style={{ gap: 6 }}>
              <span className="badge" style={{ "--badge-c": "var(--ink-3)" }}>
                {r.action}
              </span>
              {r.entityType && (
                <span className="small muted">
                  {r.entityType}
                  {r.entityId ? ` #${r.entityId}` : ""}
                </span>
              )}
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {r.adminDisplayName || r.adminUsername} ·{" "}
              {fmtDate(r.createdAt, true)}
              {r.ipAddress ? ` · ${r.ipAddress}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UserActivityModal({ user, onClose }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    activityApi
      .staff({ adminId: user.id, page: String(page) })
      .then(setData)
      .catch(() => setData({ rows: [], total: 0 }));
  }, [user.id, page]);

  return (
    <Modal
      wide
      title={`Activity — ${user.displayName || user.username}`}
      onClose={onClose}
    >
      {!data ? (
        <div style={{ padding: 40 }}>
          <Spinner />
        </div>
      ) : (
        <>
          <ActivityList rows={data.rows} />
          <Pager page={page} perPage={30} total={data.total} onPage={setPage} />
        </>
      )}
    </Modal>
  );
}

function ActivityFeed() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    activityApi
      .staff({ page: String(page) })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page]);

  if (error) return <Empty title="Couldn't load activity" hint={error} />;
  if (!data)
    return (
      <div style={{ padding: 60 }}>
        <Spinner />
      </div>
    );

  return (
    <div className="card">
      <div className="card-head">
        <h3>Everything going on</h3>
      </div>
      <div className="card-body">
        <ActivityList rows={data.rows} />
      </div>
      <Pager page={page} perPage={30} total={data.total} onPage={setPage} />
    </div>
  );
}
