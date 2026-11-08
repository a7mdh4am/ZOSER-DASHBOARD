// Small building blocks of the Finance tabs.

import { useState } from "react";
import { Empty, PageLoader } from "../../components/ui.jsx";

export function FormulaBox({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="no-print">
      <button className="btn ghost sm" onClick={() => setOpen(!open)}>
        ⓘ How are these calculated?
      </button>
      {open && (
        <div className="formula-box" style={{ marginTop: 8 }}>
          {items.map(([name, formula]) => (
            <div key={name}>
              <strong>{name}</strong> — <code>{formula}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionShell({ hook, children }) {
  if (hook.error)
    return <Empty title="Couldn't load this section" hint={hook.error} />;
  if (!hook.data) return <PageLoader padding={50} />;
  return children(hook.data);
}
