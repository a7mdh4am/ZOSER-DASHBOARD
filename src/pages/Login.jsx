import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

// Node's admin auth has no new-device email-OTP gate yet (see
// _backend/README.md's admin auth scope notes) — this is a straight
// username/password sign-in until that's built.
export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
      // AuthContext set the user and the app re-renders
    } catch (err) {
      setError(err.message || "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <img src="/images/logo.svg" alt="" />
          Zoser Admin
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div
              className="small"
              style={{ color: "var(--danger)", fontWeight: 600 }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="btn primary"
            type="submit"
            disabled={busy}
            style={{ padding: "10px 14px" }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
