import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { statusOf } from "../lib/format.js";
import {
  IconCheck,
  IconChevronL,
  IconChevronR,
  IconCopy,
  IconInbox,
  IconSearch,
  IconX,
} from "./Icons.jsx";

export const Spinner = () => (
  <div className="spinner" role="status" aria-label="Loading" />
);

/**
 * Section-level permission gate: renders `children` only when the current
 * user holds `perm` (a code from lib/permissions.js, e.g. "profiles.create").
 * Use it to hide individual cards/sections within a page, not just whole routes.
 */
export function Can({ perm, fallback = null, children }) {
  const { can } = useAuth();
  return can(perm) ? children : fallback;
}

/**
 * "#1217" as a real link to the order. Table rows that open an order on click
 * also get this, so they work from the keyboard and can open in a new tab;
 * stopPropagation keeps the row's own click from navigating a second time.
 */
export const OrderLink = ({ id }) => (
  <Link to={`/orders/${id}`} onClick={(e) => e.stopPropagation()}>
    #{id}
  </Link>
);

export const StatusBadge = ({ status }) => {
  const s = statusOf(status);
  return (
    <span className="badge" style={{ "--badge-c": s.color }}>
      <span className="dot" aria-hidden />
      {s.label}
    </span>
  );
};

export const Empty = ({ title = "Nothing here", hint }) => (
  <div className="empty">
    <IconInbox />
    <div className="strong" style={{ color: "var(--ink-2)" }}>
      {title}
    </div>
    {hint && <div className="small">{hint}</div>}
  </div>
);

export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const title = `Copy ${label || ""}`.trim();
  return (
    <button
      type="button"
      className="copy-btn"
      title={title}
      aria-label={title}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(String(text));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? <IconCheck /> : <IconCopy />}
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  delay = 350,
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef();

  // The pending search calls the latest onChange, not the one from the
  // keystroke that started it: that one still holds the page's old state, so a
  // filter changed during the delay would be undone.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Follow `value` when it changes from outside (back/forward, a cleared
  // filter). Adjusting state during render avoids an extra effect pass:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  // Don't fire a pending search after the page has been left.
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="search-wrap">
      <IconSearch />
      <input
        className="input"
        type="search"
        value={local}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChangeRef.current(v), delay);
        }}
      />
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="m-head">
          <h3>{title}</h3>
          <button
            className="btn ghost icon"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX />
          </button>
        </div>
        <div className="m-body">{children}</div>
        {footer && <div className="m-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pager({ page, perPage, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className="pager">
      <span className="small muted mono">
        {from}–{to} of {total}
      </span>
      <div className="row">
        <button
          className="btn sm icon"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <IconChevronL />
        </button>
        <span className="small mono">
          {page} / {pages}
        </span>
        <button
          className="btn sm icon"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <IconChevronR />
        </button>
      </div>
    </div>
  );
}
