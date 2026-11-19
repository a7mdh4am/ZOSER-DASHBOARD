import { useState } from "react";
import { IconExternal, IconUser } from "../components/Icons.jsx";
import {
  Badge,
  Can,
  CopyField,
  Empty,
  Modal,
  OrderLink,
  PageLoader,
  Pager,
  SearchInput,
} from "../components/ui.jsx";
import { useToast } from "../context/toast.js";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { customersApi } from "../lib/api.js";
import { fmtDate } from "../lib/format.js";

/**
 * Customer accounts. Customers make their own accounts in the profiles app (with a
 * confirmed email) when they tap their item and say it's theirs. This page lists them,
 * opens one (its pages, and the items it owns in each), emails a reset code, blocks an
 * account, and for the old system's accounts (no email) still sets a password and makes
 * the old kind of account: one shared login with one profile link.
 */
export default function Customers() {
  return (
    <div className="stack">
      <Can perm="users.view">
        <DirectoryCard />
      </Can>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <Can perm="profiles.create">
          <CreateAccountCard />
        </Can>
        <Can perm="users.password.reset">
          <ResetPasswordCard />
        </Can>
      </div>
    </div>
  );
}

const BLANK = { username: "", password: "", name: "", friendsCount: 2 };

function CreateAccountCard() {
  const toast = useToast();
  const [form, setForm] = useState(BLANK);
  const [created, setCreated] = useState(null); // {username, link}

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const [create, busy] = useAction(async () => {
    try {
      const res = await customersApi.create({
        username: form.username,
        password: form.password,
        name: form.name || undefined,
        friendsCount: Number(form.friendsCount) || 1,
      });
      setCreated({ username: res.username, link: res.link });
      setForm(BLANK);
      toast("Account created");
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Create an old-style account</h3>
      </div>
      <form
        className="card-body stack gap-14"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="grid-2 gap-12">
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              value={form.username}
              onChange={set("username")}
              required
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Password (min 8 chars)</span>
            <input
              className="input"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
              placeholder="e.g. 12345678"
              autoComplete="off"
            />
          </label>
        </div>

        <label className="field">
          <span>Name (couple or group name)</span>
          <input
            className="input"
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Sara &amp; Youssef"
          />
        </label>

        <label className="field" style={{ maxWidth: 160 }}>
          <span>Members / cards</span>
          <input
            className="input"
            type="number"
            min="1"
            max="99"
            value={form.friendsCount}
            onChange={set("friendsCount")}
          />
          <span className="small muted">
            2 shows as "Couples" on the profile, 3+ as "Friends".
          </span>
        </label>

        <button className="btn primary" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>

        {created?.link && (
          <div className="stack gap-8">
            <div className="small strong" style={{ color: "var(--good)" }}>
              Profile link for “{created.username}” — program this on the cards:
            </div>
            <CopyField value={created.link} label="profile link" />
            <a
              className="btn sm self-start"
              href={created.link}
              target="_blank"
              rel="noreferrer"
            >
              <IconExternal /> Open profile
            </a>
          </div>
        )}
      </form>
    </div>
  );
}

function ResetPasswordCard() {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [reset, busy] = useAction(async () => {
    if (pw !== pw2) {
      toast("Passwords do not match", "err");
      return;
    }
    try {
      const lookup = await customersApi.lookup(username.trim());
      if (!lookup.found) throw new Error("No account with that username");
      await customersApi.resetPassword(lookup.userId, pw);
      toast(`Password updated for ${username.trim()}`);
      setUsername("");
      setPw("");
      setPw2("");
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Set a password (old-system accounts)</h3>
      </div>
      <form
        className="card-body stack gap-14"
        onSubmit={(e) => {
          e.preventDefault();
          reset();
        }}
      >
        <div className="small muted">
          Only for an account with no email. Everyone else gets a reset code by
          email: open them in the list above.
        </div>
        <label className="field">
          <span>Username</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <div className="grid-2 gap-12">
          <label className="field">
            <span>New password (min 8)</span>
            <input
              className="input"
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={8}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>Confirm</span>
            <input
              className="input"
              type="text"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              minLength={8}
              autoComplete="off"
            />
          </label>
        </div>
        <button className="btn primary" disabled={busy}>
          {busy ? "Updating…" : "Reset password"}
        </button>
      </form>
    </div>
  );
}

const STATUS = {
  active: ["Active", "var(--st-shipped)"],
  unverified: ["Email not confirmed", "var(--ink-3)"],
  blocked: ["Blocked", "var(--danger)"],
};

/** Every customer account, newest first, searchable by username, name or email */
function DirectoryCard() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const { data, error, loading, reload } = useApiData(
    () => customersApi.list({ search, page: String(page) }),
    [search, page],
  );

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Customers{data ? ` · ${data.total}` : ""}</h3>
        <div className="grow" />
        <div style={{ minWidth: 200, maxWidth: 320 }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Username, name or email…"
          />
        </div>
      </div>
      <div className="card-body stack gap-8">
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <Empty title="Couldn't load customers" hint={error} />
        ) : !data.customers.length ? (
          <Empty title="No customers found" />
        ) : (
          <>
            {data.customers.map((c) => {
              const [label, color] = STATUS[c.status] ?? [
                c.status,
                "var(--ink-3)",
              ];
              return (
                <button
                  key={c.id}
                  type="button"
                  className="nfc-item row wrap gap-8"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => setOpenId(c.id)}
                >
                  <span className="strong">@{c.username}</span>
                  <span>{c.name}</span>
                  <span className="small muted">
                    {c.email ?? "no email"} · {c.pages} page
                    {c.pages === 1 ? "" : "s"} · {c.items} item
                    {c.items === 1 ? "" : "s"} · joined {fmtDate(c.created_at)}
                  </span>
                  <div className="grow" />
                  {c.legacy && (
                    <Badge color="var(--st-production)">Old system</Badge>
                  )}
                  <Badge color={color}>{label}</Badge>
                </button>
              );
            })}
            <Pager
              page={page}
              perPage={data.per_page}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>
      {openId && (
        <CustomerModal
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

/** One customer: their details, the pages they're in and the items they own */
function CustomerModal({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, error, reload } = useApiData(() => customersApi.get(id), [id]);
  const [run, busy] = useAction(async (action, done, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await action();
      toast(done);
      reload();
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  const c = data?.customer;

  return (
    <Modal
      title={c ? `@${c.username}` : "Customer"}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Close
        </button>
      }
    >
      {error && <div className="small text-danger">{error}</div>}
      {c && (
        <div className="stack gap-12">
          <div className="small">
            <div className="strong">{c.name}</div>
            <div className="muted">
              {c.email ?? "No email"}
              {c.email &&
                (c.email_verified ? " (confirmed)" : " (not confirmed)")}
              {c.phone ? ` · ${c.phone}` : ""} · signed in on{" "}
              {c.signed_in_devices} device
              {c.signed_in_devices === 1 ? "" : "s"}
            </div>
          </div>
          <Can perm="users.password.reset">
            <div className="row wrap gap-6">
              {c.email_verified && c.status === "active" && (
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => customersApi.sendReset(c.id),
                      `Reset code emailed to ${c.email}`,
                    )
                  }
                >
                  Email a reset code
                </button>
              )}
              <button
                className={`btn sm ${c.status === "blocked" ? "" : "ghost danger"}`}
                disabled={busy}
                onClick={() =>
                  run(
                    () => customersApi.block(c.id, c.status !== "blocked"),
                    c.status === "blocked" ? "Unblocked" : "Blocked",
                    c.status === "blocked"
                      ? null
                      : `Block @${c.username}?\n\nThey're signed out everywhere and can't sign in until unblocked. Their pages stay.`,
                  )
                }
              >
                {c.status === "blocked" ? "Unblock" : "Block"}
              </button>
            </div>
          </Can>
          {data.link && (
            <div className="stack gap-4">
              <div className="small muted">Old-system profile link:</div>
              <CopyField value={data.link} label="profile link" />
            </div>
          )}
          <div className="small strong muted">PAGES</div>
          {data.pages.length === 0 && (
            <div className="small muted">Not in any page yet.</div>
          )}
          {data.pages.map((page) => (
            <div key={page.id} className="nfc-item stack gap-4">
              <div className="row wrap gap-6">
                <span className="strong">{page.names || "Unnamed page"}</span>
                <span className="small muted">
                  as {page.as}
                  {page.role !== "person" ? ` (${page.role})` : ""}
                </span>
                <div className="grow" />
                {page.order_ids.map((orderId) => (
                  <OrderLink key={orderId} id={orderId} />
                ))}
              </div>
              <div className="small muted">
                {page.holds.length
                  ? `Owns ${page.holds.join(", ")}`
                  : "Owns none of its items."}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
