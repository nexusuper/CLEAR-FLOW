@AGENTS.md

# CLEAR-FLOW Codebase Guide

CLEAR-FLOW is a Next.js water delivery ordering system for a small business. Customers can browse products, place orders, and track delivery status. Admins manage orders and send notifications via a password-protected dashboard.

## Tech Stack

- **Framework:** Next.js 16.2.7 (Pages Router — NOT App Router)
- **React:** 19.2.4
- **Language:** JavaScript only (no TypeScript)
- **Styling:** Tailwind CSS v4 (PostCSS plugin)
- **Database:** Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **IDs:** `uuid` v14 for order ID generation
- **Linting:** ESLint v9 flat config

No ORM, no state management library, no component library, no test framework.

## Directory Structure

```
CLEAR-FLOW/
├── components/          # Shared React components
│   ├── Layout.js        # Page wrapper (Head, Navbar, Footer)
│   ├── Navbar.js        # Responsive navigation
│   ├── Footer.js        # Footer
│   └── AdminPanel.js    # Admin dashboard UI (~500 lines)
├── lib/
│   ├── db.js            # Neon DB client, table init, auto-migration
│   └── facebook.js      # Facebook Graph API helpers (Messenger)
├── pages/
│   ├── _app.js          # App wrapper: Facebook Pixel + Messenger chat init
│   ├── _document.js     # HTML document structure
│   ├── index.js         # Landing page
│   ├── products.js      # Product catalog and pricing
│   ├── order.js         # Order form (guest checkout)
│   ├── track.js         # Order tracking (polls by ID)
│   ├── order/
│   │   └── confirmation.js   # Post-order confirmation page
│   ├── admin/
│   │   └── index.js          # Admin dashboard (uses AdminPanel component)
│   └── api/
│       ├── hello.js           # Sample endpoint
│       ├── notify.js          # Generate SMS text snippet (admin)
│       ├── messenger-notify.js # Send Messenger message (admin)
│       ├── messenger-webhook.js # Facebook webhook (GET verify, POST receive)
│       └── orders/
│           ├── index.js       # GET all orders (admin) / POST create order
│           ├── [id].js        # GET single order / PATCH status / DELETE
│           └── bulk-delete.js # POST bulk delete (admin)
├── styles/
│   └── globals.css      # Tailwind import + base font
├── docs/
│   └── FACEBOOK_SETUP.md # Facebook integration setup guide
├── public/              # Static assets
├── .env.example         # Environment variable template
├── jsconfig.json        # Path alias: @/* → root
├── next.config.mjs      # reactStrictMode: true only
├── postcss.config.mjs   # Tailwind v4 PostCSS
└── eslint.config.mjs    # ESLint v9 flat config
```

## Database

### Connection (`lib/db.js`)

Uses Neon's serverless driver. `getDb()` lazily initializes the client from `POSTGRES_URL`. `initDb()` creates the `orders` table if it doesn't exist and runs auto-migrations (e.g., adds `messenger_psid` column if missing).

Always call `initDb()` at the start of each API route that uses the database.

### Schema

```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                -- 8-char uppercase UUID fragment
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  barangay TEXT NOT NULL,
  product_type TEXT NOT NULL,         -- "5-Gal Slim" | "5-Gal Round" | "3-Gal Round"
  container_size TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  need_container INTEGER,             -- 0 or 1 (boolean as int)
  container_quantity INTEGER DEFAULT 0,
  payment_method TEXT NOT NULL,       -- "cod" | "gcash"
  gcash_number TEXT,
  reference_number TEXT,
  notes TEXT,
  status TEXT,                        -- "pending"|"confirmed"|"out_for_delivery"|"delivered"|"cancelled"
  total_amount REAL NOT NULL,
  created_at TEXT NOT NULL,           -- ISO 8601 string
  messenger_psid TEXT                 -- Facebook Page-Scoped User ID
)
```

### Query Pattern

Direct parameterized SQL — no ORM:

```js
import { getDb, initDb } from '@/lib/db';

const sql = getDb();
await initDb();
const rows = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
```

## API Routes

All routes live under `pages/api/`. Authentication for admin routes uses a password sent as a JSON body field `{ password }` compared against `process.env.ADMIN_PASSWORD`.

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/orders` | GET | password | List all orders |
| `/api/orders` | POST | none | Create new order |
| `/api/orders/[id]` | GET | none | Get single order (public tracking) |
| `/api/orders/[id]` | PATCH | password | Update order status |
| `/api/orders/[id]` | DELETE | password | Delete single order |
| `/api/orders/bulk-delete` | POST | password | Delete multiple orders |
| `/api/notify` | POST | password | Return SMS notification text |
| `/api/messenger-notify` | POST | password | Send Messenger message to customer |
| `/api/messenger-webhook` | GET | token | Facebook webhook verification |
| `/api/messenger-webhook` | POST | none | Receive Messenger messages |

### Auth pattern in API routes

```js
if (req.body.password !== process.env.ADMIN_PASSWORD) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

## Business Logic

### Pricing

| Product | Price | Container |
|---------|-------|-----------|
| 5-Gal Slim | ₱30/unit | ₱150 |
| 5-Gal Round | ₱35/unit | ₱170 |
| 3-Gal Round | ₱20/unit | ₱100 |

