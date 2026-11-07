import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth.js";
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

/** Spinner with room around it, for a page or section that's still loading. */
export const PageLoader = ({ padding = 60 }) => (
  <div style={{ padding }}>
    <Spinner />
  </div>
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

/**
 * Colored pill. `color` is any CSS color (usually a var); `dot` adds the
 * leading dot; `style` is merged in.
 */
export const Badge = ({ color, dot = true, style, children }) => (
  <span className="badge" style={{ "--badge-c": color, ...style }}>
    {dot && <span className="dot" aria-hidden />}
    {children}
  </span>
);

export const StatusBadge = ({ status }) => {
  const s = statusOf(status);
  return <Badge color={s.color}>{s.label}</Badge>;
};

/**
 * Segmented control (.seg): one button per option, the chosen one active.
 * `options` is [[value, label], ...]. `fill` stretches it to the container's
 * width with equal buttons, as in forms.
 */
export function Segmented({ options, value, onChange, label, fill, style }) {
  return (
    <div
      className="seg"
      role="group"
      aria-label={label}
      style={fill ? { display: "flex", ...style } : style}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          className={value === v ? "active" : ""}
          aria-pressed={value === v}
          style={fill ? { flex: 1 } : undefined}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A row of filter chips (.chips), one of them active. Same options shape as Segmented. */
export function ChipGroup({
  options,
  value,
  onChange,
  label,
  className,
  style,
}) {
  return (
    <div
      className={className ? `chips ${className}` : "chips"}
      role="group"
      aria-label={label}
      style={style}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          className={`chip${value === v ? " active" : ""}`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** One entry of a `.timeline`: a colored dot on the rail, then the content. */
export const TimelineItem = ({ color, children }) => (
  <div className="tl-item">
    <div className="tl-rail">
      <div className="tl-dot" style={{ "--tl-c": color }} />
      <div className="tl-line" />
    </div>
    <div className="grow">{children}</div>
  </div>
);

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

/** A value (e.g. a profile link) in a shaded box with a copy button. */
export const CopyField = ({ value, label, style }) => (
  <div
    className="copy-line"
    style={{
      background: "var(--surface-2)",
      borderRadius: 8,
      padding: "8px 10px",
      ...style,
    }}
  >
    <span className="small mono grow" style={{ overflowWrap: "anywhere" }}>
      {value}
    </span>
    <CopyButton text={value} label={label} />
  </div>
);

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog over the page. While it's open, keyboard focus stays inside it (Tab
 * wraps around), Escape closes it, and the page behind doesn't scroll. When
 * it closes, focus goes back to whatever opened it.
 */
export function Modal({ title, onClose, children, footer, wide }) {
  const dialogRef = useRef(null);
  // Read while rendering: by the time effects run, a field inside may already
  // have taken focus with autoFocus.
  const [opener] = useState(() => document.activeElement);
  // The latest onClose, so the setup below runs once rather than on every
  // render of the page behind.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    // Move focus in, unless a field inside already took it (autoFocus).
    if (!dialog.contains(document.activeElement)) dialog.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Only once the dialog is really gone (React's StrictMode re-runs this
      // effect in development while the dialog stays on the page).
      if (!dialog.isConnected && opener?.isConnected) opener.focus();
    };
  }, [opener]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
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
