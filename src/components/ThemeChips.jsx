import { useToast } from "../context/toast.js";
import { useAction } from "../hooks/useAction.js";
import { themesApi } from "../lib/api.js";

/**
 * A customer's profile themes as chips, owned ones active (✓). Clicking one
 * gives it to `username` or takes it back; `onChange` gets the updated list.
 * Used on the order page and the Themes page.
 */
export function ThemeChips({ username, themes, onChange, gap }) {
  const toast = useToast();

  const [toggle] = useAction(async (t) => {
    const owned = t.status === "owned";
    try {
      const res = await themesApi.assign({
        username,
        themeId: t.theme_id,
        action: owned ? "remove" : "assign",
      });
      toast(owned ? `${t.theme} removed` : `${t.theme} assigned`);
      onChange(res.themes);
    } catch (err) {
      toast(err.message, "err");
    }
  });

  return (
    <div className="row wrap" style={{ gap }}>
      {themes.map((t) => (
        <button
          key={t.theme_id}
          type="button"
          className={`chip${t.status === "owned" ? " active" : ""}`}
          aria-pressed={t.status === "owned"}
          onClick={() => toggle(t)}
        >
          {t.status === "owned" ? "✓ " : ""}
          {t.theme}
        </button>
      ))}
    </div>
  );
}
