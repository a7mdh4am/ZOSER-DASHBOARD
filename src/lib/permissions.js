// Client-side mirror of the backend's flat admin_permissions codes
// (defense-in-depth: the server still enforces every gate via
// requirePermission(); this only decides what UI to show). Node's RBAC has
// no per-value granularity (no PHP-style status_lists) — a permission is
// either granted or not for the whole staff member.
export function hasPermission(perms, code) {
  if (!perms) return false;
  return perms.includes(code);
}
