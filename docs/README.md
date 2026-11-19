# ZOSER Admin Dashboard

The staff dashboard: orders, production, shipping, NFC links, the catalog, coupons, themes, finance reports, staff and roles.

This app is one of three. The [shop](../../ZOSER/docs/README.md) is where orders should come from, and the [profiles app](../../ZSRApp/docs/README.md) is what the NFC links created here open. How the three fit together, and what is missing between them, is in the [main README](../../README.md).

This file is the overview. [PLAN.md](PLAN.md) in this folder is the detailed audit: every finding with file and line, the full request and response shape of each endpoint, the data models, the security checklist, the PWA plan and a phased roadmap.

**State today:** connected to the [API](../../backend/docs/README.md) (`backend/`, `/api/v1/admin`). The dev server still answers from a dummy API (`src/lib/mock`: 220 sample orders, writes lost on reload) unless `VITE_MOCK_API=false`; production builds always use the API.

## Run it

```sh
npm install
npm run dev           # http://localhost:5173, dummy API on, reachable on the local network
npm run build         # dummy API and its images left out of the bundle
npm run preview
npm run lint
npm run format        # Prettier
npm run format:check
```

The dependencies are not installed in this folder at the moment (`node_modules` holds only Vite's cache) and there is no `package-lock.json`, so run `npm install` first.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_MOCK_API` | `true` in `npm run dev`, `false` in builds | `false`: talk to the API. `true`: the dummy API, signed in as the super admin with any password (typing a username from the Team page signs in as that staff member) |
| `VITE_API_URL` | empty | The API's address. Empty: this site's own `/api`, which the dev server proxies to `localhost:4000`. Production: `https://api.zoser.shop` |

With the API, sign in with the seeded admin (`backend/.env`'s `SEED_ADMIN_*`; development: `admin` / `zoser-dev-admin`). The dummy API only knows the older page shape for the new memory-pages actions: they show, but acting on people or items needs the API.

There are no tests here; the API's tests cover the endpoints.

## Packages

| Package | Version | Used for |
| --- | --- | --- |
| `react`, `react-dom` | 19.1 | UI |
| `react-router-dom` | 7.6 | `BrowserRouter`, permission-gated routes, lazy pages |
| `vite`, `@vitejs/plugin-react` | 7.0, 4.5 | Dev server and build. The other two apps are on Vite 8 and React Router 8. |
| `eslint` and plugins, `prettier` | 10, 3.9 | Lint and format |

There is no state library, chart library or icon library. Charts and icons are hand-written SVG.

## Pages

A route exists only if the signed-in role has its permission. Unknown or forbidden paths redirect to the first page the role may see.

| Route | Page | Permission | What staff do there |
| --- | --- | --- | --- |
| any, signed out | Login | none | Username and password |
| `/` | Dashboard | `dashboard.view` | Revenue, order counts, 30-day chart, status mix, recent orders, top zones |
| `/orders` | Orders | `orders.view` | Search by id, name or phone; filter by status; 25 per page |
| `/orders/:id` | Order detail | `orders.view` | Payment and deposits, one card per order item (design, add-ons, customization), production notes, status, the order's memory pages (people, items, fixes), shipments, customer contact |
| `/returns` | Returns | `orders.view` | Every parcel marked Returned, newest first: the order, who marked it and when, the parcel (carrier, tracking, COD), and whether the order has gone out again. The Dashboard shows the latest 5 |
| `/designer` | Design Studio | `designer.view` | Queues of orders to design and in production; move an order to production |
| `/customers` | Customers | `customers.view` | Every account (search, status), one opened (its pages and owned items, email a reset code, block), a password for old-system accounts with no email, and old-style shared accounts |
| `/themes` | Themes | `themes.view` | Custom profile themes, assigning them to customers, site themes |
| `/products` | Catalog | `products.view` | Designs, colours, front and back images, price tiers by count |
| `/coupons` | Coupons | `coupons.view` | Percentage or fixed, expiry, minimum order, usage caps |
| `/finance` | Finance | `finance.view` | Ten report tabs with shared filters, CSV export, unit costs, cash-flow entries |
| `/team` | Team | `team.manage` | Staff accounts and the activity feed |
| `/roles` | Roles | `roles.manage` | Roles and their permission checkboxes |
| `/settings` | Settings | signed in | Display name, password, email change by code, sessions |

The 32 permission codes are in `src/lib/permissions.js`, the source of truth for the Roles page; the API's seed (`backend/prisma/seed/reference.ts`) loads the same list. New: `nfc.provision`; `profiles.members.manage` became `profiles.participants.manage`.

## How it works

### Data flow

Pages never call `fetch`. They call a domain object from `src/lib/api.js` (`ordersApi.list(...)`) through one of two hooks:

- `useApiData` loads data and ignores a response that arrives after a newer request started.
- `useAction` runs a write, blocks a double submit, shows a toast and reloads.

`api.js` sends through Axios to `/api/v1/admin/*` with a bearer access token kept in memory, unwraps the `{ data }` envelope and shows `{ error: { message } }` to the user. The API keeps the sign-in in an HttpOnly refresh cookie: on a 401, one shared `POST /auth/refresh` (with the `X-ZSR-Client: admin` header) gets a new token and the request is tried again; when that fails, `zoser:unauthorized` sends the app to sign-in. A new visit refreshes first (`AuthProvider`). The dummy API plugs in as an Axios adapter.

Only the light or dark theme (`zoser-theme`) and the dummy API's signed-in username (`zoser-mock-user`) are in `localStorage`.

### Orders

An order holds **order items** shaped like the shop's cart lines. Each has a product, a count, a price taken from that product's tier for the count, add-ons, and customization (`group_name`, `date`, `addr`, `song`, `notes`), plus one entry per physical card or keychain with a name, colour and image.

`subtotal = Σ(item price + add-ons)` and `grand_total = subtotal + shipping_fee − discount_amount`. Shipping is priced per zone.

Status is a number, in workflow order: `0` Pending, `1` Deposited, `5` Production, `2` Shipped, `4` Shipped + Paid, `3` Cancelled. Staff move an order one step forward at a time, with a **Move to …** button on the order page (like the Design Studio's), and cancel it only while it's Pending or Deposited. The Super Admin has a dropdown to set any status; anything but those normal moves needs a reason, kept in the order's history. Recording the first deposit on a Pending order makes it Deposited. Production makes the chips' codes; Shipped opens claims; Cancelled turns off items nobody claimed.

### Memory pages and items

At checkout the shopper chooses which items open which **memory page**, and who each item is for. Each person is a place on the page, named at checkout, that waits until they tap their own item and say it's theirs; then it's theirs, and so is the item. Moving the order to Production makes one code per physical item (also "Make the codes now" on the order, `nfc.provision`). Claims open when it ships.

The order's "Memory pages" card shows each page and lets staff fix mistakes:

| Part | Shows | Staff can (permission) |
| --- | --- | --- |
| Page | Its names, type, state (Codes not made, Nobody in yet, Live, Closed, Merged), PIN, the claim log | Reopen a closed page; Clear a forgotten PIN; make a giver link for a gift whose recipient is in (`profiles.participants.manage`) |
| People | Each with their name on this page (and the name ordered), Joined (`@username`), Waiting, Signing up or Left, their items | Rename; put an account in their place (a wrong claim, after the right person asked); Unassign (the place waits for its person again); add a person; remove one with no item (`profiles.participants.manage`) |
| Each item | Whose it is, who claimed it, programmed or not, On or Off, opens by people in the page and by visitors, its link | Mark programmed (`nfc.provision`); turn off or on; move it to another person; Replace (a new code, same person and owner); add an item (`profiles.items.manage`) |
| Themes | The premium themes, owned or not | Give or take one (`profiles.themes.add`) |

The **Design Studio** has the **programming sheet**: every chip to write for the orders in production (who it's for, the link, the QR link), to download as CSV (safe in Excel), print, and tick off. The **Customers** page lists every account (search, status, pages, items), opens one (its pages and owned items), emails a reset code, and blocks an account. Products have a type (card, keychain, necklace, bracelet), an ordered gallery, and stock per colour.

### Dummy API

`src/lib/mock/index.js` has one handler for each of the original 81 endpoints (the newer ones, for memory pages, provisioning, the programming sheet, the customer directory and product galleries, are API-only). `db.js` builds the sample data from a fixed random seed, so the same orders come back on every reload. `shop-catalog.js` is a hand copy of the shop's `src/data`, with smaller copies of its images. `reports.js` computes the dashboard and finance figures. It does not enforce permissions.

## Structure

```
src/
  App.jsx, main.jsx   providers, permission-gated routes, lazy pages
  pages/              one file per page; finance/, order-detail/ and products/ have sub-components
  components/         Layout, ui (shared controls), charts, order, Icons, ThemeChips
  context/, hooks/    auth and toast contexts; useApiData, useAction
  lib/                api.js, permissions.js, csv.js, format.js, dates.js
  lib/mock/           the dummy API and its data
  styles/             tokens, base, layout, components, pages, utilities, print, responsive
docs/                 this file and PLAN.md
```

## Endpoints this app calls

All under `/api/v1/admin` ([backend README](../../backend/docs/README.md)); the original 81 keep the shapes in [PLAN.md section 7](PLAN.md#7-backend-contract). Changed or new:

| Area | Endpoints |
| --- | --- |
| Auth | POST `/auth/login` → `{ admin (with permissions), accessToken }` · POST `/auth/refresh` → `{ accessToken, admin }` (cookie and `X-ZSR-Client`) · GET `/auth/me` · POST `/auth/logout` |
| Returns | GET `/returns` (`search`, `page`, `limit`): returned shipments, with `returned_at`, `returned_by` and `reshipped`. Shipments now keep `status_at` and `status_by_id` |
| Orders | POST `/orders/:id/status` (`{ status, reason? }`: the reason is required for the Super Admin's non-standard moves) · POST `/orders/:id/provision` · GET, PUT `/orders/:id/groups` (before the codes are made) |
| Memory pages | GET `/profiles?search=` · GET `/profiles/:id` · POST `/profiles/:id/participants`, `/items`, `/reopen`, `/giver-link`, `/merge`, `/split` · DELETE `/profiles/:id/pin` · PATCH, DELETE `/participants/:id` · POST `/participants/:id/assign`, `/unassign` |
| Items | POST `/nfc-items/:id/status` (`active` or `off`), `/assign`, `/replace`, `/programmed` · GET `/nfc-items/:id/opens?days=` |
| Production | GET `/production/sheet` (`?format=csv` or `print`, `&orders=`) |
| Customers | GET `/customers`, `/customers/:id`, `/customers/lookup` · POST `/customers/:id/block`, `/customers/:id/send-reset` · POST `/customers/:id/password-reset` (old-system accounts with no email) · POST `/customers` (old-style account) |
| Products | GET `/product-types` · PATCH `/product-types/:code` · PATCH `/products/colors/:id` (stock) · PUT `/products/:id/gallery` · `typeCode` on create and edit |

Removed: `/orders/:id/profile`, `/profiles/:id/seats`, `/reset`, `/members/:userId`, `/nfc-items/:id/holder`, `/replace-link`, and deleting items (codes are never reused). Conventions kept: the envelopes, `GET /auth/me` answering 200 with `admin: null`, and "PATCH" meaning full replace on coupons, products and order designs.

### Endpoints the dashboard does not have yet

| Need | Proposed endpoint | Why |
| --- | --- | --- |
| Create an order by hand | POST `/orders` | Orders taken over Instagram or WhatsApp have no way in |
| Manage add-ons | GET, POST, PATCH, DELETE `/extras` | The shop's add-ons come from the seed |
| Manage cities, zones and fees | POST, PATCH, DELETE `/geo/cities`, `/geo/zones` | Shipping fees can be read but not edited |
| Newsletter subscribers | GET `/newsletter/subscribers` (and CSV) | The shop collects signups with nowhere to read them |
| Content moderation | GET `/profiles/:id/media`, DELETE `/profiles/:id/media/:mediaId` | Staff cannot see or remove what customers upload |
| Refunds | POST `/orders/:id/refunds` | PLAN.md GAP-1 |

## What is missing here

The dashboard's own gaps (55 of them, plus 12 security and 6 efficiency findings) are in [PLAN.md](PLAN.md). The ones below are about the other two apps and are explained in the [main README](../../README.md#gaps).

- **No "New order" here** for orders taken over Instagram or WhatsApp: orders come from the shop's checkout.
- **Merge and split have endpoints but no buttons** on the Memory pages card yet.
- **The dummy API is behind**: it shows the memory pages in the new shape, but acting on people, items, provisioning, the sheet, the customer directory or galleries needs the API.
- **Add-ons, zones and shipping fees cannot be edited.**
- **Site themes are used by neither of the other apps.**
- **Stale comments** in `vite.config.js` point at `_backend` and `_frontend`.
- **Uncommitted work:** none of this is committed.
