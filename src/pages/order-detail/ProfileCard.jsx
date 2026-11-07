import { useState } from "react";
import { IconExternal, IconUser } from "../../components/Icons.jsx";
import { ThemeChips } from "../../components/ThemeChips.jsx";
import { Can, CopyButton, CopyField } from "../../components/ui.jsx";
import { useToast } from "../../context/toast.js";
import { useAction } from "../../hooks/useAction.js";
import { ordersApi } from "../../lib/api.js";

export function ProfileCard({ orderId, profile, onChanged }) {
  const toast = useToast();
  // Shown straight after "Create profile", before the order has reloaded.
  const [createdLink, setCreatedLink] = useState(null);
  const link = profile.link || createdLink;
  const [tempPassword, setTempPassword] = useState(null);

  // Toggling a chip updates these right away; a reload of the order replaces
  // them (adjusting state during render rather than in an effect).
  const [themes, setThemes] = useState(profile.themes || []);
  const [themesFrom, setThemesFrom] = useState(profile.themes);
  if (profile.themes !== themesFrom) {
    setThemesFrom(profile.themes);
    setThemes(profile.themes || []);
  }

  const [create, busy] = useAction(async () => {
    try {
      const res = await ordersApi.createProfile(orderId);
      setCreatedLink(res.link);
      setTempPassword(res.temporaryPassword);
      toast("Profile created");
      onChanged();
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="card">
      <div className="card-head">
        <IconUser />
        <h3>Card profile</h3>
      </div>
      <div className="card-body stack" style={{ gap: 10 }}>
        <div className="small muted">
          Username:{" "}
          <span className="mono strong" style={{ color: "var(--ink)" }}>
            {profile.username}
          </span>
        </div>
        {link ? (
          <>
            <CopyField
              value={link}
              label="profile link"
              style={{ width: "100%" }}
            />
            {tempPassword && (
              <div
                className="copy-line"
                style={{
                  background: "var(--warn-soft, #fff3cd)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  width: "100%",
                }}
              >
                <span className="small">
                  Temporary password:{" "}
                  <span className="mono strong">{tempPassword}</span> — save it
                  now, it won't be shown again.
                </span>
                <CopyButton text={tempPassword} label="temporary password" />
              </div>
            )}
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">
              <IconExternal /> Open profile
            </a>
            {themes.length > 0 && (
              <Can perm="profiles.themes.add">
                <div>
                  <div
                    className="small strong muted"
                    style={{ margin: "6px 0" }}
                  >
                    PROFILE THEMES — click to assign / remove
                  </div>
                  <ThemeChips
                    username={profile.username}
                    themes={themes}
                    onChange={setThemes}
                    gap={6}
                  />
                </div>
              </Can>
            )}
          </>
        ) : (
          <Can
            perm="profiles.create"
            fallback={
              <div className="small muted">No profile card created yet.</div>
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
