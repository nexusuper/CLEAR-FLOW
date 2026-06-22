# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js on port 3000)
npm run build    # Production build
npm run lint     # ESLint
```

No test framework is configured.

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
- `pages/admin/index.js` — admin panel (client-rendered via `next/dynamic`, no SSR)

### API routes (`pages/api/`)

All API routes follow the same pattern: `initDb()` → rate limit check → admin auth check (where applicable) → Zod validation → raw SQL via Neon's tagged-template `sql` function.

- `orders.js` — CRUD for orders (GET lists for admin, POST creates)
- `orders/[id].js` — single order read/update/delete
- `orders/[id]/apply-reward.js` — apply loyalty voucher to order
- `orders/bulk-delete.js` — batch delete delivered/cancelled orders
- `customers/index.js` — paginated customer list with search/sort
- `customers/[phone].js` — single customer detail
- `customers/[phone]/notes/` — CRUD for customer notes
- `customers/[phone]/contact-log.js` — contact log entries
- `customers/stats.js` — aggregate customer statistics
- `rewards.js` — loyalty balance lookup
- `rewards/send-code.js` / `rewards/verify-code.js` — OTP-based reward code flow
- `notify.js` / `messenger-notify.js` — order status notifications via Messenger
- `messenger-webhook.js` — Facebook webhook (signature verification, PSID capture)
- `fb-orders.js` — webhook intake for orders from ManyChat/Facebook

### Key libs (`lib/`)

- `db.js` — Neon connection singleton + `initDb()` which creates tables and runs migrations inline (no migration tool)
- `auth.js` — timing-safe admin password comparison via `password` header
- `loyalty.js` — pure loyalty math (gallon counting, voucher computation) — isomorphic, safe for client import
- `reward-codes.js` — server-only OTP generation and hashing
- `facebook.js` — Messenger Send API helpers + webhook signature verification
- `products.js` — product catalog constants and delivery fee schedule
- `rate-limit.js` — in-memory per-IP rate limiter

### Design system

The UI uses a custom "claymorphism" (soft 3D) style defined in `styles/globals.css`:
- Color tokens: `clay-bg`, `clay-surface`, `clay-ink`, `clay-sky`, `clay-skydeep`, etc.
- Surface classes: `clay-raised`, `clay-raised-sm`, `clay-inset`
- Button classes: `clay-btn-primary`, `clay-btn-white`, `clay-pressable`
- Reusable components in `components/ui/`: `ClayButton`, `ClayCard`, `ClayIcon`

### Auth model

Admin endpoints are protected by `verifyAdmin(req)` which compares `req.headers['password']` against `ADMIN_PASSWORD` env var using timing-safe comparison. There are no user accounts or sessions — customers order as guests identified by phone number.

### Database

Schema is created and migrated via `initDb()` in `lib/db.js` (runs on first API call). Tables: `orders`, `reward_codes`, `customer_notes`, `contact_log`. Phone numbers are normalized (digits only) and indexed as `phone_normalized`.

### Environment variables

See `.env.example` for all required vars. Key ones:
- `POSTGRES_URL` — Neon connection string
- `ADMIN_PASSWORD` — admin panel password
- `FB_PAGE_ACCESS_TOKEN` / `FB_VERIFY_TOKEN` / `FB_APP_SECRET` — Messenger integration
- `FB_WEBHOOK_SECRET` — ManyChat order intake webhook secret
- `NEXT_PUBLIC_FB_PIXEL_ID` / `NEXT_PUBLIC_FB_PAGE_ID` — client-side Facebook integration

### Currency

All monetary values are in Philippine Pesos (₱ / PHP).
