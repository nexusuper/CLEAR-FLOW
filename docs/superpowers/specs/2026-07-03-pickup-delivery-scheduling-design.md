# Pickup & Delivery Scheduling + Container Pickups Admin Tab

**Date:** 2026-07-03
**Status:** Draft
**Depends on:** Phase 3 (order automation), Phase 4 (logistics)

## Problem

Refill orders currently capture a vague `delivery_slot` (`am`/`pm`/`pickup`) and free-text `delivery_date`, with no distinction between *picking up the customer's empty containers* and *delivering refilled ones back*. There's no enforced link between when containers are picked up and when delivery can happen, no precise time-of-day capture, and no admin view dedicated to tracking the pickup leg of a refill order.

## Solution

1. Split order scheduling into two concepts: **pickup** (empty containers collected, refill orders only) and **delivery** (water delivered, all orders), each with a date + exact time.
2. Enforce pickup/delivery time-window rules on the order form, with a warning popup when the customer picks an afternoon pickup slot.
3. Add a `container_pickups` table, auto-created for every refill order, and a new **Container Pickups** admin tab (sortable, with pre-composed SMS/Messenger messaging and delete — mirroring the Orders tab).

## Order Type Rule

- **Refill order** (`quantity > 0`, i.e. the customer has containers to return): pickup + computed-window delivery flow.
- **Delivery-only order** (`quantity === 0`, buying new container(s) only): no pickup step; customer freely picks any delivery date + time.

An order can carry both a refill quantity and new containers (`need_container`/`container_quantity`) — if `quantity > 0` it's still treated as a refill order (pickup applies to the returnable containers being refilled).

## Time Window Rules

| Pickup slot | Pickup time range | Allowed delivery |
|---|---|---|
| Morning | 6:00 AM – 10:59 AM | Same day, 1:00 PM – 5:00 PM |
| Afternoon | 1:00 PM – 5:00 PM | Next day, any time (7:00 AM – 6:00 PM) |

Pickup time input outside 6:00 AM–5:00 PM, or inside the 11:00 AM–12:59 PM gap, is rejected client- and server-side.

When the customer selects an afternoon pickup time (>= 1:00 PM), show a popup/inline notice: *"We will try to pick up in the afternoon but delivery will be tomorrow."* Selecting delivery date is then locked to "tomorrow" and the time field allows the full 7:00 AM–6:00 PM range. Selecting a morning pickup locks delivery date to "today" and the time field to 1:00 PM–5:00 PM.

Delivery-only orders: date >= today, time 7:00 AM–6:00 PM, no popup, no pickup fields shown.

