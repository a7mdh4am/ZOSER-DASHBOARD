import { useState } from "react";
import { IconUser } from "../components/Icons.jsx";
import { Badge, PageLoader, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useAction } from "../hooks/useAction.js";
import { useApiData } from "../hooks/useApiData.js";
import { settingsApi } from "../lib/api.js";
import { fmtDate } from "../lib/format.js";

/** Own-account settings — available to every staff role. */
export default function Settings() {
  // Both load at once: the devices list doesn't wait for the profile.
  const profile = useApiData(() => settingsApi.me(), []);
  const devices = useApiData(() => settingsApi.sessions(), []);
  const me = profile.data?.user;
  // A failed devices load shows as an empty list.
  const sessions = devices.error ? [] : (devices.data?.sessions ?? null);

  if (profile.error) return <div className="empty">{profile.error}</div>;
  if (!me) return <PageLoader />;

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="card-body row" style={{ gap: 14 }}>
          <div
            className="avatar"
            style={{ width: 44, height: 44, fontSize: 17 }}
          >
            {(me.display_name || me.username).slice(0, 2)}
          </div>
          <div className="grow">
            <div className="strong" style={{ fontSize: 16 }}>
              {me.display_name || me.username}
            </div>
            <div className="small muted">
              @{me.username} · {me.admin_roles.name}
            </div>
          </div>
        </div>
      </div>

      {/* Keyed by the saved name: after saving, the field starts from it again. */}
      <ProfileCard key={me.display_name} me={me} onChanged={profile.reload} />
      <PasswordCard />
      <EmailCard me={me} onChanged={profile.reload} />
      <SessionsCard sessions={sessions} onChanged={devices.reload} />
    </div>
  );
}

function SessionsCard({ sessions, onChanged }) {
  const toast = useToast();

  const [revoke] = useAction(async (s) => {
    try {
      await settingsApi.revokeSession(s.id);
      toast(s.current ? "Signed out this device" : "Device signed out");
      if (s.current) {
        window.location.reload();
        return;
      }
      await onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Active devices</h3>
      </div>
      <div className="card-body">
        {!sessions ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <div className="small muted">No active sessions.</div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {sessions.map((s) => (
              <div key={s.id} className="row" style={{ gap: 10 }}>
                <div className="grow">
                  <div className="strong">
                    {s.ip || "unknown IP"}{" "}
                    {s.current && (
                      <Badge color="var(--st-paid)" dot={false}>
                        this device
                      </Badge>
                    )}
                  </div>
                  <div
                    className="small muted"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {s.user_agent || "unknown browser"}
                  </div>
                  <div className="small muted">
                    started {fmtDate(s.created_at, true)}
                    {s.last_seen_at
                      ? ` · last seen ${fmtDate(s.last_seen_at, true)}`
                      : ""}
                  </div>
                </div>
                <button className="btn sm danger" onClick={() => revoke(s)}>
                  {s.current ? "Sign out" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ me, onChanged }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [name, setName] = useState(me.display_name || "");

  const [save, busy] = useAction(async () => {
    try {
      const res = await settingsApi.updateProfile(name.trim());
      toast("Profile updated");
      // The sidebar reads the signed-in user's `displayName`; this endpoint
      // answers with `display_name`.
      refreshUser({ displayName: res.user.display_name });
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Profile</h3>
      </div>
      <form
        className="card-body row"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ alignItems: "flex-end" }}
      >
        <label className="field grow">
          <span>Display name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
          />
        </label>
        <button
          className="btn primary"
          disabled={busy || name.trim() === (me.display_name || "")}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });

  const [change, busy] = useAction(async () => {
    if (form.next !== form.confirm) {
      toast("New passwords do not match", "err");
      return;
    }
    try {
      await settingsApi.changePassword(form.current, form.next);
      toast("Password changed");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Password</h3>
      </div>
      <form
        className="card-body stack"
        style={{ gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          change();
        }}
      >
        <label className="field">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            value={form.current}
            onChange={set("current")}
            required
            autoComplete="current-password"
          />
        </label>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>New password (min 8)</span>
            <input
              className="input"
              type="password"
              value={form.next}
              onChange={set("next")}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              className="input"
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
        </div>
        <button
          className="btn primary"
          style={{ alignSelf: "flex-start" }}
          disabled={busy}
        >
          {busy ? "Changing…" : "Change password"}
        </button>
      </form>
    </div>
  );
}

function EmailCard({ me, onChanged }) {
  const toast = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("form"); // form | verify
  const [notice, setNotice] = useState("");

  // Node's admin accounts always have an email (unlike PHP's optional-until-set
  // model), so there's no "first email applies instantly" branch — every
  // change sends a confirmation code to the current address first.
  const [request, requesting] = useAction(async () => {
    try {
      await settingsApi.requestEmailChange(newEmail.trim(), password);
      setNotice(`We sent a 6-digit code to ${me.email}.`);
      setStep("verify");
    } catch (err) {
      toast(err.message, "err");
    }
  });

  const [confirm, confirming] = useAction(async () => {
    try {
      await settingsApi.confirmEmailChange(newEmail.trim(), code.trim());
      toast("Email updated");
      setStep("form");
      setNewEmail("");
      setPassword("");
      setCode("");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <h3>Email</h3>
        <div className="grow" />
        <span className="small muted">{me.email || "no email set"}</span>
      </div>
      {step === "form" ? (
        <form
          className="card-body stack"
          style={{ gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            request();
          }}
        >
          {me.email ? (
            <div className="small muted">
              Changing your email sends a 6-digit code to your{" "}
              <strong>current</strong> address first.
            </div>
          ) : (
            <div className="small muted">
              No email on file yet — set one so account security features
              (verification codes, upcoming 2FA login) can reach you.
            </div>
          )}
          <div className="grid-2" style={{ gap: 12 }}>
            <label className="field">
              <span>New email</span>
              <input
                className="input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Current password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
          </div>
          <button
            className="btn primary"
            style={{ alignSelf: "flex-start" }}
            disabled={requesting}
          >
            {requesting
              ? "…"
              : me.email
                ? "Send verification code"
                : "Save email"}
          </button>
        </form>
      ) : (
        <form
          className="card-body stack"
          style={{ gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <div
            className="small"
            style={{
              background: "var(--good-soft)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {notice}
          </div>
          <div className="row">
            <input
              className="input mono"
              style={{
                maxWidth: 180,
                fontSize: 18,
                letterSpacing: 6,
                textAlign: "center",
              }}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="••••••"
              inputMode="numeric"
              autoFocus
              required
            />
            <button
              className="btn primary"
              disabled={confirming || code.length !== 6}
            >
              {confirming ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setStep("form");
                setCode("");
              }}
            >
              Cancel
            </button>
          </div>
          <div className="small muted">The code expires in 10 minutes.</div>
        </form>
      )}
    </div>
  );
}
