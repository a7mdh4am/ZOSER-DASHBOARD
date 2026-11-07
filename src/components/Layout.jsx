import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  IconBox, IconBrush, IconDashboard, IconGear, IconKey, IconLogout, IconMenu, IconMoney, IconMoon, IconOrders, IconPalette, IconShield, IconSun, IconTag, IconUser,
} from './Icons.jsx';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('zoser-theme') || 'auto');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const toggle = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const next = dark ? 'light' : 'dark';
    localStorage.setItem('zoser-theme', next);
    setTheme(next);
  };

  return { toggle };
}

const TITLES = [
  ['/orders/', 'Order'],
  ['/orders', 'Orders'],
  ['/designer', 'Design Studio'],
  ['/customers', 'Customers'],
  ['/themes', 'Themes'],
  ['/products', 'Products'],
  ['/coupons', 'Coupons'],
  ['/finance', 'Finance'],
  ['/team', 'Team'],
  ['/roles', 'Roles'],
  ['/settings', 'Settings'],
  ['/', 'Dashboard'],
];

const NAV = [
  ['/', 'Dashboard', IconDashboard, 'dashboard.view', true],
  ['/orders', 'Orders', IconOrders, 'orders.view', false],
  ['/designer', 'Design Studio', IconPalette, 'designer.view', false],
  ['/customers', 'Customers', IconUser, 'customers', false],
  ['/themes', 'Themes', IconBrush, 'themes.view', false],
  ['/products', 'Products', IconBox, 'products.view', false],
  ['/coupons', 'Coupons', IconTag, 'coupons.view', false],
  ['/finance', 'Finance', IconMoney, 'finance.view', false],
  ['/team', 'Team', IconShield, 'team.manage', false],
  ['/roles', 'Roles', IconKey, 'roles.manage', false],
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const title = TITLES.find(([p]) => location.pathname.startsWith(p) && p !== '/')?.[1]
    ?? (location.pathname === '/' ? 'Dashboard' : 'Zoser');

  const initials = (user?.display_name || user?.username || '?').slice(0, 2);

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <img src="/images/logo.svg" alt="" />
        </div>

        {NAV.filter(([, , , perm]) => can(perm)).map(([to, label, Icon, , end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}

        <div className="spacer" />

        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div className="who grow">
            <div className="name">{user?.display_name || user?.username}</div>
            <div className="role">{user?.role}</div>
          </div>
          <NavLink to="/settings" className="btn ghost icon" title="Account settings" aria-label="Account settings">
            <IconGear />
          </NavLink>
          <button className="btn ghost icon" onClick={logout} title="Sign out" aria-label="Sign out">
            <IconLogout />
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <IconMenu />
          </button>
          <h1>{title}</h1>
          <div className="grow" />
          <button className="btn ghost icon" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            <span className="only-light"><IconMoon /></span>
            <span className="only-dark"><IconSun /></span>
          </button>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
