import { useState } from "react";
import { IconPlus, IconShield } from "../components/Icons.jsx";
import {
  Badge,
  Empty,
  Modal,
  PageLoader,
  Pager,
  Segmented,
  TimelineItem,
} from "../components/ui.jsx";
import { useAuth } from "../context/auth.js";
import { useToast } from "../context/toast.js";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
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
      <Segmented
        label="Team sections"
        style={{ alignSelf: "flex-start" }}
        value={tab}
        onChange={setTab}
        options={[
          ["users", "Users"],
          ["activity", "Activity feed"],
        ]}
      />
      {tab === "users" ? <UsersTab /> : <ActivityFeed />}
    </div>
  );
}

/* ---------------- users ---------------- */

function UsersTab() {
  const toast = useToast();
  const { user: self } = useAuth();
  const [creating, setCreating] = useState(false);
  const [historyFor, setHistoryFor] = useState(null); // user row

  const {
    data: users,
    error,
    reload: load,
  } = useApiData(() => teamApi.list(), []);
  // For the New user form; if it fails to load the role list is just empty.
  const { data: roleData } = useApiData(() => rolesApi.list(), []);
  const roles = roleData?.roles ?? [];

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
  if (!users) return <PageLoader />;

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
                  <Badge color={roleColor(u.role)}>{u.roleName}</Badge>
                </td>
                <td className="small">
                  {u.email || <span className="muted">—</span>}
                </td>
                <td>
                  <Badge
                    color={u.isBlocked ? "var(--ink-3)" : "var(--st-paid)"}
                  >
                    {u.isBlocked ? "deactivated" : "active"}
                  </Badge>
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
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const [submit, busy] = useAction(async () => {
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
    }
  });

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
        <TimelineItem
          key={r.id}
          color={
            r.action.startsWith("auth.")
              ? "var(--st-deposited)"
              : r.action.includes("fail")
                ? "var(--st-cancelled)"
                : "var(--accent)"
          }
        >
          <div className="row wrap" style={{ gap: 6 }}>
            <Badge color="var(--ink-3)" dot={false}>
              {r.action}
            </Badge>
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
        </TimelineItem>
      ))}
    </div>
  );
}

function UserActivityModal({ user, onClose }) {
  const [page, setPage] = useState(1);
  const result = useApiData(
    () => activityApi.staff({ adminId: user.id, page: String(page) }),
    [user.id, page],
  );
  // A failed load shows as "no activity" rather than an error.
  const data = result.error ? { rows: [], total: 0 } : result.data;

  return (
    <Modal
      wide
      title={`Activity — ${user.displayName || user.username}`}
      onClose={onClose}
    >
      {!data ? (
        <PageLoader padding={40} />
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
  const { data, error } = useApiData(
    () => activityApi.staff({ page: String(page) }),
    [page],
  );

  if (error) return <Empty title="Couldn't load activity" hint={error} />;
  if (!data) return <PageLoader />;

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