**Ordering invariant:** for refill orders, the delivery datetime must always be strictly later than the pickup datetime — pickup always comes first, delivery always goes last. This falls out of the window table above (same-day delivery only opens at 1:00 PM, after the 10:59 AM morning-pickup cutoff; next-day delivery only applies after an afternoon pickup), but it is also enforced as an explicit, independent check — both client-side (reject/disable a delivery time that isn't after the selected pickup time) and server-side (reject the request outright, regardless of which window bucket the times nominally fall in) — so no combination of pickup/delivery values can ever produce delivery <= pickup.

## Data Model

### `orders` table changes

Replace the existing free-text `delivery_slot`/`delivery_date` columns' *meaning* (keep the columns for backward read-compat but stop writing new free-text into them) with four new structured columns, added via the existing `initDb()` migration pattern:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;   -- 'HH:MM' 24h
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date_new TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time TEXT; -- 'HH:MM' 24h
```

Postgres (Neon) supports `ADD COLUMN IF NOT EXISTS` directly — use the same migration pattern already present in `lib/db.js` for prior column additions.

`pickup_date`/`pickup_time` are null for delivery-only orders. `delivery_date_new`/`delivery_time` are always set (both order types). The old `delivery_date`/`delivery_slot` columns stay for historical rows but the API stops accepting/writing them for new orders.

### New `container_pickups` table

```sql
CREATE TABLE IF NOT EXISTS container_pickups (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  address TEXT NOT NULL,
  barangay TEXT NOT NULL,
  container_qty INTEGER NOT NULL,
  pickup_date TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | picked_up | delivered | cancelled
  notes TEXT DEFAULT '',
  messenger_psid TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_container_pickups_status ON container_pickups (status);
CREATE INDEX IF NOT EXISTS idx_container_pickups_date ON container_pickups (pickup_date);
```

Created in the same request as the order (via `sql.transaction`, matching the pattern in `lib/inventory.js`) whenever `quantity > 0`. `container_qty` = order `quantity`. `messenger_psid` copied from the order for messaging.

## API Changes

### `pages/api/orders.js` (POST)
- Zod schema: replace `delivery_slot`/`delivery_date` with:
  - `pickupDate`, `pickupTime` — required if `quantity > 0`, validated against the morning/afternoon windows.
  - `deliveryDate`, `deliveryTime` — always required, validated against the derived allowed window (recomputed server-side from pickup time — never trust client-computed delivery window), and additionally checked to be strictly after `pickupDate`+`pickupTime` when a pickup is present (belt-and-suspenders on top of the window check).
- On insert, if `quantity > 0`, also insert a `container_pickups` row in the same transaction.

### `pages/api/orders/[id].js`
- No structural change; `pickup_date/time`, `delivery_date_new/time` are read-only after creation via this route (rescheduling, if needed later, is out of scope — see below).

### New: `pages/api/container-pickups/index.js`
- `GET` — admin-only (`verifyAdminWithLockout`). Supports `status` filter and `sort` (pickup_date/status/customer_name asc-desc), mirroring `orders.js`'s `sortMap` pattern.
- (No POST — rows are only created as a side effect of order creation.)

### New: `pages/api/container-pickups/[id].js`
- `PATCH` — admin-only. Body: `{ status }` (scheduled/picked_up/delivered/cancelled). Updates `status` and `updated_at`.
- `DELETE` — admin-only. Only allowed when `status IN ('delivered', 'cancelled')`, matching the existing `DELETABLE_STATUSES` convention on orders.

## Order Form (`pages/order.js`)

- Keep existing product/quantity/container fields.
- Replace the single AM/PM/pickup radio + date input with:
  - If `quantity > 0` (refill order — computed live from the quantity field): show **"When should we pick up your empty containers?"** — date picker (min = today) + time picker (native `<input type="time">`, constrained to 6:00–17:00 via `min`/`max`, with the 11:00–13:00 gap enforced by inline validation since native time inputs can't express a gap).
    - On selecting a time >= 13:00, show the clay-styled inline notice: *"We will try to pick up in the afternoon but delivery will be tomorrow."*
    - Then show **"When should we deliver your refill?"** — date is auto-filled and locked (today or tomorrow per the rule, displayed as read-only text) + a time picker constrained to the computed allowed range.
  - Else (delivery-only): show a single **"When should we deliver?"** date (min = today) + time picker (7:00–18:00, no gap).
- Client-side validation mirrors server-side; server is the source of truth.

## Admin Panel

### New tab: Container Pickups (`components/admin/ContainerPickupsPanel.js`)

Modeled on `POSPanel.js`'s prop/data-fetching pattern: `{ savedPassword }` prop, owns its own fetch/state.

- Fetches from `GET /api/container-pickups` with filter/sort controls (status filter, sort by pickup date / status / customer name — asc/desc), matching the Orders tab's existing filter UI.
- Table (desktop `<table>`, mobile stacked cards, per the Phase 4 responsive pattern) columns: Customer/Phone, Address/Barangay, Container Qty, Pickup Date+Time, Delivery Date+Time, Status (dropdown → `PATCH`), Actions.
- Actions column, matching Orders tab conventions:
  - **Copy SMS message** — pre-composed text via a new `PICKUP_SMS_MESSAGES` template map in `lib/notifications.js` (status-keyed: scheduled/picked_up/delivered), copied to clipboard.
  - **Send via Messenger** — shown only if `messenger_psid` present, uses `PICKUP_MESSENGER_MESSAGES` templates + existing `sendMessengerMessage` (new API route `pages/api/container-pickups/[id]/notify.js`, admin-only, mirrors `messenger-notify.js`).
  - **Delete** — enabled only when status is `delivered` or `cancelled`.
- Registered in `components/AdminPanel.js`'s tab bar (`dashboard | orders | customers | route | pickups | inventory | pos | screenshots`) and rendered as `activeTab === 'pickups' && <ContainerPickupsPanel savedPassword={...} />`.

### Orders tab
- No structural change beyond reading the new `pickup_date/time`/`delivery_date_new/time` columns for display (replacing the old `DELIVERY_SLOT_SHORT` short-label rendering with formatted date+time strings). Delete option already exists per `DELETABLE_STATUSES`; unaffected.

## Notification Templates (`lib/notifications.js`)

Add `PICKUP_SMS_MESSAGES` / `PICKUP_MESSENGER_MESSAGES` maps (status-keyed: `scheduled`, `picked_up`, `delivered`) alongside the existing `SMS_MESSAGES`/`MESSENGER_MESSAGES`, following the same interpolation pattern (customer name, pickup/delivery date+time, container qty).

## Patterns & Conventions

- Auth: `verifyAdminWithLockout(req, res)` on all new/changed admin routes.
- Validation: Zod, mirroring `orders.js`'s schema style.
- DB: `initDb()` migration pattern in `lib/db.js`; transaction via `sql.transaction([...])` for order+pickup atomic insert (pattern from `lib/inventory.js`).
- IDs: `uuidv4().slice(0,8).toUpperCase()`.
- UI: Clay component library (`clay-raised`, `ClayButton`, etc.), responsive table/card split per Phase 4.
- Currency: PHP.

## Out of Scope

- Rescheduling an already-created pickup/delivery time (cancel + reorder is the workaround for now).
- Driver assignment or route optimization for pickups (Phase 4's Route tab is delivery-only and unaffected).
- Automatic SMS sending (no Twilio integration exists; "SMS" remains copy-to-clipboard, matching the existing Orders tab behavior).
- Enforcing pickup/delivery windows against real-world business closures (holidays, etc.) — only the daily time-of-day rule.
