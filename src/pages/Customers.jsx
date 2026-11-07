import { useState } from 'react';
import { IconExternal, IconUser } from '../components/Icons.jsx';
import { Can, CopyButton } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { customersApi } from '../lib/api.js';

/**
 * Customer accounts: standalone profile creation (custom cards not tied
 * to an order) + password reset. Order-linked profiles are created from
 * the order page itself with the z{orderId} convention.
 */
export default function Customers() {
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <Can perm="profiles.create"><CreateAccountCard /></Can>
      <div className="stack">
        <Can perm="users.password.reset"><ResetPasswordCard /></Can>
        <Can perm="users.view"><LookupCard /></Can>
      </div>
    </div>
  );
}

const BLANK = { username: '', password: '', name: '', friendsCount: 2 };

function CreateAccountCard() {
  const toast = useToast();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // {username, link}

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await customersApi.create({
        username: form.username,
        password: form.password,
        name: form.name || undefined,
        friendsCount: Number(form.friendsCount) || 1,
      });
      setCreated({ username: res.username, link: res.link });
      setForm(BLANK);
      toast('Account created');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><IconUser /><h3>Create account</h3></div>
      <form className="card-body stack" style={{ gap: 14 }} onSubmit={submit}>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Username</span>
            <input className="input" value={form.username} onChange={set('username')} required autoComplete="off" />
          </label>
          <label className="field">
            <span>Password (min 8 chars)</span>
            <input className="input" value={form.password} onChange={set('password')} required minLength={8}
              placeholder="e.g. 12345678" autoComplete="off" />
          </label>
        </div>

        <label className="field">
          <span>Name (couple or group name)</span>
          <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Sara &amp; Youssef" />
        </label>

        <label className="field" style={{ maxWidth: 160 }}>
          <span>Members / cards</span>
          <input className="input" type="number" min="1" max="99" value={form.friendsCount} onChange={set('friendsCount')} />
          <span className="small muted">2 shows as "Couples" on the profile, 3+ as "Friends".</span>
        </label>

        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>

        {created?.link && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="small strong" style={{ color: 'var(--good)' }}>
              Profile link for “{created.username}” — program this on the cards:
            </div>
            <div className="copy-line" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <span className="small mono grow" style={{ overflowWrap: 'anywhere' }}>{created.link}</span>
              <CopyButton text={created.link} label="profile link" />
            </div>
            <a className="btn sm" style={{ alignSelf: 'flex-start' }} href={created.link} target="_blank" rel="noreferrer">
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
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) {
      toast('Passwords do not match', 'err');
      return;
    }
    setBusy(true);
    try {
      const lookup = await customersApi.lookup(username.trim());
      if (!lookup.found) throw new Error('No account with that username');
      await customersApi.resetPassword(lookup.userId, pw);
      toast(`Password updated for ${username.trim()}`);
      setUsername(''); setPw(''); setPw2('');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>Reset password</h3></div>
      <form className="card-body stack" style={{ gap: 14 }} onSubmit={submit}>
        <label className="field">
          <span>Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
        </label>
        <div className="grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>New password (min 8)</span>
            <input className="input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="off" />
          </label>
          <label className="field">
            <span>Confirm</span>
            <input className="input" type="text" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="off" />
          </label>
        </div>
        <button className="btn primary" disabled={busy}>{busy ? 'Updating…' : 'Reset password'}</button>
      </form>
    </div>
  );
}

function LookupCard() {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setResult(await customersApi.lookup(username.trim()));
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>Find a profile link</h3></div>
      <form className="card-body stack" style={{ gap: 12 }} onSubmit={submit}>
        <div className="row">
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (e.g. z123)" required />
          <button className="btn" disabled={busy}>{busy ? '…' : 'Find'}</button>
        </div>
        {result && !result.found && <div className="small" style={{ color: 'var(--danger)' }}>No account with that username.</div>}
        {result?.found && (
          result.link ? (
            <div className="copy-line" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <span className="small mono grow" style={{ overflowWrap: 'anywhere' }}>{result.link}</span>
              <CopyButton text={result.link} label="profile link" />
            </div>
          ) : (
            <div className="small muted">Account found, but no profile is linked to it yet.</div>
          )
        )}
      </form>
    </div>
  );
}
