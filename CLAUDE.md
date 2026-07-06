# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js on port 3000)
npm run build    # Production build
npm run lint     # ESLint
```

Remotion (video asset pipeline):
```bash
npm run remotion        # Open Remotion Studio (interactive preview)
npm run render:video    # Render public/purify-process.mp4
npm run render:poster   # Render public/purify-process-poster.jpg
```

No test framework is configured. `scripts/` has a couple of plain-Node assertion scripts, run directly:

```bash
node scripts/loyalty.test.mjs
node scripts/reward-codes.test.mjs   # requires REWARD_CODE_SECRET in env
```

## Architecture

**Clear Flow** is an order-and-delivery management app for a purified water refill business in the Philippines. Customers place orders through a public storefront; the business owner manages orders, customers, and notifications through a password-protected admin panel.

### Stack

- **Next.js 16** (Pages Router) — JavaScript, no TypeScript
- **Neon Postgres** via `@neondatabase/serverless` (serverless HTTP driver, no ORM)
- **Tailwind CSS v4** with a custom "claymorphism" design system
- **Zod** for API input validation
- **Facebook Messenger API** for order notifications and webhook intake
- **Deployed on Vercel** (linked project: `nexusupers-projects/clear-flow`)

### Pages Router layout

- `pages/_app.js` — global fonts (Fredoka + Nunito), Facebook Pixel, Messenger floating button
- `pages/index.js` — public landing page
- `pages/order.js` — customer order form
- `pages/order/confirmation.js` — post-order confirmation
- `pages/track.js` — order tracking by phone
- `pages/rewards.js` — loyalty rewards lookup
- `pages/products.js` — product catalog
- `pages/admin/index.js` — admin panel entry (client-rendered via `next/dynamic`, no SSR), renders `components/AdminPanel.js` — orders, customers/CRM, inventory, and the POS counter-sale flow (`components/admin/POSPanel.js`) all live inside this one client component

### API routes (`pages/api/`)

Public routes follow: `initDb()` → rate limit → Zod validation → SQL. Admin routes use `await verifyAdminWithLockout(req, res)` (async, calls `initDb()` internally) instead of the bare `verifyAdmin` — the pattern differs slightly from public routes.

- `orders.js` — CRUD for orders (GET lists for admin, POST creates)
- `orders/[id].js` — single order read/update/delete
- `orders/[id]/apply-reward.js` — apply loyalty voucher to order
- `orders/bulk-delete.js` — batch delete delivered/cancelled orders
- `orders/pos.js` — create an in-person counter sale (POS), bypasses the public order rate limit
- `orders/route.js` — admin GET listing of all orders (despite the App-Router-style filename, this is a Pages Router route served at `/api/orders/route`)
- `customers/index.js` — paginated customer list with search/sort
- `customers/[phone].js` — single customer detail
- `customers/[phone]/notes/` — CRUD for customer notes
- `customers/[phone]/contact-log.js` — contact log entries
- `customers/[phone]/container-adjust.js` — manual adjustment of a customer's returnable-container balance
- `customers/[phone]/message.js` — send an ad-hoc Messenger message to a customer
- `customers/stats.js` — aggregate customer statistics
- `customers/reorders.js` — customers due/overdue for reorder, from `lib/reorder.js` cadence logic
- `customers/tags.js` — customer segment tags, from `lib/segments.js`
- `customers/export.js` — CSV export of customers
- `dashboard.js` — aggregate admin dashboard metrics
- `inventory/index.js` / `inventory/adjust.js` / `inventory/restock.js` — stock levels, manual adjustments, restocking
- `rewards.js` — loyalty balance lookup
- `rewards/send-code.js` / `rewards/verify-code.js` — OTP-based reward code flow
- `notify.js` / `messenger-notify.js` — order status notifications via Messenger
- `messenger-webhook.js` — Facebook webhook (signature verification, PSID capture)
- `fb-orders.js` — webhook intake for orders from ManyChat/Facebook

### Key libs (`lib/`)

- `db.js` — Neon connection singleton + `initDb()` which creates tables and runs migrations inline (no migration tool)
- `auth.js` — timing-safe admin password comparison (`verifyAdmin`) + `verifyAdminWithLockout(req, res)` which adds DB-backed IP lockout (5 failures → 15-min block, clears on success). Use `verifyAdminWithLockout` on all new admin routes.
- `loyalty.js` — pure loyalty math (gallon counting, voucher computation) — isomorphic, safe for client import
- `reward-codes.js` — server-only OTP generation and hashing
- `facebook.js` — Messenger Send API helpers + webhook signature verification
- `products.js` — product catalog constants and delivery fee schedule
- `rate-limit.js` — in-memory per-IP rate limiter
- `inventory.js` — builds the stock-deduction + inventory-log queries for an order sale, meant to run inside a `sql.transaction([...])` for atomicity
- `notifications.js` — per-order-status Messenger message templates, shared by manual and automatic notify flows
- `reorder.js` — pure, isomorphic reorder-cadence logic (needs ≥2 orders with timestamps to compute a customer's due/overdue status)
- `segments.js` — isomorphic customer segment definitions (new/regular/vip/at-risk/churned) used by both API and UI

### Design system

The UI uses a custom "claymorphism" (soft 3D) style defined in `styles/globals.css`:
- Color tokens: `clay-bg`, `clay-surface`, `clay-ink`, `clay-sky`, `clay-skydeep`, etc.
- Surface classes: `clay-raised`, `clay-raised-sm`, `clay-inset`
- Button classes: `clay-btn-primary`, `clay-btn-white`, `clay-pressable`
- Reusable components in `components/ui/`: `ClayButton`, `ClayCard`, `ClayIcon`

### Auth model

Admin endpoints are protected by `verifyAdmin(req)` which compares `req.headers['password']` against `ADMIN_PASSWORD` env var using timing-safe comparison. There are no user accounts or sessions — customers order as guests identified by phone number.

### Database

Schema is created and migrated via `initDb()` in `lib/db.js` (runs on first API call). Tables: `orders`, `reward_codes`, `customer_notes`, `contact_log`, `container_adjustments`, `inventory`, `inventory_log`, `auth_failures`. Phone numbers are normalized (digits only) and indexed as `phone_normalized`.

### Environment variables

See `.env.example` for all required vars. Key ones:
- `POSTGRES_URL` — Neon connection string
- `ADMIN_PASSWORD` — admin panel password
- `FB_PAGE_ACCESS_TOKEN` / `FB_VERIFY_TOKEN` / `FB_APP_SECRET` — Messenger integration
- `FB_WEBHOOK_SECRET` — ManyChat order intake webhook secret
- `NEXT_PUBLIC_FB_PIXEL_ID` / `NEXT_PUBLIC_FB_PAGE_ID` — client-side Facebook integration

### Remotion video assets

The purification process animation (`public/purify-process.mp4` + `public/purify-process-poster.jpg`) is rendered from `remotion/WaterRefillProcess.tsx` (registered in `remotion/Root.tsx`, entry `remotion/index.ts`; scene timings/colors/video dimensions live in `remotion/theme.ts`). Edit the composition there and re-run `npm run render:video` / `npm run render:poster` to update the assets.

This rendered asset is **not** currently wired into any page — `components/PurifyProcess.js` (used on the homepage) is a separate, pure CSS/SVG stage animation with no video. `components/VideoShowcase.js` is the component that renders a native `<video>`, but it points at `public/brand-video.mp4`, an unrelated asset. If you re-render the Remotion video and want it live on the site, you must manually point a `<video src>` (e.g. in `VideoShowcase.js`) at `/purify-process.mp4`.

`remotion-video/` (repo root, separate from `remotion/`) is an unrelated, unused default `create-video` scaffold — do not confuse it with the real pipeline above.

### Currency

All monetary values are in Philippine Pesos (₱ / PHP).
