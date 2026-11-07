import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { statusOf } from '../lib/format.js';
import { IconCheck, IconChevronL, IconChevronR, IconCopy, IconInbox, IconSearch, IconX } from './Icons.jsx';

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

/**
 * Section-level permission gate: renders `children` only when the current
 * user holds `perm` (same dot-path grammar as useAuth().can, e.g.
 * "customers.create" or "orders.status_targets" with a `value`). Use it to
 * hide individual cards/sections within a page, not just whole routes.
 */
export function Can({ perm, value, fallback = null, children }) {
  const { can } = useAuth();
  return can(perm, value) ? children : fallback;
}

export const StatusBadge = ({ status }) => {
  const s = statusOf(status);
  return (
    <span className="badge" style={{ '--badge-c': s.color }}>
      <span className="dot" aria-hidden />
      {s.label}
    </span>
  );
};

export const Empty = ({ title = 'Nothing here', hint }) => (
  <div className="empty">
    <IconInbox />
    <div className="strong" style={{ color: 'var(--ink-2)' }}>{title}</div>
    {hint && <div className="small">{hint}</div>}
  </div>
);

export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      title={`Copy ${label || ''}`.trim()}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(String(text));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
    >
      {copied ? <IconCheck /> : <IconCopy />}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', delay = 350 }) {
  const [local, setLocal] = useState(value);
  const timer = useRef();

  useEffect(() => setLocal(value), [value]);

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
          timer.current = setTimeout(() => onChange(v), delay);
        }}
      />
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head">
          <h3>{title}</h3>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close"><IconX /></button>
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
      <span className="small muted mono">{from}–{to} of {total}</span>
      <div className="row">
        <button className="btn sm icon" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <IconChevronL />
        </button>
        <span className="small mono">{page} / {pages}</span>
        <button className="btn sm icon" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <IconChevronR />
        </button>
      </div>
    </div>
  );
}
