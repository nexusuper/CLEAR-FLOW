# Phase 4 — Operations & Logistics

**Date:** 2026-06-23
**Status:** Approved
**Depends on:** CRM Phase 1-3

## Problem

Day-to-day delivery operations have three gaps:
1. No way to see today's deliveries organized for an efficient run — orders are a flat list.
2. No tracking of how many containers are out with each customer (unreturned containers are lost money).
3. The admin tables overflow horizontally on phones, where the owner actually manages deliveries.

## Solution

Three features:
1. **Delivery route view** — today's active orders grouped by barangay, mobile-first
2. **Container tracking** — hybrid auto-derived + manual balance per customer
3. **Mobile-optimized admin** — responsive card layout for the order/customer tables

## Feature A: Delivery Route View

### Behavior

A new admin tab (**Orders | Customers | Route**) shows the day's delivery run.

### API: `GET /api/orders/route`

- Admin-only (`verifyAdmin` + `rateLimit`).
- Returns orders where `status IN ('confirmed', 'out_for_delivery')` AND (`delivery_date` = today's date `YYYY-MM-DD` OR `delivery_date IS NULL` OR `delivery_date = ''`).
- "Today" is computed server-side as the current local date in `YYYY-MM-DD`.
- Response shape: `{ barangays: [{ barangay, count, orders: [...] }], total }`, grouped and sorted by barangay name. Each order includes: `id, customer_name, phone, address, barangay, product_type, quantity, delivery_slot, status, messenger_psid`.

### UI (`components/AdminPanel.js`, new Route tab)

- Mobile-first. Each barangay renders as a section header `Brgy. Name (count)` followed by a card per order.
- Each card shows: customer name, address, `product_type x quantity`, AM/PM slot badge, and a tap-to-call link (`<a href="tel:...">`).
- Each card has inline action buttons "Out for Delivery" and "Delivered" that call the existing `updateStatus(id, status)` (so Phase 3 auto-notify fires).
- Empty state: "No deliveries scheduled for today."

## Feature B: Container Tracking

### Data Model

```sql
CREATE TABLE IF NOT EXISTS container_adjustments (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_container_adj_phone ON container_adjustments (phone_normalized);
```

Added to `lib/db.js` `initDb()` using the existing migration pattern.

### Balance Computation

`containers_out = autoDerived + manualSum` where:
- `autoDerived` = sum of `container_quantity` from the customer's orders where `status = 'delivered'` AND `need_container = 1`.
- `manualSum` = sum of `delta` from `container_adjustments` for that phone.

Returns (empties collected) are entered as negative deltas. Show the real computed value — do not clamp at zero (a negative would indicate over-correction and is worth seeing).

### API Changes

- `GET /api/customers/[phone]` — gains `containers_out` (computed integer) and `containerAdjustments` (the adjustment rows, newest first).
- New `POST /api/customers/[phone]/container-adjust` — admin-only. Zod body: `{ delta: z.coerce.number().int().min(-100).max(100), reason: z.string().max(200).optional().default('') }`. Inserts an adjustment row with `uuidv4().slice(0,8).toUpperCase()` id and ISO timestamp. Returns the created row.

### UI (customer detail panel)

- A "Containers Out" card showing the computed number.
- A small control: a number input (defaulting to 1) + "Give" (positive delta) and "Collect" (negative delta) buttons + optional reason text.
- Below: the adjustment history (delta, reason, date), newest first. Auto-derived deliveries are reflected in the number but not listed as adjustments (they live in order history).

## Feature C: Mobile-Optimized Admin

### Behavior

The Orders and Customers tables overflow horizontally on phones. Add a responsive layout:
- On `sm` and larger: keep the existing `<table>`.
- On screens smaller than `sm`: hide the table and render each row as a stacked card with the key fields labeled.

### Implementation

- Wrap the existing tables in `hidden sm:block`.
- Add a `sm:hidden` card list rendering the same data (`orders` / `customers` arrays) with the same click/action handlers.
- Orders card: ID, customer + phone, status select, total, key actions.
- Customers card: name, phone, orders count, total spent, segment badge; tap opens the detail panel (same `fetchCustomerDetail`).
- The Route view is built mobile-first and needs no separate desktop/mobile split.

## Patterns & Conventions

- Auth: `verifyAdmin()` from `lib/auth.js`
- Rate limiting: `rateLimit()` from `lib/rate-limit.js`
- Validation: Zod
- DB: `initDb()` migration pattern; `container_adjustments` table
- IDs: `uuidv4().slice(0,8).toUpperCase()`
- UI: Clay component library; tab system already present in AdminPanel
- Currency: Philippine Pesos (PHP)

## Out of Scope

- Map/GPS integration or automatic route optimization (manual barangay grouping only)
- Container deposit/billing logic
- Driver assignment or multi-driver routing
- Push notifications to a driver app