**Delivery fees:** ₱20 (1 unit), ₱15 (2–4 units), FREE (5+ units)

### Order Status Flow

```
pending → confirmed → out_for_delivery → delivered
                                       ↘ cancelled (any stage)
```

Only `delivered` and `cancelled` orders can be deleted from the admin panel.

### Order ID Format

8-character uppercase alphanumeric string sliced from a UUID v4:

```js
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);
```

## Facebook Integration

### Environment Variables

- `NEXT_PUBLIC_FB_PIXEL_ID` — Meta Pixel ID (exposed to browser)
- `NEXT_PUBLIC_FB_PAGE_ID` — Facebook Page ID (exposed to browser, used for chat plugin)
- `FB_PAGE_ACCESS_TOKEN` — Server-only; used by `lib/facebook.js` to send Messenger messages
- `FB_VERIFY_TOKEN` — Server-only; used to verify Facebook webhook setup

### Meta Pixel (`pages/_app.js`)

Loads the Facebook Pixel script and fires `PageView` on route changes. Fires `Purchase` event on the confirmation page. Uses a `useRef` guard to prevent double-firing.

### Messenger Chat Plugin (`pages/_app.js`)

Embeds the Facebook customer chat SDK so customers can message the business page from any page.

### Messenger API (`lib/facebook.js`)

Uses Facebook Graph API v18.0. Key functions:

- `sendMessengerMessage(psid, text)` — plain text message
- `sendMessengerQuickReply(psid, text, buttons)` — message with quick reply buttons
- `sendMessengerReceipt(psid, order)` — receipt template card
- `verifyWebhookSignature(sig, payload, secret)` — HMAC-SHA256 webhook verification

### Webhook Flow (`pages/api/messenger-webhook.js`)

When a customer sends the bot their Order ID or phone number, the webhook links their Messenger PSID to the order in the database (sets `messenger_psid`). This enables future status notifications via Messenger.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Neon PostgreSQL connection string |
| `ADMIN_PASSWORD` | Yes | Password for admin dashboard and protected API routes |
| `NEXT_PUBLIC_FB_PIXEL_ID` | No | Meta Pixel ID for conversion tracking |
| `NEXT_PUBLIC_FB_PAGE_ID` | No | Facebook Page ID for Messenger chat plugin |
| `FB_PAGE_ACCESS_TOKEN` | No | Page Access Token for sending Messenger messages |
| `FB_VERIFY_TOKEN` | No | Secret for Facebook webhook verification |
| `TURSO_DATABASE_URL` | Unused | Legacy — code uses Neon only |
| `TURSO_AUTH_TOKEN` | Unused | Legacy — code uses Neon only |

`NEXT_PUBLIC_*` variables are embedded at build time and visible to the browser. All others are server-only.

## Frontend Patterns

### Data Fetching

Plain `fetch()` in `useEffect` hooks — no SWR, React Query, or Axios:

```js
useEffect(() => {
  fetch(`/api/orders/${orderId}`)
    .then(res => res.json())
    .then(data => setOrder(data))
    .catch(err => setError(err.message));
}, [orderId]);
```

### State Management

React built-in hooks only (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`). No Context, Redux, or Zustand.

### Routing

`useRouter` from `next/router` (Pages Router). Query params are accessed via `router.query`.

### Styling

Tailwind CSS v4 utility classes. Brand color is sky/cyan blue. Mobile-first responsive design with `md:` breakpoints. No custom CSS classes — pure Tailwind utilities only.

### Path Alias

`@/` maps to the project root. Use it for all imports:

```js
import Layout from '@/components/Layout';
import { getDb } from '@/lib/db';
```

## Development Workflow

### Local Setup

```bash
cp .env.example .env.local
# Fill in POSTGRES_URL and ADMIN_PASSWORD at minimum
npm install
npm run dev
```

### Available Scripts

```bash
npm run dev    # Start dev server (http://localhost:3000)
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

### No Tests

There is no test framework. Verify changes manually by running the dev server.

### Next.js Version Note

This project uses Next.js 16.x with the **Pages Router** (`pages/` directory). Do not use App Router patterns (`app/` directory, `use client`, `use server`, Server Components, etc.). Read `node_modules/next/dist/docs/` for API specifics — this version may differ from training data.

## Key Conventions

1. **Pages Router only** — all routes go in `pages/`, not `app/`
2. **No TypeScript** — `.js` files throughout; do not add `.ts`/`.tsx`
3. **No ORM** — write raw parameterized SQL using the Neon tagged template literal
4. **No component library** — use Tailwind utility classes directly
5. **Admin auth = password header** — pass `{ password }` in request body for admin API routes
6. **Monetary values** — store as `REAL` in DB, display with `₱` prefix and `toFixed(2)`
7. **Dates** — stored as ISO 8601 strings in the `created_at` column; format for display in the component
8. **Boolean fields** — stored as integers (0/1) in the DB (`need_container`)
9. **Status strings** — use exact lowercase snake_case values: `pending`, `confirmed`, `out_for_delivery`, `delivered`, `cancelled`
10. **PSID linking** — Messenger PSID is stored per-order, not per-customer; one customer can have multiple orders each with their own PSID link
