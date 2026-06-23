# Phase 3 — Order Lifecycle Automation

**Date:** 2026-06-23
**Status:** Approved
**Depends on:** CRM Phase 1 & 2

## Problem

Managing orders day-to-day has three friction points:
1. Notifications are fully manual — the admin clicks "notify" for every status change.
2. There is no record of whether a GCash/PayMaya payment has been verified.
3. Customers cannot indicate a preferred delivery time, so routing and expectations are guesswork.

## Solution

Three features built on the existing order and notification system:

1. **Auto-notifications** on status change (Messenger auto-send; SMS queued as a reminder)
2. **Payment verification** toggle for non-COD orders
3. **Delivery time slots** (AM/PM) chosen at order time

## Shared Refactor: `lib/notifications.js`

Message templates currently live inline in two places:
- `pages/api/notify.js` — builds SMS copy-paste text per status
- `pages/api/messenger-notify.js` — builds Messenger text per status

Extract the per-status message builder into a new server module `lib/notifications.js`:

```js
export function buildStatusMessage(order, status) { /* returns string */ }
export const NOTIFIABLE_STATUSES = ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
```

Both existing endpoints and the new auto-hook import from this module. This is a pure refactor — the produced text must match the current output exactly.

## Data Model

All additive columns on `orders`, using the existing `ADD COLUMN IF NOT EXISTS` migration pattern in `lib/db.js`:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sms_pending      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_slot    TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date    TEXT;
```

## Feature A: Auto-notifications on Status Change

### Behavior

When `PATCH /api/orders/[id]` updates `status` to a value in `NOTIFIABLE_STATUSES`:

1. Load the order (need `messenger_psid`, `phone`, order fields for the message).
2. Build the message via `buildStatusMessage(order, status)`.
3. **If `messenger_psid` is set:** call `sendMessengerMessage(psid, text)`, then insert a `contact_log` row (channel `messenger`, direction `outbound`). On failure, log the error and continue — do NOT fail the status update.
4. **If no `messenger_psid`:** set `sms_pending = 1` on the order.
5. The status `UPDATE` and the `sms_pending`/notify side effects all complete before the response returns.

When the status is changed to a non-notifiable value (`pending`), no notification fires and `sms_pending` is left unchanged.

### Clearing `sms_pending`

The existing manual SMS flow (`POST /api/notify`) already returns the copy-paste message. After it succeeds, also `UPDATE orders SET sms_pending = 0 WHERE id = ${orderId}`. This means clicking the existing SMS button in the admin clears the pending badge.

### API Changes

- `PATCH /api/orders/[id]` — adds the auto-notify side effect described above. Response unchanged (`{ success: true }`).
- `POST /api/notify` — clears `sms_pending` after building the message.

### UI Changes (`components/AdminPanel.js`)

- Orders with `sms_pending === 1` show an amber "SMS reminder pending" badge near the status cell.
- No new buttons — the existing SMS copy button clears the flag on use (the orders list refetches after notify).

## Feature B: Payment Verification

### Behavior

- New `payment_verified` column (0/1).
- Only meaningful for `gcash` and `paymaya` orders. COD orders ignore it.

### API Changes

- `PATCH /api/orders/[id]` — accepts an optional `payment_verified` boolean in the body. When present, updates only that column (independent of status updates). Validate it is a boolean; coerce to 0/1.

### UI Changes (`components/AdminPanel.js`)

- In the orders table Payment cell, for `gcash`/`paymaya` orders:
  - Show an "Unverified" amber badge when `payment_verified` is 0.
  - Show a "Verified" green badge when 1.
  - A small checkbox toggles it via `PATCH /api/orders/[id]` with `{ payment_verified: true|false }`.

## Feature C: Delivery Time Slots

### Behavior

- `delivery_slot`: one of `'am'` (8AM–12PM) or `'pm'` (1PM–5PM), optional.
- `delivery_date`: ISO date string (`YYYY-MM-DD`), optional. Empty means "ASAP / today".

### Order Form (`pages/order.js`)

- Add an AM / PM radio group (labelled "Morning 8AM–12PM" / "Afternoon 1PM–5PM").
- Add an optional date input (defaults to empty = ASAP).
- Both included in the POST body to `/api/orders`.

### API Changes

- `POST /api/orders` (`pages/api/orders.js`) — Zod schema gains:
  ```js
  delivery_slot: z.enum(['am', 'pm']).optional().nullable(),
  delivery_date: z.string().max(20).optional().nullable(),
  ```
  Insert both columns.
- `POST /api/fb-orders.js` — accepts optional `delivery_slot` (same enum), inserts it. Messenger orders rarely set this; default null.

### UI Changes

- `components/AdminPanel.js` orders table: show the slot (e.g., "AM" / "PM") and date in the Date/Order column when present.
- `pages/order/confirmation.js`: show the chosen slot in the confirmation summary when present.

## Patterns & Conventions

- Auth: `verifyAdmin()` from `lib/auth.js`
- Rate limiting: existing `rateLimit()` instances
- Validation: Zod
- DB: `initDb()` migration pattern
- Notify side effects must never make the status update fail (wrap in try/catch, log only)

## Out of Scope

- True automated SMS sending (no SMS gateway integrated; SMS stays copy-paste)
- Specific-hour or evening delivery slots
- Gating delivery on payment verification
- Editing delivery slot after order placement
