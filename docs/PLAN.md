# Zoser Admin: audit and plan

Audited at commit `78c75bf` on 2026-11-09, then updated the same day for order items and per-item NFC links ([7.10](#710-order-items-and-nfc-links)). The app is frontend only: there is no backend, and this plan treats the code in this repo as the only source of truth. Comments that mention a backend or documents outside this repo are treated as unverified.

Contents: [1 Summary](#1-summary) · [2 How the app works](#2-how-the-app-works) · [3 Gaps](#3-gaps) · [4 Security](#4-security) · [5 Efficiency](#5-efficiency) · [6 Functionality](#6-functionality) · [7 Backend contract](#7-backend-contract) · [8 PWA plan](#8-pwa-plan) · [9 Roadmap](#9-roadmap) · [10 How this was verified](#10-how-this-was-verified)

## How to read the findings

- **Paths** are relative to `src/` unless they name a root file (`package.json`, `index.html`, `vite.config.js`, `eslint.config.js`). `mock:249` means `src/lib/mock/index.js:249`.
- **Severity** is given for today, then after an arrow for when a real backend and real data exist: `low → medium`. One value means it does not change.
- **Scope** says where the problem lives: `prod` (code that ships in a normal build), `mock` (only the dummy API, whose behaviour a backend might copy), `dev` (tooling only), or `both`.
- **Effort** is S (localized change), M (coordinated change), or L (a substantial workflow or infrastructure piece).
- **Status** is `Confirmed` (the cited code was opened and proves it), or `Unverified` (reported by the audit, its citation exists, but it was not independently read). Suspicions are listed separately.
- **Line numbers** come from the audit commit. The order-item change moved code in `lib/mock/*`, `pages/order-detail/*`, `pages/Designer.jsx` and `lib/api.js`, so citations in those files can be off by some lines. `pages/order-detail/ItemsCard.jsx` and `CustomizationCard.jsx` were replaced by `LineCard.jsx`.

## 1. Summary

The dashboard is well built for a frontend without a backend. It has a clean API layer, code splitting, shared UI, and a production bundle that contains no mock data. The build and lint pass.

**Nothing is critical or high today**, because nothing real is connected. These are the things most likely to cause real damage if they are not handled before launch:

1. **Every permission check is cosmetic until a backend enforces it.** The dummy API checks only that someone is signed in (`mock:117`). See [4.3](#43-checks-the-backend-must-enforce).
2. **Money rules are undefined or wrong in the mock**, and a backend copying them would inherit the errors: history rewrites when a cost changes, cash flow ignores refunds, filters apply to some numbers and not others, and changing a zone does not change the shipping fee (GAP-14, GAP-26, GAP-27, GAP-28).
3. **Open tabs will break at the first deploy.** There is no error boundary, so a failed page chunk blanks the whole app (GAP-18).
4. **Order status and shipments have no rules.** Any status can be set from any other, and duplicate active shipments are allowed (GAP-10, GAP-11).
5. **No tests exist** for any of the logic above (GAP-40).

Automated checks, run for this audit in a scratch copy of the workspace:

| Check                   | Result                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`         | Pass. 97 modules, no source maps, 21 files, 464 KB on disk.                                                                      |
| `npm run lint`          | Pass with no warnings.                                                                                                           |
| `npm run format:check`  | **Fail.** `src/styles/layout.css` is unformatted (from `78c75bf`).                                                               |
| `npm test`              | **No such script.** There are no test files.                                                                                     |
| `npm audit` (workspace) | **15 advisories: 9 high, 6 moderate, 0 critical.** Most belong to the sibling `website` app. See [SEC-10](#41-confirmed-issues). |

## 2. How the app works

### 2.1 Stack and structure

React 19, React DOM, React Router 7 (declarative `BrowserRouter`), and Vite 7, in plain JavaScript. Those three are the only runtime dependencies. There is no state library. Charts and icons are hand-written SVG.

The folder is a member of an npm workspace. Its `package-lock.json` and `node_modules` live in the parent `_frontend/` folder, which is outside this git repo (GAP-44).

| Folder                | Holds                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `main.jsx`, `App.jsx` | Providers (StrictMode, Router, Auth, Toast), routes, lazy page loading                           |
| `pages/`              | Feature pages; `finance/`, `order-detail/` and `products/` have sub-components                   |
| `components/`         | `Layout`, shared `ui`, `charts`, `order`, `Icons`, `ThemeChips`                                  |
| `context/`, `hooks/`  | Auth and toast contexts; `useApiData`, `useAction`                                               |
| `lib/`                | `api.js` (the only network layer), `permissions.js`, `csv.js`, `format.js`, `dates.js`           |
| `lib/mock/`           | Dummy API: `index.js` (routes), `db.js` (fixtures), `reports.js` (aggregates), `shop-catalog.js` |
| `styles/`             | Tokens, base, layout, components, pages, utilities, print, responsive                            |

### 2.2 State and data flow

State is local React state, plus two contexts (auth, toast) and one module-level finance cache (`pages/finance/shared.js:36`).

A read follows this path: a page calls `useApiData(() => ordersApi.list(...), deps)`, `api.js` builds `/api/v1/admin/...`, the request goes to `fetch` or `mockFetch`, the `{ data }` envelope is unwrapped, and the hook stores the result. `useApiData` drops responses that arrive after a newer request started (`hooks/useApiData.js:27-48`), but does not abort them.

A write goes through `useAction`, which ignores repeat calls while one is running (`hooks/useAction.js:9-25`). It then shows a toast and reloads. This stops double-clicks only. It is not durable idempotency.

### 2.3 Where data comes from

| Source                                 | What uses it                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| API layer, answered by the mock in dev | All business data                                                                                                   |
| In-memory fixtures (`lib/mock/db.js`)  | Orders, products, coupons, staff, roles, ledger. Lost on reload.                                                    |
| `localStorage`                         | Only `zoser-theme` (`components/Layout.jsx:29`, `index.html:19`) and the mock's signed-in username (`mock:147-149`) |
| Blob URLs                              | Files uploaded in the mock; gone on reload                                                                          |
| Hardcoded in the UI                    | Status map (`lib/format.js:3-10`), `permissions.js`, courier list, EGP currency                                     |

**Mock switch.** `VITE_MOCK_API=true|false` wins. Otherwise the mock is on for `vite` dev and off for `vite build` (`lib/api.js:14-16`, `vite.config.js:12-14`). When off, `dummy-api` aliases to a stub (`lib/mock/off.js`), so neither the fixtures nor the images ship. Requests go to same-origin `/api/v1/admin/*`, there is no fallback, and without a server the user sees Login and every sign-in fails.

### 2.4 Routes and guards

Signed-out users see Login at every path. There is no `/login` route. Signed-in routes exist only if `can(permission)` is true, and unknown or forbidden paths redirect to the first permitted page (`App.jsx:115-169`). Page code is lazy-loaded. The opening page starts downloading before the auth check, and all pages are prefetched when idle (`App.jsx:53-59`, `:89-99`).

| Route                    | Page                    | Permission       |
| ------------------------ | ----------------------- | ---------------- |
| `/`                      | Dashboard               | `dashboard.view` |
| `/orders`, `/orders/:id` | Orders, Order detail    | `orders.view`    |
| `/designer`              | Design Studio           | `designer.view`  |
| `/customers`             | Customer account tools  | `customers.view` |
| `/themes`                | Profile and site themes | `themes.view`    |
| `/products`              | Catalog                 | `products.view`  |
| `/coupons`               | Coupons                 | `coupons.view`   |
| `/finance`               | Ten report tabs         | `finance.view`   |
| `/team`                  | Staff and activity      | `team.manage`    |
| `/roles`                 | Role editor             | `roles.manage`   |
| `/settings`              | Own account             | Signed in        |

### 2.5 Pages and user journeys

- **Login:** username and password, inline error, then permitted routes. No password recovery.
- **Dashboard:** net revenue, orders, deposits and production counts with month-on-month change; a 30-day revenue or orders chart; status mix, product performance, recent orders, top zones; refresh.
- **Orders:** search by id, name or phone (debounced); filter by status; 25 rows per page; filters and page live in the URL.
- **Order detail:** one screen with these cards:
  - Payment: totals, deposits, add a deposit.
  - One card per order item: its design, count, price, physical items, customization and an edit form for that item, which can replace each picture. Add-ons can be added, edited and removed there, and the order total follows.
  - Production notes: timeline, attachments, add, delete with confirmation.
  - Status: any status can be chosen.
  - NFC links: one button creates one shared profile per order item and one link per physical item. Each item can be blocked, disconnected, deleted or given a new link, and items can be added. Themes are assigned per profile.
  - Shipments: history, create with tracking and COD, mark delivered, returned or cancelled.
  - Customer: copy details, WhatsApp, edit phone, address, city and zone.
- **Design Studio:** two queues, To design (status 1) and In production (status 5), oldest first. Open a card to see artwork and notes, then move a deposited order to production. It is a queue viewer, not an artwork editor.
- **Customers:** three separately permissioned cards: create account, reset password by username, find a profile link. It is not a customer directory.
- **Products:** design cards; create a design, edit details, toggle active; upload cover and front or back images per colour; add or remove colours; add or replace price tiers by card count.
- **Coupons:** list, create and edit (percentage or fixed, expiry, minimum, usage caps), toggle, delete. The Usage column shows configured limits, not actual redemptions.
- **Themes:** custom themes (create, edit, toggle); assign or remove themes by customer username; site themes (create, toggle, delete).
- **Finance:** shared date, status, product and city filters across ten tabs: Overview, Orders (with CSV), Products, Customers, Payments, Discounts, Shipping, Refunds, Profit (set unit costs), Cash flow (add entries). Print to PDF uses the browser.
- **Team:** staff list, create staff, activate or deactivate, per-user activity, global activity feed.
- **Roles:** create, edit and delete roles and their permission checkboxes. System roles are protected.
- **Settings:** display name, change password, change email by six-digit code, list and revoke sessions.

## 3. Gaps

No placeholder page, TODO marker, or button without a handler was found. The real gaps are missing workflows, weak validation, and failures that look like empty data.

### 3.1 Missing or inconsistent workflows

| ID    | Finding and evidence                                                                                                                                                                                                                                                    | Severity | Scope | Impact                                                                          | Fix                                                                | Effort | Status     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- |
| GAP-1 | Refund instructions name a control that does not exist. `pages/finance/RefundsTab.jsx:35`, `pages/finance/CashflowTab.jsx:211`; the order page only adds deposits (`pages/order-detail/PaymentCard.jsx:77`); `lib/api.js:194-217` has no refund or payment-status call. | medium   | prod  | Staff cannot do the documented refund flow. Mock refunds are seed data only.    | Build an audited refund action with amount and reason, per D2.     | L      | Confirmed  |
| GAP-2 | A staff member's role cannot be changed. `teamApi.assignRole` exists (`lib/api.js:319`, `mock:921`) and is the only API method no page calls; the Team table only displays the role (`pages/Team.jsx:120-122`). Roles with staff cannot be deleted (`mock:886`).        | medium   | prod  | Staff need a new account to change roles, and those roles can never be removed. | Add a role selector guarded by `team.manage`.                      | M      | Confirmed  |
| GAP-3 | Couriers are manual only; every carrier takes a typed tracking number. `pages/order-detail/Shipments.jsx:178-179`                                                                                                                                                       | low      | prod  | No booking or tracking sync.                                                    | Keep it explicit in the UI; integrate couriers later if wanted.    | L      | Confirmed  |
| GAP-4 | `/customers` renders nothing for a role with only `customers.view`. `pages/Customers.jsx:13-27`                                                                                                                                                                         | low      | prod  | An unexplained blank page.                                                      | Add an "ask your admin" message or require a dependent permission. | S      | Confirmed  |
| GAP-5 | Mock catalog has lorem ipsum and empty descriptions, which the editor then refuses to save unchanged. `lib/mock/shop-catalog.js:12`, `:32`, `mock:645`                                                                                                                  | low      | mock  | Misleading demo data.                                                           | Fill in valid demo text.                                           | S      | Unverified |

### 3.2 Forms and data integrity

| ID     | Finding and evidence                                                                                                                                                                                                                                                                     | Severity      | Scope | Impact                                                                            | Fix                                                                                    | Effort | Status    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ | --------- |
| GAP-6  | Modal Save buttons sit outside a `<form>`, so `min`, `max` and `required` never run. Coupons `pages/Coupons.jsx:238-241`, `:291-297`; COD `pages/order-detail/Shipments.jsx:119`; quantity `pages/products/ProductModal.jsx:136`, `:207`; tiers `pages/products/editors.jsx:347`, `:379` | medium        | both  | Negative or out-of-range values reach the API. A 150% coupon is accepted.         | Add shared validators with field errors, and enforce the same rules on the server.     | M      | Confirmed |
| GAP-7  | One Save sends two PATCHes in `Promise.all`. `lib/api.js:205-213`                                                                                                                                                                                                                        | medium        | both  | One can succeed while the UI reports failure, leaving the order half-updated.     | Use one atomic endpoint (D9).                                                          | M      | Confirmed |
| GAP-8  | City and zone may be left blank. Changing city clears the zone in the form, then blank is sent as `undefined` and the mock keeps the old zone. `pages/order-detail/CustomerCard.jsx:80-87`, `:138-140`, `mock:406-407`                                                                   | medium        | both  | An order can hold a zone from a different city, which breaks zone-based shipping. | Require a valid city and zone pair on client and server.                               | M      | Confirmed |
| GAP-9  | Design edit only requires a product. Price can be negative, colour can be `none` or absent from the new product, and song is free text. A colour mismatch silently keeps old artwork. `pages/order-detail/EditDesignModal.jsx:104-112`, `:136`, `:243`, `mock:428-432`                   | medium        | both  | Invalid customization and stale artwork.                                          | Validate price, colour membership, names and URL; require a deliberate price override. | M      | Confirmed |
| GAP-10 | Order status can jump to any status, with no reason captured. `pages/order-detail/StatusCard.jsx:23-26`, `mock:358-362`                                                                                                                                                                  | medium → high | both  | Status can contradict payment, production and shipping.                           | Server-side transition table with reasons and history (D1).                            | L      | Confirmed |
| GAP-11 | Duplicate active shipments only trigger a warning. Returning an old shipment clears the tracking number even if another is active, and delivery does not update the order or payment. `pages/order-detail/Shipments.jsx:149-160`, `mock:471-481`                                         | medium → high | both  | Double fulfilment; order state drifts from reality.                               | One active shipment per order; transactional updates.                                  | M      | Confirmed |
| GAP-12 | Email, role code, theme colours and preview URL are unvalidated. `pages/Team.jsx:213-219`, `pages/Roles.jsx:165`, `:186`, `pages/Themes.jsx:27-30`, `:251-260`                                                                                                                           | medium        | both  | Malformed values stored.                                                          | Shared schemas on client and server.                                                   | M      | Confirmed |
| GAP-13 | Product save and active toggle are two calls. `pages/products/ProductModal.jsx:88-100`                                                                                                                                                                                                   | low           | both  | Partial save shows as failure.                                                    | Combine, or report partial success.                                                    | M      | Confirmed |
| GAP-14 | Changing the zone does not change the shipping fee, and changing the design price keeps the old coupon amount. `mock:403-408`, `mock:411-434`, `lib/mock/db.js:592-599`                                                                                                                  | medium → high | mock  | Totals drift from the per-zone fee and coupon rules.                              | Server repricing with snapshots (D3).                                                  | M      | Confirmed |
| GAP-15 | File pickers have no size, count or dimension limits. `pages/order-detail/NotesCard.jsx:118-121`, `:160-167`; `pages/products/editors.jsx:21-30`, `:198-208`                                                                                                                             | medium        | both  | Huge uploads fail late and consume memory.                                        | Client limits for UX; real limits on the server ([7.7](#77-file-uploads)).             | M      | Confirmed |

### 3.3 Loading, empty, error and recovery states

| ID     | Finding and evidence                                                                                                                                                                                                                                                       | Severity      | Scope | Impact                                                                | Fix                                                                     | Effort | Status     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------ | ---------- |
| GAP-16 | Opening an existing product shows a "New design" form until it loads, and stays that way if the load fails (rejection unhandled). `pages/products/ProductModal.jsx:42`, `:63-65`, `:125-143`                                                                               | medium        | both  | A user with add permission can create a duplicate instead of editing. | Separate loading and error states; disable Save until loaded.           | M      | Confirmed  |
| GAP-17 | Failures display as empty data; comments confirm it is deliberate. Cities `pages/order-detail/CustomerCard.jsx:67-69`, roles `pages/Team.jsx:61-63`, activity `pages/Team.jsx:333-334`, sessions `pages/Settings.jsx:17-18`                                                | medium        | both  | Staff act on false emptiness, such as "no active sessions".           | Show an error with retry; block dependent writes.                       | M      | Confirmed  |
| GAP-18 | No error boundary exists anywhere. `App.jsx:66-70`, `components/Layout.jsx:189-191`, `main.jsx:9`. A failed chunk or render error removes the whole app, and a rejected `lazy()` stays rejected until reload.                                                              | medium → high | both  | Every deploy can blank open tabs when old chunks disappear.           | Route-level boundary with Retry and Reload.                             | M      | Confirmed  |
| GAP-19 | A 200 response that is not JSON becomes `null` data, and pages then crash: `lib/api.js:58-64`, `pages/Orders.jsx:79`. The SPA rewrite that deep links need (GAP-46) can produce exactly this if it also catches `/api`.                                                    | low → medium  | both  | White screen on a misrouted or malformed response.                    | Validate content type and envelope in `request()`.                      | S      | Confirmed  |
| GAP-20 | Finance Orders keeps its page number when shared filters change. `pages/finance/OrdersTab.jsx:28-33`; only search and sort reset it (`:50-53`, `:69-71`).                                                                                                                  | medium        | both  | Narrowing filters on a later page shows a blank table.                | Reset the page when filters change.                                     | S      | Confirmed  |
| GAP-21 | Finance reloads keep old numbers on screen with no busy state, and Refunds hides its secondary request's errors. `pages/finance/parts.jsx:26-30`, `pages/finance/OrdersTab.jsx:33`, `pages/finance/RefundsTab.jsx:11-16`                                                   | low           | both  | Old totals appear under new filters.                                  | Mark stale content; surface the error.                                  | M      | Confirmed  |
| GAP-22 | Missing empty messages: product grid, roles, staff table, site themes, recent orders, some finance tables. `pages/products/index.jsx:42`, `pages/Roles.jsx:52`, `pages/Team.jsx:101`, `pages/Themes.jsx:450`, `pages/Dashboard.jsx:199`, `pages/finance/OrdersTab.jsx:102` | low           | both  | Ambiguous blank panels.                                               | Add consistent empty states.                                            | S      | Unverified |
| GAP-23 | Clipboard failure is swallowed. `components/ui.jsx:155-161`                                                                                                                                                                                                                | low           | both  | Copy appears to do nothing.                                           | Show a failure toast.                                                   | S      | Confirmed  |
| GAP-24 | When a session expires, the whole route tree swaps to Login and open modals are lost. `App.jsx:115-120`, `context/AuthProvider.jsx:33`                                                                                                                                     | low → medium  | both  | A half-typed form disappears mid-task.                                | Sign-in overlay that keeps the page, or dirty-form protection (FUN-12). | M      | Confirmed  |
| GAP-25 | Any failure during session restore, including a network error or 500, is treated as signed out. `context/AuthProvider.jsx:26-27`                                                                                                                                           | low → medium  | both  | A server outage looks like being logged out.                          | Distinguish offline or server error, with retry.                        | S      | Confirmed  |

### 3.4 Finance and reporting rules

The calculations below live in the mock, but it is the contract a backend will copy, so they need deciding before that happens.

| ID     | Finding and evidence                                                                                                                                                                                | Severity      | Scope | Impact                                                             | Fix                                                   | Effort | Status     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----- | ------------------------------------------------------------------ | ----------------------------------------------------- | ------ | ---------- |
| GAP-26 | The UI promises "history stays intact", but a cost change overwrites one value and recalculates all past profit. `pages/finance/ProfitTab.jsx:203-204`, `mock:577-581`, `lib/mock/reports.js:96-97` | medium → high | mock  | Past profit changes whenever a cost changes.                       | Effective-dated cost, snapshotted on each order (D4). | L      | Confirmed  |
| GAP-27 | Status, product and city filters do not apply to ledger entries, though they do apply to orders, refunds and shipments. `lib/mock/reports.js:70-91`                                                 | medium → high | mock  | A filtered view mixes filtered revenue with unfiltered expenses.   | Define and apply the scope (D5).                      | M      | Confirmed  |
| GAP-28 | Cash flow ignores refunds, which live in a separate table. `lib/mock/reports.js:492-522`, `lib/mock/db.js:759`                                                                                      | medium → high | mock  | Running balance overstates cash.                                   | Post refunds to the ledger (D2).                      | M      | Confirmed  |
| GAP-29 | `cost_configured` is true if any product has a cost; units with no cost silently count as zero. `lib/mock/reports.js:96-109`                                                                        | medium → high | mock  | Profit looks complete when it is not.                              | Return coverage and flag partial profit.              | M      | Confirmed  |
| GAP-30 | The UI says customers are grouped by normalized phone; the mock groups raw strings. `pages/finance/CustomersTab.jsx:43`, `lib/mock/reports.js:312`                                                  | low           | mock  | Same customer split by format.                                     | Normalize on the server.                              | M      | Unverified |
| GAP-31 | Regional shipping rows use orders placed in range, totals use shipment date. `lib/mock/reports.js:346`, `:403-417`                                                                                  | low           | mock  | Table and totals disagree.                                         | Pick one date basis.                                  | M      | Unverified |
| GAP-32 | Only note add and delete write to the activity log. `mock:383`, `:393`                                                                                                                              | low → high    | mock  | The feed will mislead. A backend must log every privileged change. | Central audit on all mutations.                       | M      | Confirmed  |
| GAP-33 | A saved unit cost of 0 cannot be re-saved, because `!costVal` is true for the number 0. `pages/finance/ProfitTab.jsx:168`, `:194`                                                                   | low           | both  | Minor editing bug.                                                 | Compare with `""`.                                    | S      | Confirmed  |
| GAP-34 | "Average spend" and "top customer spend" use different definitions. `lib/mock/reports.js:318`, `:340`                                                                                               | low           | both  | Numbers look inconsistent.                                         | Align or rename.                                      | S      | Unverified |
| GAP-35 | Dashboard headline values are all-time, while deltas compare months. `pages/Dashboard.jsx:74-91`, `lib/mock/reports.js:142-147`                                                                     | low           | both  | Confusing comparison.                                              | Label the timeframe.                                  | S      | Unverified |

### 3.5 Permissions in the UI

| ID     | Finding and evidence                                                                                                                                                                                                 | Severity     | Scope | Impact                                                           | Fix                                          | Effort | Status    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----- | ---------------------------------------------------------------- | -------------------------------------------- | ------ | --------- |
| GAP-36 | Editing roles does not refresh the current user's permissions. `pages/Roles.jsx:139`, `pages/Team.jsx:65`, `context/AuthProvider.jsx:58`                                                                             | low → medium | both  | Navigation stays stale until reload.                             | Refetch `/auth/me` after changes and on 403. | M      | Confirmed |
| GAP-37 | Dashboard and Finance link to orders without checking `orders.view`. `pages/Dashboard.jsx:184`, `:204`, `pages/finance/OrdersTab.jsx:107`, `App.jsx:150`                                                             | low          | both  | Links silently redirect.                                         | Gate the links.                              | S      | Confirmed |
| GAP-38 | Pages call endpoints their permission does not obviously cover: Team reads `/roles`; password reset and theme assignment use customer lookup. `pages/Team.jsx:62`, `pages/Customers.jsx:156`, `pages/Themes.jsx:304` | medium       | both  | A literal per-endpoint check breaks these flows, or over-grants. | Narrow option and lookup rules (D10).        | M      | Confirmed |
| GAP-39 | The API comment says activity is super-admin only, while the route uses `team.manage`. `lib/api.js:323`, `App.jsx:166`                                                                                               | low          | both  | Unclear policy.                                                  | Decide (D10).                                | S      | Confirmed |

### 3.6 Tests, tooling and repo

| ID     | Finding and evidence                                                                                                                                                                                                                      | Severity         | Scope | Impact                                                         | Fix                                                                                                                   | Effort | Status    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| GAP-40 | No test script, runner or test files. `package.json:6-13`                                                                                                                                                                                 | medium → high    | both  | Money, auth and permission logic can regress unnoticed.        | Vitest first, then a few role journeys (order below).                                                                 | L      | Confirmed |
| GAP-41 | `reason` is accepted by two status calls and never sent. `lib/api.js:199`, `:232`; callers `pages/order-detail/StatusCard.jsx:15`, `pages/Designer.jsx:157`                                                                               | low              | both  | Dormant contract.                                              | Capture it as part of D1.                                                                                             | S      | Confirmed |
| GAP-42 | Comments point to documents and a server not in this repo, and `README.md` is one line. `lib/api.js:7-8`, `vite.config.js:6`, `:36`, `pages/Login.jsx:6`, `pages/products/index.jsx:14`, `pages/order-detail/Shipments.jsx:178`, `mock:8` | low              | both  | Misleads the next developer.                                   | Reword; write a real README.                                                                                          | S      | Confirmed |
| GAP-43 | `format:check` fails on `src/styles/layout.css`.                                                                                                                                                                                          | low              | dev   | The formatting gate is red.                                    | Run Prettier on it.                                                                                                   | S      | Confirmed |
| GAP-44 | The repo has no lockfile and no CI. The lockfile is in the parent workspace, outside git.                                                                                                                                                 | medium           | dev   | A clone of this repo cannot reproduce a build or run an audit. | Choose one: move the lockfile into this repo or version the workspace, then add CI for build, lint, format and tests. | M      | Confirmed |
| GAP-45 | `.DS_Store` and `src/.DS_Store` are tracked despite `.gitignore`.                                                                                                                                                                         | low              | dev   | Repo noise.                                                    | `git rm --cached`.                                                                                                    | S      | Confirmed |
| GAP-46 | `BrowserRouter` needs a server rewrite for deep links, and the repo has no hosting config. `main.jsx:11`, `vite.config.js:28`                                                                                                             | medium at deploy | prod  | Refreshing `/orders/5` returns 404.                            | Add a rewrite that excludes `/api` and `/media` (see GAP-19).                                                         | S      | Confirmed |

**Highest-value tests, in order:** totals, discounts and repricing; role-to-route matrix; `request()` refresh, 401, CSRF and envelope handling; `useApiData` races and `useAction` double-submit; contact and shipment rules; `csv.js` escaping; date boundaries.

### 3.7 Accessibility and responsive

The base is decent: the modal traps focus, restores it and closes on Escape (`components/ui.jsx:241-295`), order rows contain real links, cards respond to keyboard, toasts are live regions, and reduced motion is respected.

| ID     | Finding and evidence                                                                                                                                                                                                                                                                                 | Severity | Impact                                           | Fix                                                                        | Effort | Status     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ | -------------------------------------------------------------------------- | ------ | ---------- |
| GAP-47 | Controls with no accessible name: search `components/ui.jsx:217`, status `pages/order-detail/StatusCard.jsx:36`, deposit `pages/order-detail/PaymentCard.jsx:86`, finance filters `pages/finance/index.jsx:129`, email code `pages/Settings.jsx:356`, colour inputs `pages/products/editors.jsx:159` | medium   | Screen readers cannot tell what they are.        | Add labels.                                                                | S      | Confirmed  |
| GAP-48 | Sortable headers are click-only `<th>`, with no `aria-sort`. `pages/finance/OrdersTab.jsx:47-58`                                                                                                                                                                                                     | medium   | Keyboard users cannot sort.                      | Button inside the header, plus `aria-sort`.                                | S      | Confirmed  |
| GAP-49 | Charts are labelled only "Trend chart", with pointer-only values. `components/charts.jsx:92-99`, `:353`, `:385`                                                                                                                                                                                      | medium   | Trend data is unavailable without a mouse.       | Add a summary and a data table.                                            | M      | Confirmed  |
| GAP-50 | The closed mobile sidebar stays focusable; the menu has no `aria-expanded` or Escape. `styles/responsive.css:10-18`, `components/Layout.jsx:111-112`, `:165-171`                                                                                                                                     | medium   | Keyboard focus enters a hidden menu.             | Set `inert` when closed; manage focus.                                     | M      | Confirmed  |
| GAP-51 | Contrast below the 4.5:1 target (recalculated): white on light accent 2.24:1, white on dark accent 3.64:1, muted on light surface 3.22:1. `styles/tokens.css:9-15`, `:54`, `styles/components.css:34-36`, `styles/utilities.css:77-78`                                                               | medium   | Primary buttons and small text are hard to read. | Adjust tokens. This changes the brand colour's look, so it needs sign-off. | S      | Confirmed  |
| GAP-52 | Colour fields have two inputs in one label; segmented groups lack a group label. `pages/Themes.jsx:12-30`, `pages/Coupons.jsx:275`, `components/ui.jsx:68`                                                                                                                                           | low      | Ambiguous names.                                 | Separate labels; add fieldsets.                                            | S      | Unverified |
| GAP-53 | No `dir="auto"` on customer-entered text, though Arabic names are expected (`lib/csv.js:11`).                                                                                                                                                                                                        | low      | Mixed Arabic and Latin text can reorder.         | Add `dir="auto"` where names, addresses and notes render.                  | S      | Confirmed  |
| GAP-54 | The sidebar has a fixed height and no vertical scroll. `styles/layout.css:7-20`, `styles/responsive.css:11-18`                                                                                                                                                                                       | low      | Items are cut off on short screens.              | `overflow-y: auto`.                                                        | S      | Confirmed  |
| GAP-55 | Fixed widths (360px detail sidebar, 260px design grid minimum). `styles/pages.css:32`, `:210`, `styles/components.css:534`                                                                                                                                                                           | low      | Tight on narrow modals.                          | `minmax` and phone QA.                                                     | M      | Unverified |

### 3.8 Suspicions, not proven

| Suspicion and evidence                                                                                                                                | Severity | Next step                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------- |
| Dark-mode printing may keep dark surfaces, since print changes `color-scheme` but not the tokens. `styles/print.css:23-30`, `styles/tokens.css:45-53` | low      | Check print preview.       |
| Compact colour rows and nowrap rows may overflow small phones. `styles/components.css:432`, `pages/products/editors.jsx:116`                          | low      | Test at 320-390 px.        |
| An unusual build (`NODE_ENV=development vite build`) could make runtime and alias disagree on the mock. `vite.config.js:14`, `lib/api.js:14`          | low      | Derive both from one flag. |
| Rapid repeat toggles right after an action could reuse stale state. `pages/Coupons.jsx:41`, `pages/Themes.jsx:92`, `components/ThemeChips.jsx:13`     | low      | Disable until reloaded.    |

## 4. Security

### Good results, verified on the real production build

- No mock data or fixture images ship. Strings from the mock are absent from `dist`, and it contains only JS, CSS, HTML and the two public SVGs.
- There are no source maps, and no `dangerouslySetInnerHTML`, `innerHTML`, `document.write` or `srcDoc` in source.
- All 8 `target="_blank"` links have `rel="noreferrer"`.
- There is no post-login `next` redirect, so no open redirect.
- React 19 blocks `javascript:` URLs at render, and that guard is in the shipped bundle.
- `VITE_MOCK_API` is the only custom env variable, and it is not sensitive. No keys or tokens were found.
- Auth is held in memory, the CSRF token in a module variable. Nothing sensitive is in `localStorage`.
- `lib/csv.js:8-17` already defends against spreadsheet formula injection.

### 4.1 Confirmed issues

| ID     | Finding and evidence                                                                                                                                                                                                                                                                                                               | Severity               | Scope | Impact                                                                                                                                            | Fix                                                                            | Effort | Status    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | --------- |
| SEC-1  | DELETE requests send no CSRF header, because it is only added when there is a body. Silent token refresh sends none either. `lib/api.js:45-49`, `:109`, `:89-92`                                                                                                                                                                   | low → medium           | prod  | A backend enforcing CSRF rejects every delete, which tempts someone to relax the check.                                                           | Attach by method, not by body. Define the refresh rule.                        | S      | Confirmed |
| SEC-2  | The CSRF token is read only during boot; `login()` never stores it. `context/AuthProvider.jsx:14`, `:41-47`                                                                                                                                                                                                                        | low → medium           | prod  | If the boot request failed, or the server rotates the token at login (recommended), all writes fail.                                              | Call `setCsrf(me.csrfToken)` after login.                                      | S      | Confirmed |
| SEC-3  | Song and preview URLs are stored and linked without checking the scheme, and image and attachment URLs are used directly. `components/order.jsx:18-24`, `:59-64`, `:104-110`, `pages/Themes.jsx:153-157`, `pages/order-detail/EditDesignModal.jsx:241-243`, `pages/Designer.jsx:222-227`, `pages/order-detail/NotesCard.jsx:69-75` | low → medium           | both  | Staff can be sent to phishing pages. Not script execution, since React blocks `javascript:`.                                                      | Allow only `https:` for links and approved origins for media, on both sides.   | M      | Confirmed |
| SEC-4  | Staff and customer passwords are typed in plain view, and a sample placeholder suggests `12345678`. `pages/Customers.jsx:82-88`, `:193-208`, `pages/Team.jsx:251-258`                                                                                                                                                              | low → medium           | both  | Exposed on shared screens.                                                                                                                        | Mask with a reveal toggle; prefer invite links (D11).                          | S      | Confirmed |
| SEC-5  | Upload selection is not limited (see GAP-15).                                                                                                                                                                                                                                                                                      | low → medium           | both  | Resource abuse.                                                                                                                                   | Client limits, server checks.                                                  | M      | Confirmed |
| SEC-6  | A mock-enabled build has no real authentication: it starts signed in as admin, accepts any password, and checks no permissions. `mock:117`, `mock:144-151`, `mock:195-203`. It ships only if `VITE_MOCK_API=true` is set.                                                                                                          | low → high if deployed | mock  | A demo build on a public URL gives full demo access.                                                                                              | Show a demo banner; make CI fail if a release build contains the mock.         | S      | Confirmed |
| SEC-7  | Hardcoded placeholder credential values exist in the mock. `mock:186`, `mock:455` (values withheld). They are excluded from production builds.                                                                                                                                                                                     | low                    | mock  | None while synthetic.                                                                                                                             | Keep them synthetic; never reuse.                                              | S      | Confirmed |
| SEC-8  | No CSP or security headers are defined, and hosting is unknown. `index.html:4-29`, `vite.config.js:16-43`                                                                                                                                                                                                                          | low → medium           | prod  | Fewer browser defenses.                                                                                                                           | Set headers at the host ([8.6](#86-hosting-rules)).                            | M      | Confirmed |
| SEC-9  | The dev server listens on all interfaces, and the installed Vite has dev-server advisories (file access, cross-origin script). `package.json:7`, `vite.config.js:35-41`                                                                                                                                                            | medium                 | dev   | Anyone on the same network can reach the dev server and the vulnerable surface. The audit rated this low; it is raised because of the advisories. | Update Vite to 7.3.7 or later; default to loopback; add a separate LAN script. | S      | Confirmed |
| SEC-10 | Dependency advisories (table below).                                                                                                                                                                                                                                                                                               | medium                 | dev   | See below.                                                                                                                                        | Run `npm audit fix` in `_frontend/`, without `--force`.                        | S      | Confirmed |
| SEC-11 | Logout clears the screen even if the server call fails. `context/AuthProvider.jsx:50-56`                                                                                                                                                                                                                                           | low → medium           | prod  | The session may remain alive on the server.                                                                                                       | Tell the user when logout fails.                                               | S      | Confirmed |
| SEC-12 | No `noindex` on an admin site. `index.html:4-11`                                                                                                                                                                                                                                                                                   | low                    | prod  | Login page may be indexed.                                                                                                                        | Add a robots meta tag or header.                                               | S      | Confirmed |

**Dependency audit detail.** The workspace lockfile covers this app and the sibling `website` app.

| Package                                                                          | Severity         | Applies to admin?                                                                                              |
| -------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `react-router` and `react-router-dom` 7.18.1                                     | high             | Production dependency, but the advisory is for RSC mode, which this app does not use. Update to 7.18.5 anyway. |
| `axios`, `zod`                                                                   | high             | **No.** Direct dependencies of `website` only.                                                                 |
| `follow-redirects`                                                               | high             | **No**, inferred to come through `axios`.                                                                      |
| `vite` 7.3.6                                                                     | high             | Dev only, and relevant because of SEC-9. Fixed in 7.3.7.                                                       |
| `source-map-js`, `nanoid`, `browserslist`, `postcss`, `baseline-browser-mapping` | high or moderate | Build tooling only. A lockfile refresh fixes them.                                                             |
| `eslint`, `@eslint/js`, `@eslint/config-array`, `minimatch`                      | moderate         | Lint tooling only. npm's proposed fix is a major downgrade to ESLint 9, so skip it.                            |

**Where tokens should live.** Use `Secure`, `HttpOnly`, `SameSite` cookies with server-side sessions, rotation and revocation, plus CSRF on all unsafe methods. Do not put tokens in `localStorage`. The existing same-origin client already expects this. An XSS could still act within an active session, so the CSP still matters.

### 4.2 Security suspicions

| Suspicion and evidence                                                                                                                                                   | Severity              | Fix                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------ |
| A late finance response can refill the cache after Finance unmounts. `pages/finance/shared.js:46-48`, `pages/finance/index.jsx:71`                                       | low → medium          | Scope the cache to the session; add a generation check.      |
| Cookie flags, rate limits and revocation are assumed, not shown. `lib/api.js:38-43`                                                                                      | low → high if omitted | Verify in backend tests.                                     |
| CSV headers are not escaped, and leading whitespace can slip past the formula check. Server-built CSV is unknown. `lib/csv.js:8-24`, `pages/finance/OrdersTab.jsx:35-40` | low → medium          | Test in Excel and Sheets; apply the same rule on the server. |

### 4.3 Checks the backend must enforce

Client guards are UX only. `hasPermission` reads a client-side list (`lib/permissions.js:84-95`), and `Can` only hides children (`components/ui.jsx:31-34`). **The server must authenticate every request, check the permission, check that the record exists and may be touched, and log it.**

| Resource                          | Permission                                                                  | The server must also                                                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, refresh, logout            | none, session                                                               | Verify credentials and blocked state; throttle; rotate and revoke; apply the origin and CSRF policy                                                                                                      |
| Dashboard                         | `dashboard.view`                                                            | Return only what this permission should see (it includes revenue)                                                                                                                                        |
| Orders read                       | `orders.view`                                                               | Validate paging and search; decide on field-level limits, since all customer and money data comes with this one permission                                                                               |
| Order status                      | `orders.status.update`                                                      | Enforce transitions, prerequisites, reason, concurrency, audit                                                                                                                                           |
| Design edit, add-ons              | `orders.details.update`                                                     | Item belongs to the order; product and colour match; validate price and URL; check each image's real type and size; add-on price not negative and no duplicates; recalculate totals on the server; audit |
| Contact edit                      | `orders.customer_info.update`                                               | Valid phone; zone belongs to city; atomic; reprice shipping                                                                                                                                              |
| Deposit                           | `finance.deposit.add`                                                       | Positive decimal; overpayment policy; idempotency; immutable record                                                                                                                                      |
| Notes                             | `production.notes.add`, `.delete`                                           | Note belongs to order; file checks; audit                                                                                                                                                                |
| Shipments                         | `orders.shipment.create`, `.status.update`                                  | One active per order; valid carrier and COD; valid transitions; reconcile order and payment                                                                                                              |
| Production queue                  | `designer.view`                                                             | Only status 1 to 5; limit returned fields                                                                                                                                                                |
| Customer create, order profiles   | `profiles.create`                                                           | Unique username; password policy; no duplicate provisioning                                                                                                                                              |
| Customer lookup                   | `users.view`, or tightly scoped for reset and theme assignment              | See D10; return minimal fields                                                                                                                                                                           |
| Password reset                    | `users.password.reset`                                                      | Rate limit; audit; revoke sessions; never return the password                                                                                                                                            |
| Theme assign                      | `profiles.themes.add`                                                       | Valid customer and theme; idempotent; audit                                                                                                                                                              |
| NFC item actions                  | `profiles.items.manage`                                                     | Item belongs to a profile staff may see; replaced and deleted codes never work again; audit every action                                                                                                 |
| Connecting an item (customer API) | Signed-in customer                                                          | One account per item, enforced atomically so two scans cannot both win; blocked, deleted and not-yet-eligible items refused; rate-limit code lookups; never reveal the owner to other accounts           |
| Themes                            | `themes.view`, `catalog.themes.manage`                                      | Protect the default site theme (the UI does, the mock does not: `pages/Themes.jsx:489`, `mock:1008`)                                                                                                     |
| Products                          | `products.view`, `catalog.products.add`, `.update`, `catalog.prices.update` | Unique slug; parent ownership; file checks; valid quantities and tiers                                                                                                                                   |
| Coupons                           | `coupons.view`, `coupons.manage`                                            | Unique code; ranges; keep used coupons                                                                                                                                                                   |
| Finance                           | `finance.view`, `.entry.add`, `.costs.manage`                               | Authorize each section and export; bound expensive exports; safe CSV; idempotent entries                                                                                                                 |
| Team                              | `team.manage`                                                               | No privilege escalation, self-lockout, or losing the last admin; revoke sessions on block                                                                                                                |
| Roles                             | `roles.manage`                                                              | Only known codes; no escalation; protect system and in-use roles                                                                                                                                         |
| Activity                          | D10                                                                         | Paging; protect sensitive details                                                                                                                                                                        |
| Own settings                      | signed in                                                                   | Scope to the current user; verify current password; single-use expiring email code                                                                                                                       |

## 5. Efficiency

The app is already fast for what it does, and most ideas below should wait until real data shows a need. Measured from the production build:

| Item                                            | Size                                                   |
| ----------------------------------------------- | ------------------------------------------------------ |
| Entry JS (React, router, Login, Layout, shared) | 261.44 KB, 83.85 KB gzip                               |
| CSS                                             | 17.77 KB, 4.60 KB gzip                                 |
| All JS together                                 | about 123 KB gzip                                      |
| Largest page chunk (Finance, all ten tabs)      | 33.10 KB, 8.19 KB gzip                                 |
| Mock images                                     | 85 WebP files, 1.09 MB total, excluded from production |

**Measured, no action needed:** splitting the Finance tabs. The audit suggested it, but the whole chunk is 8 KB gzip, so the extra loading states cost more than they save.

| ID    | Finding and evidence                                                                                                                                      | Severity     | Impact                                       | Fix                                                                                                                      | Effort | Status     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- |
| EFF-1 | Every page is prefetched after sign-in, regardless of permissions. `App.jsx:89-99`                                                                        | low          | About 39 KB gzip that some users never need. | Prefetch permitted pages only, and respect data-saver. A service worker replaces this later ([8.3](#83-service-worker)). | S      | Confirmed  |
| EFF-2 | Requests are not aborted or shared across components. `hooks/useApiData.js:27-54`                                                                         | low → medium | Wasted work on expensive reports.            | Pass `AbortSignal` through the API layer.                                                                                | M      | Confirmed  |
| EFF-3 | The Finance cache has no expiry or size limit, and only Overview offers Refresh. `pages/finance/shared.js:36-48`, `pages/finance/OverviewTab.jsx:174-180` | low          | Stale numbers until you leave the page.      | Bounded cache with freshness; a shared Refresh.                                                                          | M      | Confirmed  |
| EFF-4 | Each colour, image or tier edit refetches the product and the entire catalog. `pages/products/ProductModal.jsx:67-70`, `pages/products/index.jsx:52-54`   | low          | Extra requests.                              | Return the changed item from mutations.                                                                                  | M      | Confirmed  |
| EFF-5 | Thumbnails use full-size URLs. `components/order.jsx:19-24`, `pages/products/ProductImg.jsx:20-26`                                                        | low → medium | Large customer uploads will load slowly.     | Server returns thumbnail variants.                                                                                       | M      | Confirmed  |
| EFF-6 | Replaced mock images are never revoked. `mock:605-627`, `mock:717-723`                                                                                    | low          | Mock-only memory growth.                     | Revoke the blob URLs.                                                                                                    | S      | Unverified |

**Scale-dependent, watch for later:** products, coupons, roles, staff and themes render whole responses (`pages/products/index.jsx:42-45`, `pages/Coupons.jsx:97`). Add server paging when they grow. Orders, finance orders and activity already page at 24 to 30 rows, so virtualization is not needed. Chart recomputation (`components/charts.jsx:24-49`, `:322-334`) should be profiled before any memoization. Mock report loops are quadratic (`lib/mock/reports.js:93-109`, `:551-567`), so do not copy them into a backend. Use indexed aggregates.

## 6. Functionality

Ranked by value against effort. Items that fix a gap reference it.

| Rank   | Improvement                                                                                                                                     | Who benefits                     | Value       | Effort | Evidence                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------- | ------ | ---------------------------------------------------------------------------------- |
| FUN-1  | Honest load failures with retry, everywhere                                                                                                     | All staff                        | Very high   | M      | GAP-16, GAP-17, GAP-18                                                             |
| FUN-2  | Atomic contact edit with a valid city and zone, showing the new shipping fee                                                                    | Order agents, shipping           | Very high   | M      | GAP-7, GAP-8, GAP-14                                                               |
| FUN-3  | Money reports that match their labels: cost history, partial-cost warning, defined filter scope                                                 | Finance, management              | Very high   | L      | GAP-26, GAP-27, GAP-29                                                             |
| FUN-4  | A real refund workflow                                                                                                                          | Finance, support                 | High        | L      | GAP-1, GAP-28                                                                      |
| FUN-5  | Guarded status and shipment transitions, with confirmation and reason                                                                           | Operations, shipping             | High        | M-L    | GAP-10, GAP-11                                                                     |
| FUN-6  | Show every production attachment in Design Studio (only the first shows today), and add notes from there                                        | Designers, production            | High        | S-M    | `pages/Designer.jsx:222-230`, `pages/order-detail/NotesCard.jsx:67-80`, `mock:246` |
| FUN-7  | Field-level validation on modal forms                                                                                                           | Catalog, finance, shipping       | High        | M      | GAP-6, GAP-9, GAP-12                                                               |
| FUN-8  | Refresh on queues, with "last updated" and focus-based refresh                                                                                  | Operations, production           | High        | M      | `pages/Orders.jsx:46-50`, `pages/Designer.jsx:31-34` have no refresh control       |
| FUN-9  | Keep finance tabs, filters and queue position in the URL, and return to them from an order                                                      | Anyone working a filtered list   | High        | M      | GAP-20, `pages/finance/index.jsx:58-67`, `pages/order-detail/index.jsx:53`         |
| FUN-10 | Change a staff member's role                                                                                                                    | Admins                           | High        | M      | GAP-2                                                                              |
| FUN-11 | Exports and printouts that state scope, filters and generation time, and whether rows are complete (several reports cap at top 20 or latest 30) | Finance, management              | Medium-high | M      | `lib/mock/reports.js:342`, `:447-449`, `:520`, `styles/print.css:3-9`              |
| FUN-12 | Warn before closing a changed form                                                                                                              | Everyone editing                 | Medium      | M      | `components/ui.jsx:259`, GAP-24                                                    |
| FUN-13 | Keyboard sorting and accessible chart data                                                                                                      | Keyboard and screen-reader users | Medium      | S-M    | GAP-48, GAP-49                                                                     |

## 7. Backend contract

Derived from `lib/api.js`, the pages and the mock. A script confirmed all **75 endpoints** match one-to-one between `api.js` and mock handlers. Running the mock confirmed the GET response shapes below, and every field the pages read exists in them.

Anything marked **inferred** is not in the code. The `Source` column gives the call site and mock handler.

### 7.1 Conventions the frontend already depends on

- **Base path:** `/api/v1/admin`, **same origin** as the app. Requests use `credentials: "same-origin"`, so a different origin would silently drop cookies.
- **Success:** `{ "data": payload }`. **Error:** `{ "error": { "message": string } }`, with the message shown directly to the user. The mock uses 401, 403, 404, 409, 422.
- **`GET /auth/me` must return 200 with `admin: null` when signed out.** A 401 here skips the refresh attempt and logs the user out (`context/AuthProvider.jsx:13-25`, `lib/api.js:67`).
- **401** on a non-auth call triggers one shared `POST /auth/refresh`, then one retry. A second 401 signs the user out. **Upload and CSV calls do not retry today** (`lib/api.js:112`, `:139`), so one should be added.
- **CSRF:** the `X-CSRF-Token` header comes from `csrfToken` in `/auth/me`. It must cover DELETE after SEC-1.
- **"PATCH" means full replace here.** An omitted optional field means cleared for `PATCH /coupons/:id`, `PATCH /products/:id` and `POST /orders/:id/lines/:lineId/design` (`mock:416-420`, `mock:754-756`). A backend using true partial PATCH would silently keep old values.
- **Naming is mixed, and these are easy traps:** requests are camelCase; most responses are snake_case; staff, team and activity responses are camelCase. `GET /orders` takes `per_page` but `GET /finance/orders` takes `perPage`. `price` is the subtotal in order lists (`mock:270`) but the bundle price in order detail (`mock:299`). A tier's `cards_count` becomes `friends_count` in `edit_products` (`mock:330`).
- **IDs** are numeric except staff, which are strings.
- **Order status** is numeric, in workflow order: `0` Pending, `1` Deposited, `5` Production, `2` Shipped, `4` Shipped + Paid, `3` Cancelled (`lib/format.js:3-13`).
- **Money rule in the code:** `grand_total = subtotal + shipping_fee − discount_amount`, and `subtotal = bundle price + extras` (`lib/mock/db.js:592-599`). Shipping is per zone (`zone.shippingFee`, `lib/mock/db.js:259`).

### 7.2 Auth, dashboard and geography

| Method and path      | Request                  | Response                                                                                                                                                                                                                                                                                   | Permission          | Source                                |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------- |
| GET `/auth/me`       | none                     | `{ admin: AdminWithPermissions or null, csrfToken }`                                                                                                                                                                                                                                       | public              | `AuthProvider.jsx:13` → `mock:180`    |
| POST `/auth/login`   | `{ username, password }` | `{ admin }` (client then calls `/auth/me`)                                                                                                                                                                                                                                                 | public              | `AuthProvider.jsx:42` → `mock:195`    |
| POST `/auth/refresh` | `{}` or empty            | `{ refreshed: boolean }`                                                                                                                                                                                                                                                                   | refresh session     | `api.js:89` → `mock:190`              |
| POST `/auth/logout`  | `{}`                     | `{ loggedOut: true }`                                                                                                                                                                                                                                                                      | session             | `AuthProvider.jsx:52` → `mock:205`    |
| GET `/dashboard`     | none                     | `summary`, `daily_series[{ day, order_count, revenue }]`, `status_breakdown[{ status, order_count }]`, `product_performance[{ product_name, total_revenue }]`, `recent_orders[{ id, order_time, full_name, product_name, status, net_total }]` (8), `top_zones[{ zone, order_count }]` (6) | `dashboard.view`    | `Dashboard.jsx:35` → `reports.js:140` |
| GET `/geo/cities`    | none                     | `{ cities[{ id, name, zones[{ id, name }] }] }`, with fees omitted                                                                                                                                                                                                                         | signed in (see D10) | `CustomerCard.jsx:68` → `mock:216`    |

`summary` fields: `net_revenue`, `total_orders`, `this_month_orders`, `last_month_orders`, `this_month_revenue`, `last_month_revenue`, `deposits_collected`, `deposited_orders`, `production_orders`, `shipped_orders`, `pending_orders`.

### 7.3 Orders, shipments and production

| Method and path                                    | Request                                                                                                                                                         | Response                                                                                                                                                                                   | Permission                      | Source                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------- |
| GET `/orders`                                      | `status?`, `search`, `page`, `per_page` (UI sends 25)                                                                                                           | `{ orders[OrderRow], total, per_page }`, newest first                                                                                                                                      | `orders.view`                   | `Orders.jsx:48` → `mock:249`             |
| GET `/orders/:id`                                  | none                                                                                                                                                            | `OrderDetail` (7.6)                                                                                                                                                                        | `orders.view`                   | `order-detail/index.jsx:29` → `mock:281` |
| POST `/orders/:id/deposits`                        | `{ value }`                                                                                                                                                     | LedgerEntry                                                                                                                                                                                | `finance.deposit.add`           | `PaymentCard.jsx:14` → `mock:342`        |
| POST `/orders/:id/status`                          | `{ status: number, reason? }` (UI omits reason)                                                                                                                 | `{ id, status }`                                                                                                                                                                           | `orders.status.update`          | `StatusCard.jsx:15` → `mock:358`         |
| POST `/orders/:id/notes`                           | multipart: `edits`, repeated `photos`                                                                                                                           | Note                                                                                                                                                                                       | `production.notes.add`          | `NotesCard.jsx:118` → `mock:372`         |
| DELETE `/orders/:id/notes/:noteId`                 | none                                                                                                                                                            | `{ deleted: true }`                                                                                                                                                                        | `production.notes.delete`       | `NotesCard.jsx:22` → `mock:387`          |
| PATCH `/orders/:id/customer-info`                  | `{ shipPhone }`                                                                                                                                                 | `{ id }`                                                                                                                                                                                   | `orders.customer_info.update`   | `api.js:207` → `mock:397`                |
| PATCH `/orders/:id/shipping`                       | `{ shipAddress, cityId?, zoneId? }`                                                                                                                             | `{ id }`                                                                                                                                                                                   | `orders.customer_info.update`   | `api.js:208` → `mock:403`                |
| POST `/orders/:id/lines/:lineId/design`            | Multipart: `design` is JSON `{ productId?, price?, groupName?, date?, addr?, song?, notes?, items[{ id, name, color }] }`, plus optional `image_<cardId>` files | `{ id }`. Text and images save together. A new colour or product switches that card to the catalog picture unless a file was sent; otherwise the picture is kept                           |
| POST `/orders/:id/lines/:lineId/extras`            | `{ name, price }`                                                                                                                                               | Extra; 409 if the item already has that name                                                                                                                                               |
| PATCH `/orders/:id/lines/:lineId/extras/:extraId`  | `{ name, price }`                                                                                                                                               | Extra; 409 on a duplicate name                                                                                                                                                             |
| DELETE `/orders/:id/lines/:lineId/extras/:extraId` | none                                                                                                                                                            | `{ deleted: true }`                                                                                                                                                                        |
| POST `/orders/:id/profile`                         | `{}`                                                                                                                                                            | `{ profiles[Profile] }`; only for order items with no profile yet, 409 when none are left                                                                                                  |
| POST `/profiles/:id/items`                         | `{ label }`                                                                                                                                                     | NfcItem; one more link, no change to price or production                                                                                                                                   |
| POST `/nfc-items/:id/status`                       | `{ status: active or blocked }`                                                                                                                                 | NfcItem                                                                                                                                                                                    |
| POST `/nfc-items/:id/disconnect`                   | `{}`                                                                                                                                                            | NfcItem; 409 when nobody is connected                                                                                                                                                      |
| POST `/nfc-items/:id/replace-link`                 | `{}`                                                                                                                                                            | NfcItem with a new link; the old code dies, the owner stays                                                                                                                                |
| DELETE `/nfc-items/:id`                            | none                                                                                                                                                            | `{ deleted: true }`                                                                                                                                                                        |
| POST `/orders/:id/shipments`                       | `{ carrier: "jt" or "flash" or "manual", trackingNo, codAmount, notes? }`                                                                                       | Shipment                                                                                                                                                                                   | `orders.shipment.create`        | `Shipments.jsx:116` → `mock:459`         |
| POST `/shipments/:id/status`                       | `{ status: "delivered" or "returned" or "cancelled" }`                                                                                                          | Shipment                                                                                                                                                                                   | `orders.shipment.status.update` | `Shipments.jsx:30` → `mock:476`          |
| GET `/production/orders`                           | `status: "1" or "5"`, `search`, `page`                                                                                                                          | `{ orders[{ id, status, order_time, full_name, product_name, item_count, group_name, colors[{ name, hex }], song }], counts{ deposited, production }, total, per_page: 24 }`, oldest first | `designer.view`                 | `Designer.jsx:32` → `mock:489`           |
| GET `/production/orders/:id`                       | none                                                                                                                                                            | `{ order{ id, status, order_time, full_name, phone, product_name, group_name, date, addr, song, notes }, items[Card], notes[Note] }`                                                       | `designer.view`                 | `Designer.jsx:153` → `mock:528`          |
| POST `/production/orders/:id/status`               | `{ reason? }` (UI sends `{}`)                                                                                                                                   | `{ id, status: 5 }`; only 1 to 5                                                                                                                                                           | `designer.view`                 | `Designer.jsx:157` → `mock:549`          |

`OrderRow`: `id, order_time, full_name, phone, city, product_name, item_count, status, shipping_id, price, discount_amount, shipping_fee, grand_total, total_deposit`.

### 7.4 Finance

Shared filters on every report: `from?`, `to?` (`YYYY-MM-DD`, inclusive), `status?`, `productId?`, `cityId?`. All require `finance.view`. Handler: `mock:571`, calculators in `reports.js`.

| GET path             | Extra                                 | Response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/finance/overview`  | `granularity: day, week, month, year` | `options{ cities[{id,name}], products[{id,name}] }`, `summary{ orders{ gross_revenue, net_revenue, total_orders, cancelled_orders, paid_orders, pending_orders, deposited_orders, total_discounts, outstanding, pending_revenue }, ledger{ refunds, refund_count }, shipping{ shipping_charged }, derived{ aov, cost_configured, gross_profit, net_profit } }`, `series[{ period, orders, gross, net, discounts }]`, `alerts[{ level, title, detail }]`, `breakdowns{ by_product[{name,net}], by_city[{name,net}], by_status[{status,orders}] }` |
| `/finance/products`  | none                                  | `performance[{ id, name, orders, cards, net, avg_net, profit or null }]`, `never_sold[{ id, name, is_active }]`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/finance/customers` | none                                  | `aggregates{ customers, returning, one_time, repeat_rate, avg_spend }`, `top[{ full_name, phone, orders, lifetime_net, avg_order, last_order }]` (20)                                                                                                                                                                                                                                                                                                                                                                                            |
| `/finance/payments`  | none                                  | `deposits{ total, n }`, `carriers[{ carrier, shipments, delivered, returned, cancelled, in_transit, cod_collected, cod_pending }]`                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/finance/discounts` | none                                  | `totals{ orders, couponed_orders, discount_total, avg_discount }`, `per_coupon[{ coupon, uses, discount_total, net }]`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/finance/shipping`  | none                                  | `totals{ fee_charged, shipments, avg_fee }`, `by_region[{ name, order_count, shipments, delivered, returned, cod_collected }]`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/finance/refunds`   | none                                  | `totals{ total, n }`, `trend[{ period, total }]`, `recent[{ id, order_id, value, created_at, description, product_name }]` (20)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/finance/profit`    | none                                  | `cost_configured, net_revenue, cogs, units_missing_cost, gross_profit, expenses, refunds, net_profit, trend[{ period, net, cogs, expenses, refunds }], costs[{ id, name, unit_cost or null }]`                                                                                                                                                                                                                                                                                                                                                   |
| `/finance/cashflow`  | none                                  | `categories{ expense[string], income[string] }, opening_balance, months[{ period, money_in, money_out, running_balance }], entries[LedgerEntry]` (30)                                                                                                                                                                                                                                                                                                                                                                                                                                           |

| Method and path                  | Request                                                                                   | Response                                                                                                                                               | Permission             | Source                            |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------- |
| GET `/finance/orders`            | filters + `search?`, `sort: id, order_time, net, paid, balance`, `dir`, `page`, `perPage` | `{ rows[{ id, order_time, full_name, product_name, city, status, price, discount_amount, net, dep, balance, payment_status }], page, perPage, total }` | `finance.view`         | `OrdersTab.jsx:32` → `mock:563`   |
| GET `/finance/orders?format=csv` | same, no paging; sends `Accept: text/csv`                                                 | CSV of all matching rows; must be formula-safe                                                                                                         | `finance.view`         | `OrdersTab.jsx:40` → `mock:563`   |
| POST `/finance/costs`            | `{ productId, unitCost }`                                                                 | `{ productId, unitCost }`                                                                                                                              | `finance.costs.manage` | `ProfitTab.jsx:21` → `mock:577`   |
| POST `/finance/entries`          | `{ type: "expense" or "income", category (must be in that type's list, else 422), value, description, orderId? }`                           | LedgerEntry                                                                                                                                            | `finance.entry.add`    | `CashflowTab.jsx:28` → `mock:583` |

### 7.5 Catalog, customers, staff, themes and settings

| Method and path                         | Request                                                                                                  | Response                                                                           | Permission                | Source                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| GET `/products`                         | none, unpaginated                                                                                        | Product[]                                                                          | `products.view`           | `products/index.jsx:22` → `mock:603`                       |
| GET `/products/:id`                     | none                                                                                                     | Product                                                                            | `products.view`           | `ProductModal.jsx:50` → `mock:642`                         |
| POST `/products`                        | `{ typeCode: "CARD", slug, name, description, isNew, inStock, isLimited, quantity }`                     | Product                                                                            | `catalog.products.add`    | `ProductModal.jsx:103` → `mock:653`                        |
| PATCH `/products/:id`                   | `{ name, description, isNew, inStock, isLimited, quantity }`                                             | Product                                                                            | `catalog.products.update` | `ProductModal.jsx:88` → `mock:680`                         |
| POST `/products/:id/toggle`             | `{ isActive }`                                                                                           | Product                                                                            | `catalog.products.update` | `ProductModal.jsx:99` → `mock:694`                         |
| POST `/products/:id/colors`             | `{ name, hex }`                                                                                          | Color                                                                              | `catalog.products.update` | `editors.jsx:87` → `mock:700`                              |
| DELETE `/products/colors/:id`           | none                                                                                                     | `{ deleted: true }`, also removes its images                                       | `catalog.products.update` | `editors.jsx:98` → `mock:605`                              |
| POST `/products/:id/images/upload`      | multipart: `file`, `colorId?`, `kind: gallery, face, back`, `sortOrder`                                  | ProductImage; replaces the same slot                                               | `catalog.products.update` | `editors.jsx:30`, `:208` → `mock:706`                      |
| DELETE `/products/images/:id`           | none                                                                                                     | `{ deleted: true }`                                                                | `catalog.products.update` | `editors.jsx:39`, `:218` → `mock:618`                      |
| POST `/products/:id/card-price-tiers`   | `{ cardsCount, price, discountPercentage?, currencyCode: "EGP" }`                                        | Tier; replaces the same count                                                      | `catalog.prices.update`   | `editors.jsx:274` → `mock:727`                             |
| DELETE `/products/card-price-tiers/:id` | none                                                                                                     | `{ deleted: true }`                                                                | `catalog.prices.update`   | `editors.jsx:292` → `mock:630`                             |
| GET `/coupons`                          | none                                                                                                     | Coupon[]                                                                           | `coupons.view`            | `Coupons.jsx:38` → `mock:759`                              |
| POST `/coupons`                         | `{ coupon, type: percentage or fixed, value, expiryDate, minOrderAmount?, maxUses?, perCustomerLimit? }` | Coupon; 409 if the code exists                                                     | `coupons.manage`          | `Coupons.jsx:206` → `mock:761`                             |
| PATCH `/coupons/:id`                    | same, without `coupon`                                                                                   | Coupon                                                                             | `coupons.manage`          | `Coupons.jsx:219` → `mock:774`                             |
| POST `/coupons/:id/toggle`              | `{ isActive }`                                                                                           | Coupon                                                                             | `coupons.manage`          | `Coupons.jsx:43` → `mock:778`                              |
| DELETE `/coupons/:id`                   | none                                                                                                     | `{ deleted: true }`; 409 if used                                                   | `coupons.manage`          | `Coupons.jsx:53` → `mock:784`                              |
| POST `/customers`                       | `{ username, password, name?, friendsCount }`                                                            | `{ username, userId, link }`                                                       | `profiles.create`         | `Customers.jsx:42` → `mock:814`                            |
| GET `/customers/lookup`                 | `username`                                                                                               | `{ found: false }` or `{ found: true, userId, link or null, themes[ThemeStatus] }` | see D10                   | `Customers.jsx:156`, `:232`, `Themes.jsx:304` → `mock:801` |
| POST `/customers/:id/password-reset`    | `{ newPassword }`                                                                                        | `{ reset: true }`                                                                  | `users.password.reset`    | `Customers.jsx:158` → `mock:832`                           |
| GET `/roles`                            | none                                                                                                     | `{ roles[Role + userCount], permissionCatalog[{ code, description }] }`            | `roles.manage`; see D10   | `Roles.jsx:24`, `Team.jsx:62` → `mock:853`                 |
| POST `/roles`                           | `{ code, name, description?, permissionCodes[] }`                                                        | Role                                                                               | `roles.manage`            | `Roles.jsx:143` → `mock:861`                               |
| PATCH `/roles/:id`                      | same, without `code`                                                                                     | Role; 403 on system role                                                           | `roles.manage`            | `Roles.jsx:140` → `mock:876`                               |
| DELETE `/roles/:id`                     | none                                                                                                     | `{ deleted: true }`; 403 system, 409 assigned                                      | `roles.manage`            | `Roles.jsx:29` → `mock:884`                                |
| GET `/team`                             | none                                                                                                     | `[PublicAdmin + isBlocked]`                                                        | `team.manage`             | `Team.jsx:60` → `mock:894`                                 |
| POST `/team`                            | `{ username, password, email, roleCode }`                                                                | PublicAdmin + isBlocked                                                            | `team.manage`             | `Team.jsx:191` → `mock:896`                                |
| POST `/team/:id/toggle`                 | `{ isBlocked }`                                                                                          | same; 422 on self                                                                  | `team.manage`             | `Team.jsx:67` → `mock:913`                                 |
| POST `/team/:id/role`                   | `{ roleCode }`                                                                                           | same; **no UI yet**                                                                | `team.manage`             | `api.js:319` → `mock:921`                                  |
| GET `/activity`                         | `adminId?`, `page`                                                                                       | `{ rows[Activity + adminUsername, adminDisplayName], total }`, 30 per page         | D10                       | `Team.jsx:330`, `:357` → `mock:927`                        |
| GET `/themes`                           | none                                                                                                     | `{ custom[CustomTheme + owners], site[SiteTheme] }`                                | `themes.view`             | `Themes.jsx:41` → `mock:948`                               |
| POST `/themes/custom`                   | `{ id?, theme, bgColor, previewLink, price, isNew, isActive }`; `id` means update                        | CustomTheme                                                                        | `catalog.themes.manage`   | `Themes.jsx:75` → `mock:956`                               |
| POST `/themes/custom/:id/toggle`        | `{ isActive }`                                                                                           | CustomTheme                                                                        | `catalog.themes.manage`   | `Themes.jsx:94` → `mock:972`                               |
| POST `/themes/assign`                   | `{ profileId or username, themeId, action: assign or remove }`                                           | `{ themes[ThemeStatus] }`                                                          | `profiles.themes.add`     | `ThemeChips.jsx:16` → `mock:978`                           |
| POST `/themes/site`                     | `{ name, displayName, bgColor, textColor, accentColor }`                                                 | SiteTheme                                                                          | `catalog.themes.manage`   | `Themes.jsx:396` → `mock:986`                              |
| POST `/themes/site/:id/toggle`          | `{ isActive }`                                                                                           | SiteTheme                                                                          | `catalog.themes.manage`   | `Themes.jsx:482` → `mock:1002`                             |
| DELETE `/themes/site/:id`               | none                                                                                                     | `{ deleted: true }`                                                                | `catalog.themes.manage`   | `Themes.jsx:391` → `mock:1008`                             |
| GET `/settings/me`                      | none                                                                                                     | `{ user: SettingsUser }`                                                           | signed in                 | `Settings.jsx:14` → `mock:1032`                            |
| GET `/settings/sessions`                | none                                                                                                     | `{ sessions[Session] }`                                                            | signed in                 | `Settings.jsx:15` → `mock:1034`                            |
| POST `/settings/sessions/:id/revoke`    | `{}`                                                                                                     | `{ revoked: true }`                                                                | signed in, owner          | `Settings.jsx:58` → `mock:1036`                            |
| POST `/settings/profile`                | `{ displayName }`                                                                                        | `{ user }`                                                                         | signed in                 | `Settings.jsx:122` → `mock:1043`                           |
| POST `/settings/password`               | `{ currentPassword, newPassword }`                                                                       | `{ changed: true }`                                                                | signed in                 | `Settings.jsx:178` → `mock:1049`                           |
| POST `/settings/email/request`          | `{ newEmail, currentPassword }`                                                                          | `{ sent: true }`                                                                   | signed in                 | `Settings.jsx:258` → `mock:1051`                           |
| POST `/settings/email/confirm`          | `{ newEmail, code }` (6 digits; the UI says 10 minutes)                                                  | `{ user }`                                                                         | signed in                 | `Settings.jsx:268` → `mock:1054`                           |

**Implied by the UI but not called yet (all inferred):**

| Need                | Proposed endpoint                                                          | Why                                                         |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Refund              | POST `/orders/:id/refunds` `{ amount, reason }`                            | GAP-1                                                       |
| Payment status      | Derived from payments and refunds, with an audited override only if needed | `pages/finance/OrdersTab.jsx:160`; the status has no setter |
| Atomic contact edit | PATCH `/orders/:id/contact` `{ shipPhone, shipAddress, cityId, zoneId }`   | GAP-7                                                       |
| Cost history        | Add `effectiveFrom`, or snapshot on the order                              | GAP-26                                                      |
| Courier booking     | Paths unknown                                                              | GAP-3                                                       |

### 7.6 Data models and relations

| Model                     | Fields                                                                                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin                     | `id` (string), `username`, `email`, `displayName`, `role` (role code), `isBlocked`; `/auth/me` adds `roleName`, `permissions[]`                                                                                                                           |
| Role                      | `id`, `code`, `name`, `description`, `isSystem`, `permissions[]`                                                                                                                                                                                          |
| City, Zone                | City `{ id, name, zones[] }`; Zone `{ id, name, shippingFee }`                                                                                                                                                                                            |
| Product                   | `id, name, slug, description, product_types{ code: CARD or KEYCHAIN, name }, is_active, in_stock, is_new, is_limited, quantity, unit_cost, colors[], product_images[], card_price_tiers[]`                                                                |
| Color, ProductImage, Tier | `{ id, name, hex }`; `{ id, image_url, kind: gallery, face, back, color_id, sort_order }`; `{ id, cards_count, price, discount_percentage }`                                                                                                              |
| Coupon                    | `id, coupon, type, value, expiry_date, min_order_amount, max_uses, per_customer_limit, is_active`                                                                                                                                                         |
| Order                     | `id, order_time, status, payment_override, full_name, phone, address, city_id, zone_id, lines[OrderLine], coupon, discount_amount, shipping_fee, shipping_id, production_notes[], subtotal, grand_total`                                                  |
| OrderLine                 | `id, product_id, price (the whole item, from the tier for its count), extras[], group_name, date, addr, song, notes, items[Card]`; the API adds `product_name` and `kind: card or keychain`                                                               |
| Profile                   | `id, pid, order_id, line_id, theme_ids[], created_at`; the API returns `{ id, pid, line_id, themes[], items[NfcItem] }`                                                                                                                                   |
| NfcItem                   | Stored: `id, code, profile_id, card_id (null for an extra), label, status: active or blocked, owner_user_id, connected_at, created_at`. API: `{ id, label, kind, is_extra, link, status, owner{ id, username, name } or null, connected_at, created_at }` |
| Card, Extra, Note         | `{ id, name, color, color_hex, full_image_url }`; `{ id, extra_name, extra_price }`; `{ id, edits, created_at, images[{ image_url }] }`, and the API adds the first `image_url`                                                                           |
| Shipment                  | `id, order_id, carrier, tracking_no, cod_amount, status: active, delivered, returned, cancelled, notes, created_at`                                                                                                                                       |
| LedgerEntry, Refund       | `{ id, type: deposit, income, expense, category, order_id, value, description, created_at }` (deposits are always category "Order deposit"); `{ id, order_id, value, description, created_at }`                                                                                                                    |
| Customer                  | `id, username, name, friends_count, is_blocked, pid, theme_ids[], created_at`                                                                                                                                                                             |
| CustomTheme, SiteTheme    | `{ id, theme, bg_color, price, is_new, is_active, preview_link }`; `{ id, name, display_name, bg_color, text_color, accent_color, is_active }`                                                                                                            |
| ThemeStatus               | `{ theme_id, theme, status: owned or available }`                                                                                                                                                                                                         |
| Activity, Session         | `{ id, adminId, action, entityType, entityId, details?, ipAddress, createdAt }`; `{ id, ip, user_agent, created_at, last_seen_at, current }`                                                                                                              |
| SettingsUser              | `id, username, email, display_name, phone_number, admin_roles{ code, name }`                                                                                                                                                                              |

**`OrderDetail`:** `order` (identity, status, coupon, customer, city, zone, `product_name`), `lines[OrderLine]`, `deposits[{ id, value, created_at }]`, `financial{ gross, discount, shipping, net_total, remaining }`, `shipments[]`, `notes[]`, `edit_products[{ id, name, colors, prices[{ friends_count, price }] }]`, `edit_extras[{ extra_name, extra_price }]` (the shop's add-on list), `profiles[Profile]`.

**Relations:** Staff to Role by code; Role to permission codes; Product to Color, Image and Tier; Image optionally to Color; Order to OrderLine, City and Zone; OrderLine to Product and Card; OrderLine to one Profile; Profile to NfcItem; NfcItem to Card and optionally to Customer; Shipment, LedgerEntry and Refund to Order; Customer and Profile to CustomTheme; Activity to Staff; Session to Staff (**inferred**: the mock has no owner field, a backend must). Orders have no customer ID, and finance groups customers by phone.

**Must become server-authoritative:** subtotal and grand total, paid and remaining, discount eligibility, zone shipping, stock, order transitions, shipment and COD settlement, COGS and profit, cash balances, all report figures. Display-only maths can stay in the client: formatting, chart zero-filling, percentage deltas, price suggestions.

### 7.7 File uploads

| Control                     | Types accepted                 | Today     | Endpoint                                           |
| --------------------------- | ------------------------------ | --------- | -------------------------------------------------- |
| Production note attachments | PNG, JPEG, WebP, GIF; multiple | No limits | POST `/orders/:id/notes`                           |
| Product cover               | PNG, JPEG, WebP, GIF           | No limits | POST `/products/:id/images/upload`, `kind=gallery` |
| Colour front and back       | PNG, JPEG, WebP                | No limits | Same, `colorId`, `kind=face or back`               |

Server requirements: authenticate and authorize; verify actual bytes, not the `accept` list or the filename; set byte, count and pixel-dimension limits (proposed, **inferred**: 10 MB per file, 10 files per note); re-encode images to strip payloads and metadata; generate random storage names; serve from a separate media origin or with `Content-Disposition` and `X-Content-Type-Options: nosniff`; generate thumbnails; delete replaced files. Note attachments may contain customer data, so they need access control.

### 7.8 Roles and permissions

The 30 codes are in `lib/permissions.js:7-85`, which is the source of truth. The gates are in [2.4](#24-routes-and-guards) and [4.3](#43-checks-the-backend-must-enforce). Seeded example roles (`lib/mock/db.js:85`, not fixed policy): SUPER_ADMIN, OPERATIONS_MANAGER, ORDER_AGENT, FINANCE_MANAGER, PRODUCTION_STAFF, CATALOG_MANAGER, SUPPORT_AGENT, CARD_PROVISIONER, MARKETING.

**Actions with no permission of their own:** CSV export and print (`finance.view`), move to production (`designer.view`), and all customer and money fields on an order (`orders.view`).

### 7.9 Decisions to make before building

Each has a recommendation, so work can proceed unless you disagree.

| ID  | Decision                                 | Recommendation                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Order status rules                       | Allow 0→1, 1→5, 5→2, 2→4, and any non-final status→3. Other moves need a privileged override with a required reason. (Inferred from the workflow order.)                                                                                                                                                                                                        |
| D2  | Refunds and payment status               | Refunds are ledger entries. Payment status is derived from the ledger. Remove the manual override unless it is proven necessary.                                                                                                                                                                                                                                |
| D3  | Changing zone on an order                | Re-quote from the new zone, show the new fee before saving, and store it on the order. Never recalculate old orders silently.                                                                                                                                                                                                                                   |
| D4  | Cost history                             | Effective-dated cost, with the cost snapshotted on each order at creation.                                                                                                                                                                                                                                                                                      |
| D5  | Filters on ledger values                 | Order-linked entries follow the filters. Unlinked overhead is shown separately and labelled.                                                                                                                                                                                                                                                                    |
| D6  | Money format                             | Store as decimal on the server. Send JSON numbers to two places, which needs no UI change.                                                                                                                                                                                                                                                                      |
| D7  | Timezone for date filters                | Fixed `Africa/Cairo` business day on the server. The mock uses browser-local time. (Inferred from EGP and the `+20` phone default.)                                                                                                                                                                                                                             |
| D8  | Field naming                             | Freeze the current names for v1 to avoid UI churn. Document them, and clean up in a v2 if wanted.                                                                                                                                                                                                                                                               |
| D9  | Contact edit                             | One atomic endpoint (7.5). Retire the two PATCHes.                                                                                                                                                                                                                                                                                                              |
| D10 | Mismatched permissions                   | Add a minimal role-options read for `team.manage`. Allow lookup for `users.view`, `users.password.reset` or `profiles.themes.add`, returning only the fields each needs. Make activity `team.manage`. Geo is for any signed-in staff.                                                                                                                           |
| D11 | Creating staff accounts                  | Invite link with a single-use expiring token, replacing admin-typed passwords.                                                                                                                                                                                                                                                                                  |
| D12 | Deployment shape                         | Serve the API on the same origin as the app, for example `admin.zoser.shop/api`, so the current client works unchanged.                                                                                                                                                                                                                                         |
| D13 | Link domain                              | **Decide before the first chip is programmed: links are written into the items, so they cannot change afterwards.** Use a permanent short domain the business owns, ending in `/i/<code>`. The mock uses the placeholder `zoser.example`.                                                                                                                       |
| D14 | When an item can be connected            | Only after its order has shipped. Otherwise anyone who sees a link early can take the item first. Neither the mock nor ZSRApp enforces this yet.                                                                                                                                                                                                                |
| D15 | Someone else scans a connected item      | Ask them to sign in, then say it is already connected and show nothing about the owner. This is what ZSRApp does now. A public profile page would be a different product decision.                                                                                                                                                                              |
| D16 | When an account leaves a profile         | An account belongs to a shared profile while it has at least one connected item in it. Disconnecting or deleting its last item removes it. Blocking only stops that link, so the customer can still sign in.                                                                                                                                                    |
| D17 | Custom cards from the Customers page     | Unchanged for now: one account and one profile link, with no per-item control. Move them to the same model if custom cards need blocking or per-item links.                                                                                                                                                                                                     |
| D18 | Coupons on mixed orders                  | Split the discount across order items by value, as the mock now does for product reports. Shipping stays on the order. Profit filtered by one product still counts whole orders that contain it.                                                                                                                                                                |
| D19 | Editing money after a coupon or shipment | Decide whether a percentage coupon recalculates when a price or add-on changes, and what happens to the COD amount of a shipment already out. Today the discount and the COD stay as they were, so the COD can end up different from the balance. Recommend recalculating percentage coupons and warning staff when an active shipment's COD no longer matches. |

### 7.10 Order items and NFC links

**Model.** An order holds order items, matching the shop's cart lines. Each has its own product, count, price, add-ons and customization. "Create profile & get link" makes one shared profile per order item and one link per physical item, so 4 cards in one item give 1 profile and 4 links, and 2 cards plus 2 keychains as two items give 2 profiles and 4 links. No customer account is created by staff any more, and the temporary password is gone.

| Item state                           | Staff see                         | A scan does                                                        |
| ------------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| Active, nobody connected             | Not connected                     | Sign in or create an account, then one tap on "Connect it"         |
| Active, connected to this account    | Connected, with username and date | Opens the app                                                      |
| Active, connected to another account | Connected                         | "Already connected", with an option to use another account         |
| Blocked                              | Blocked                           | "This item is blocked", with no sign-in needed. The owner is kept. |
| Deleted, or an old replaced code     | Gone from the list                | "This link doesn't work"                                           |

**Staff actions, each per item:** Block and Unblock; Disconnect (the next scan can connect it); Replace link (the old code dies, the item and owner stay, and the item must be reprogrammed); Delete (permanent); Add item (one more link in the same profile, with no effect on price, cost or production). All need `profiles.items.manage`. Creating links needs `profiles.create`.

**Customer API, which ZSRApp needs from the backend** (**inferred** from `ZSRApp/src/lib/items.js`, the stand-in to replace):

| Endpoint                    | Request            | Response                                                                     |
| --------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| GET `/items/:code`          | Session optional   | `{ status: free, mine, taken or blocked }`; 404 for unknown or deleted codes |
| POST `/items/:code/connect` | Signed-in customer | `{ status: mine, profile }`; 409 if another account got there first          |

**The backend must:** generate codes with a secure random source, at least as long as the mock's 12 characters; keep deleted and replaced codes so they are never reused; make connect atomic; and rate-limit lookups so codes cannot be guessed.

**Today's limits.** The two apps share no data until a backend exists. A connection made in ZSRApp stays on that phone and does not appear in the dashboard, and ZSRApp treats any unknown code as a free item. Sample codes for trying the other screens: `/i/demo-blocked`, `/i/demo-deleted`, `/i/demo-taken`.

## 8. PWA plan

### 8.1 Current state

None of this exists yet: no manifest, service worker, install prompt, or update flow. A square brand mark exists in `public/images/favicon.svg` (100×100 viewBox). `public/images/logo.svg` is the horizontal wordmark and does not suit icons. `index.html:9` fixes `theme-color` at `#0f1115`, which matches neither theme's page colour.

### 8.2 Manifest and icons

```json
{
  "id": "/",
  "name": "Zoser Admin",
  "short_name": "Zoser",
  "description": "Zoser staff dashboard for orders, production, shipping and finance.",
  "lang": "en",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#faecdf",
  "theme_color": "#faecdf",
  "icons": [
    { "src": "/images/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/images/pwa-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/images/pwa-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

All icon files are new. Generate them from `favicon.svg`, using a safe-zone margin on the maskable versions, plus a 180×180 `apple-touch-icon`. Replace the single `theme-color` with two media-specific tags (`#faecdf` light, `#0d0d0d` dark, from `styles/tokens.css`).

### 8.3 Service worker

Use **`vite-plugin-pwa` 2.x** (its peer range includes Vite 7, checked against the npm registry) in **`generateSW`** mode with `registerType: "prompt"`.

The audit suggested a hand-written worker (`injectManifest`). `generateSW` is the better starting point here. The app needs only precaching and a navigation fallback, and with no `runtimeCaching` rules the worker never touches API traffic, which makes "no authenticated caching" the default rather than something to maintain. Switch to `injectManifest` only if custom logic becomes necessary.

Starting configuration:

- `globPatterns`: JS, CSS, HTML, SVG, PNG.
- `navigateFallback: "/index.html"`, with `navigateFallbackDenylist: [/^\/api\//, /^\/media\//]`.
- No `runtimeCaching` entries.
- `cleanupOutdatedCaches: true`.
- Disabled for mock builds, so a demo cannot be cached in place of the real app.
- `usePrefetchPages` (`App.jsx:89-99`) becomes redundant once chunks are precached, and should be removed then.

### 8.4 Install and update flow

**Install:** capture `beforeinstallprompt` and offer "Install app" in Settings, only after a user gesture, and hide it once installed. iOS needs short manual instructions. No banners, and never during login or a money action.

**Update:**

1. When a new worker is waiting, show a non-blocking "New version available, Update" message.
2. Do not auto-activate with `skipWaiting` while a form is dirty or a write is running.
3. On Update, activate and reload once.
4. Keep the previous release's hashed assets on the server for at least one release, so open tabs can still load their chunks.
5. Add the error boundary from GAP-18, and handle `vite:preloadError` with one guarded reload per release, so a persistent failure cannot loop.
6. Never replay deposits, ledger entries, shipments or uploads because of an update or chunk failure.

### 8.5 Offline: what is honest today

- **A normal build cannot work offline in any useful way.** A cached shell can open, but sign-in and every screen need the server. Show a clear "You're offline" state instead of an endless spinner.
- A mock build could run offline if precached, but its writes vanish on reload, and it is demo-only. That is why the worker is disabled for it.
- Offline writes are out of scope. Queuing money or status changes would need idempotency, conflict handling and expiry, which is not justified for this dashboard.

### 8.6 Hosting rules

| Resource                        | Rule                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html`, `sw.js`, manifest | `Cache-Control: no-cache`                                                                                                                                                                                          |
| Hashed JS and CSS               | `Cache-Control: public, max-age=31536000, immutable`; keep old versions for one release                                                                                                                            |
| Navigation                      | Rewrite to `index.html`, **excluding `/api` and `/media`** (GAP-19, GAP-46)                                                                                                                                        |
| Security headers                | CSP (hash the inline theme script in `index.html`; allow inline styles or refactor them), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS once on HTTPS |

### 8.7 Caching rules once the backend exists

| Resource                                  | Rule                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App shell                                 | Precached; network updates through the prompt flow                                                                            |
| Hashed assets                             | Precached and immutable                                                                                                       |
| Public catalog images                     | Only if needed: stale-while-revalidate, bounded, approved origins, versioned URLs, successful responses only                  |
| Private order photos and note attachments | **Network only.** Do not decide by file extension                                                                             |
| Public catalog data                       | Only explicitly public GETs, bounded. `/api/v1/admin/products` is an admin endpoint and is not public                         |
| **Authenticated API responses**           | **Network only, never cached by default.** Server sends `Cache-Control: no-store`, including CSV downloads and auth endpoints |
| Writes and uploads                        | Network only, no background replay                                                                                            |
| Errors, redirects, login responses        | Never cached                                                                                                                  |

**Logout and shared devices.** Cancel in-flight requests and block their late cache writes. Clear session memory, including the Finance cache, on logout and on 401. Broadcast logout to other tabs. Static shell caches may remain, since they contain no user data. Never treat cached permissions as authorization. Any user-specific cache added later must be purged before another user signs in.

## 9. Roadmap

Ordered so the riskiest and cheapest work comes first, and nothing depends on a later phase.

### Phase 0: Clean baseline (S, with one M)

| Work                                                                                            | Items          |
| ----------------------------------------------------------------------------------------------- | -------------- |
| Green format gate                                                                               | GAP-43         |
| Update dependencies; `npm audit fix` in `_frontend/`, no `--force`; Vite ≥ 7.3.7, Router 7.18.5 | SEC-9, SEC-10  |
| Dev server on loopback by default, with a separate LAN script                                   | SEC-9          |
| Remove tracked `.DS_Store`; fix stale comments; write a real README                             | GAP-42, GAP-45 |
| Choose the lockfile location; add CI for build, lint, format                                    | GAP-44         |

**Done when:** a clean clone builds in CI, all gates pass, and `npm audit` shows only accepted items.

### Phase 1: Harden the client (S and M, no backend needed)

| Work                                                                                                     | Items                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Set up Vitest; first tests on `request()`, `useApiData`, `useAction`, `csv.js`, permissions              | GAP-40                                            |
| Error boundary and chunk-failure recovery                                                                | GAP-18                                            |
| API layer: CSRF by method, store CSRF after login, envelope validation, shared retry for uploads and CSV | SEC-1, SEC-2, GAP-19                              |
| Session clarity: outage vs signed out, logout failure                                                    | GAP-25, SEC-11                                    |
| Honest loading, error and empty states                                                                   | GAP-16, GAP-17, GAP-20, GAP-21, GAP-22, GAP-23    |
| Validation: shared validators on modal forms, URL allowlist, file limits, masked passwords               | GAP-6, GAP-8, GAP-9, GAP-12, SEC-3, SEC-4, GAP-15 |
| Demo-build banner, and a CI check that release builds contain no mock                                    | SEC-6                                             |
| Quick accessibility fixes                                                                                | GAP-47, GAP-48, GAP-53, GAP-54                    |
| Small fixes                                                                                              | GAP-4, GAP-33, GAP-37                             |

**Done when:** a failed request or chunk never blanks the app, invalid values cannot be submitted from forms, and the core API layer has tests.

### Phase 2: Decide and freeze the contract (M, mostly decisions)

| Work                                                                                                                                           | Items                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Make decisions D1 to D19                                                                                                                       | [7.9](#79-decisions-to-make-before-building)            |
| Update the mock to match: transitions, atomic contact edit, repricing, cost history, ledger filters, refunds in cash flow, audit on all writes | GAP-7, GAP-10, GAP-11, GAP-14, GAP-26 to GAP-29, GAP-32 |
| Tests for totals, discounts, shipping and reports                                                                                              | GAP-40                                                  |
| Write the contract as OpenAPI, from section 7                                                                                                  | section 7                                               |

**Done when:** the mock implements the agreed rules, its tests pass, and the OpenAPI file is reviewed.

### Phase 3: Build the backend (L)

Suggested order, safest dependency first: auth, sessions and CSRF; roles and enforcement middleware; read endpoints; order mutations; uploads and media; finance reports; audit trail. Every item in [4.3](#43-checks-the-backend-must-enforce) needs a denial test. Run contract tests against the OpenAPI file.

**Done when:** every endpoint has authorization tests, and the audit log covers every privileged change.

Also build the customer API in [7.10](#710-order-items-and-nfc-links), then replace ZSRApp's `src/lib/items.js` stand-in with calls to it.

### Phase 4: Integrate and launch (M)

| Work                                                                                  | Items                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------- |
| Connect the real API, remove mock reliance in staging                                 | section 7                                    |
| Hosting: same origin, SPA rewrite, cache headers, CSP and security headers, `noindex` | GAP-46, SEC-8, SEC-12                        |
| Permission refresh, narrower lookups                                                  | GAP-36, GAP-38, GAP-39                       |
| Session-scoped Finance cache and request cancellation                                 | EFF-2, EFF-3, [4.2](#42-security-suspicions) |
| Role-based end-to-end smoke tests                                                     | GAP-40                                       |

**Done when:** staging passes role-based smoke tests, a deploy does not break open tabs, and no authenticated response is cached.

### Phase 5: PWA (S and M, needs Phase 1 recovery and Phase 4 hosting)

Manifest, icons and `theme-color`; `generateSW` with the deny-list; update prompt; install action; offline message; logout cleanup; remove idle prefetch. Follow [section 8](#8-pwa-plan).

**Done when:** the app installs, updates only on request, shows a clear offline state, and a DevTools check shows `/api` never served from Cache Storage.

### Phase 6: Workflow value (M and L, ongoing)

FUN-4 refunds, FUN-5 transitions UI, FUN-6 Design Studio, FUN-8 refresh, FUN-9 URL state, FUN-10 role change, FUN-11 exports, FUN-12 dirty-form warning, the remaining accessibility items (GAP-49, GAP-50, GAP-51, GAP-52, GAP-55), and EFF-1, EFF-4, EFF-5. Courier integration (GAP-3) only if the business wants it.

## 10. How this was verified

**Order items and NFC links (added after the audit).** Run in Chromium against both apps with the dummy data: a 2-card plus 2-keychain order produced 2 profiles and 4 different links; block, unblock, replace, add, delete and disconnect all worked; adding an item left the order total unchanged; order item totals matched the order subtotal on all 220 sample orders; Dashboard, Orders, Design Studio, Finance, Customers, Themes and Roles rendered; a phone-width order page had no sideways scroll. In ZSRApp, both sign-in and new-account paths returned to the scanned item and connected it, and each scan state showed the right screen. Lint and build pass in both apps. All `api.js` endpoints match the mock. ZSRApp's screenshot suite has the same result with and without this change: 43 failed, 27 passed, 2 skipped, so its baselines were already out of date. Real NFC hardware was not tested.

**Design images and add-ons (added after the audit).** Run in Chromium with the dummy data: replacing one card's picture left the other card's alone, a later save without changes kept it, a colour change moved only that card to the catalog picture, and Undo restored the old one. Editing, adding and removing add-ons moved the order subtotal by the right amount, and a duplicate name was refused. The form has no sideways scroll at phone width. Lint and build pass.

**Process.** Two read-only Codex audits produced the raw findings. Every critical and high finding was to be opened and checked by hand. Neither audit rated anything critical or high for today, so the findings that become high with a backend, and all medium findings, were checked instead. Those are marked `Confirmed` above.

**Result of the review.** No medium-or-above finding was wrong, so none were dropped. These were changed:

- SEC-9 was raised from low to medium because of the Vite advisories.
- GAP-18 was marked high at first deploy.
- The null-response crash (GAP-19) was promoted from suspicion to confirmed after tracing the code.
- Finance tab splitting was dropped as not worthwhile, based on measured size.
- The service worker recommendation changed from `injectManifest` to `generateSW`.
- A few line numbers were corrected.

**Added beyond the audits:** SEC-2, SEC-12, GAP-24, GAP-25, GAP-42 to GAP-46, GAP-53, the production-bundle checks, the dependency-audit attribution, the "PATCH means replace" and `/auth/me` contract rules, and the field-naming traps.

**Contract checks.**

- All 67 `api.js` endpoints at the audit commit matched the mock handlers one-to-one (75 after the order-item and add-on changes).
- The mock was run to capture real GET responses, and every field read by the pages exists in them.
- Request bodies were compared with the actual forms for orders, shipments, notes, products, tiers, coupons, customers and staff.
- None of the 913 file citations in the two audits named a missing file or a line past the end of its file. A few bare `index.jsx` references could not be tied to one file, so their line numbers were not checked.

**Not verified.** Nothing was run in a browser, so screen-reader behaviour, print output, touch behaviour and real network timing are untested. The white-screen behaviour in GAP-18 comes from reading the code and React's documented behaviour. Hosting, cookies, rate limits and every backend property are unknown because none exist. Findings marked `Unverified` were reported by the audit and have valid citations, but were not read independently.

**Safety.** No `.env` files, keys, credentials or customer data were opened. Build, lint, format and audit ran in a scratch copy, so this file is the only change to the repo.
