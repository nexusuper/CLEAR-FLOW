# Phase 4 Logistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delivery route view, hybrid container tracking, and a mobile-optimized admin layout.

**Architecture:** A new `GET /api/orders/route` groups today's active orders by barangay. A `container_adjustments` table plus auto-derivation from delivered orders gives a per-customer "containers out" balance. The admin panel gets a third tab (Route) and responsive card layouts for the Orders/Customers tables.

**Tech Stack:** Next.js 16 (Pages Router), Neon Postgres (`@neondatabase/serverless`), React 19, Tailwind CSS 4, Zod, uuid

## Global Constraints

- JavaScript (no TypeScript)
- Auth: `verifyAdmin(req)` from `lib/auth.js` on all admin endpoints
- Rate limiting: `rateLimit()` from `lib/rate-limit.js`
- Validation: Zod for request bodies
- DB: `initDb()` migration pattern with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- IDs: `uuidv4().slice(0,8).toUpperCase()`
- Timestamps: `new Date().toISOString()`
- Phone identity key is `phone_normalized` (digits only) via `normalizePhone` from `lib/loyalty.js`
- Neon `sql` tagged template — no `sql.unsafe()`
- UI: Clay component library (clay-raised, clay-raised-sm, clay-inset, clay-btn-primary, clay-pressable, clay-input); existing tab system in AdminPanel
- Currency: Philippine Pesos (PHP)

---

### Task 1: Container Adjustments Table

**Files:**
- Modify: `lib/db.js`

**Interfaces:**
- Produces: `container_adjustments` table (`id` TEXT PK, `phone_normalized` TEXT, `delta` INTEGER, `reason` TEXT default '', `created_at` TEXT) + index on `phone_normalized`.

- [ ] **Step 1: Add the table to `initDb()`**

In `lib/db.js`, after the `contact_log` table + index creation blocks (near the end of `initDb`, before `initialized = true;`), add:

```js
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS container_adjustments (
        id TEXT PRIMARY KEY,
        phone_normalized TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT DEFAULT '',
        created_at TEXT NOT NULL
      )
    `;
  } catch (e) {}
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_container_adj_phone ON container_adjustments (phone_normalized)`;
  } catch (e) {}
```

- [ ] **Step 2: Verify dev server starts**

Run: `npm run dev`, load `/admin` and log in to trigger `initDb()`.
Expected: no SQL errors in console.

- [ ] **Step 3: Commit**

```bash
git add lib/db.js
git commit -m "feat(containers): add container_adjustments table"
```

---

### Task 2: Delivery Route API

**Files:**
- Create: `pages/api/orders/route.js`

**Interfaces:**
- Consumes: `initDb`, `verifyAdmin`, `rateLimit`
- Produces: `GET /api/orders/route` → `{ barangays: [{ barangay, count, orders: [...] }], total }`. Each order: `id, customer_name, phone, address, barangay, product_type, quantity, delivery_slot, status, messenger_psid`.

- [ ] **Step 1: Create `pages/api/orders/route.js`**

```js
import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const adminRate = rateLimit({ windowMs: 60_000, max: 60 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows = await sql`
      SELECT id, customer_name, phone, address, barangay,
             product_type, quantity, delivery_slot, status, messenger_psid
      FROM orders
      WHERE status IN ('confirmed', 'out_for_delivery')
        AND (delivery_date = ${today} OR delivery_date IS NULL OR delivery_date = '')
      ORDER BY barangay ASC, delivery_slot ASC NULLS LAST, created_at ASC
    `;

    const groups = new Map();
    for (const o of rows) {
      const key = o.barangay || 'Unspecified';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    const barangays = Array.from(groups.entries())
      .map(([barangay, orders]) => ({ barangay, count: orders.length, orders }))
      .sort((a, b) => a.barangay.localeCompare(b.barangay));

    return res.status(200).json({ barangays, total: rows.length });
  } catch (err) {
    console.error('Route query failed:', err);
    return res.status(500).json({ error: 'Failed to load route' });
  }
}
```

- [ ] **Step 2: Verify the endpoint responds**

Run `npm run dev`, then `GET /api/orders/route` with the admin password header.
Expected: `{ barangays: [...], total: N }`.

- [ ] **Step 3: Commit**

```bash
git add pages/api/orders/route.js
git commit -m "feat(route): add delivery route API grouping today's orders by barangay"
```

---

### Task 3: Container Tracking API

**Files:**
- Create: `pages/api/customers/[phone]/container-adjust.js`
- Modify: `pages/api/customers/[phone].js`

**Interfaces:**
- Consumes: `initDb`, `verifyAdmin`, `rateLimit`, `normalizePhone`, `uuid`, `zod`
- Produces:
  - `POST /api/customers/[phone]/container-adjust` — body `{ delta, reason }`, inserts a row, returns `{ id, delta, reason, created_at }`.
  - `GET /api/customers/[phone]` — gains `containers_out` (int) and `containerAdjustments` (array, newest first).

- [ ] **Step 1: Create `pages/api/customers/[phone]/container-adjust.js`**

```js
import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/loyalty';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

const AdjustSchema = z.object({
  delta: z.coerce.number().int().min(-100).max(100),
  reason: z.string().max(200).optional().default(''),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const phone = normalizePhone(req.query.phone);
  if (phone.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const parsed = AdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid adjustment data' });
  }
  if (parsed.data.delta === 0) {
    return res.status(400).json({ error: 'Delta must be non-zero' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const id = uuidv4().slice(0, 8).toUpperCase();
    const now = new Date().toISOString();
    const { delta, reason } = parsed.data;
    await sql`
      INSERT INTO container_adjustments (id, phone_normalized, delta, reason, created_at)
      VALUES (${id}, ${phone}, ${delta}, ${reason}, ${now})
    `;
    return res.status(201).json({ id, delta, reason, created_at: now });
  } catch (err) {
    console.error('Container adjust insert failed:', err);
    return res.status(500).json({ error: 'Failed to save adjustment' });
  }
}
```

- [ ] **Step 2: Add containers_out + adjustments to `pages/api/customers/[phone].js`**

In the `Promise.all` (currently fetches orders, notes, contactLog), add a fourth query for adjustments. Change:

```js
    const [orders, notes, contactLog] = await Promise.all([
      sql`SELECT * FROM orders WHERE phone_normalized = ${phone} ORDER BY created_at DESC`,
      sql`SELECT * FROM customer_notes WHERE phone_normalized = ${phone} ORDER BY updated_at DESC`,
      sql`SELECT * FROM contact_log WHERE phone_normalized = ${phone} ORDER BY created_at DESC LIMIT 50`,
    ]);
```
to:
```js
    const [orders, notes, contactLog, containerAdjustments] = await Promise.all([
      sql`SELECT * FROM orders WHERE phone_normalized = ${phone} ORDER BY created_at DESC`,
      sql`SELECT * FROM customer_notes WHERE phone_normalized = ${phone} ORDER BY updated_at DESC`,
      sql`SELECT * FROM contact_log WHERE phone_normalized = ${phone} ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT * FROM container_adjustments WHERE phone_normalized = ${phone} ORDER BY created_at DESC`,
    ]);
```

After the `loyalty` computation (before the `segment` computation), add the balance:
```js
    const autoDerived = orders.reduce(
      (sum, o) => sum + (o.status === 'delivered' && o.need_container ? (Number(o.container_quantity) || 0) : 0),
      0
    );
    const manualSum = containerAdjustments.reduce((sum, a) => sum + (Number(a.delta) || 0), 0);
    const containers_out = autoDerived + manualSum;
```

Add `containers_out` and `containerAdjustments` to the response object (alongside `segment`, `orders`, `notes`, `contactLog`):
```js
      containers_out,
      containerAdjustments,
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add pages/api/customers/[phone]/container-adjust.js pages/api/customers/[phone].js
git commit -m "feat(containers): container-adjust API and containers_out in customer detail"
```

---

### Task 4: Route Tab UI

**Files:**
- Modify: `components/AdminPanel.js`

**Interfaces:**
- Consumes: `GET /api/orders/route`, existing `updateStatus(id, status)`

- [ ] **Step 1: Add Route state and fetch function**

After the existing CRM state block (near the other `useState` declarations), add:
```js
const [route, setRoute] = useState(null);
const [routeLoading, setRouteLoading] = useState(false);
```

After `fetchCustomers` (or near the other fetchers), add:
```js
async function fetchRoute() {
  setRouteLoading(true);
  try {
    const res = await fetch('/api/orders/route', { headers: { password: savedPassword } });
    if (res.ok) setRoute(await res.json());
  } catch (e) {
    console.error('Failed to fetch route:', e);
  }
  setRouteLoading(false);
}
```

- [ ] **Step 2: Fetch route when its tab opens**

Add a `useEffect` near the existing customers-tab effect:
```js
useEffect(() => {
  if (activeTab === 'route' && authed) fetchRoute();
}, [activeTab, authed]);
```

- [ ] **Step 3: Add the Route tab button**

In the header tab row (where Orders and Customers tab buttons are), add a third button after Customers:
```jsx
<button
  onClick={() => setActiveTab('route')}
  className={'px-5 py-2 rounded-t-xl text-sm font-semibold transition-colors ' + (activeTab === 'route' ? 'bg-clay-bg text-sky-700' : 'text-white/70 hover:text-white hover:bg-white/10')}
>
  <ClayIcon name="truck" className="w-4 h-4 inline mr-1" /> Route
</button>
```

Also update the header subtitle line that switches on `activeTab` so it does not break for `route`. Find the subtitle paragraph and add a `route` branch:
```jsx
{activeTab === 'orders' ? `${totalOrders} total orders` : activeTab === 'customers' ? `${custTotal} customers` : `${route?.total ?? 0} stops today`}
```

- [ ] **Step 4: Render the Route tab content**

After the customers tab block (`{activeTab === 'customers' && (...)}`), add:
```jsx
{activeTab === 'route' && (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-clay-ink">Today's Deliveries</h2>
      <button onClick={fetchRoute} className="text-xs clay-raised-sm rounded-full px-3 py-1.5 font-semibold hover:bg-sky-50">
        <ClayIcon name="refresh" className="w-3.5 h-3.5 inline" /> Refresh
      </button>
    </div>
    {routeLoading ? (
      <p className="text-center py-12 text-gray-400">Loading route...</p>
    ) : !route || route.total === 0 ? (
      <p className="text-center py-12 text-gray-400">No deliveries scheduled for today.</p>
    ) : (
      route.barangays.map((grp) => (
        <div key={grp.barangay}>
          <h3 className="font-display font-bold text-clay-ink2 mb-2">{grp.barangay} ({grp.count})</h3>
          <div className="space-y-2">
            {grp.orders.map((o) => (
              <div key={o.id} className="clay-raised-sm rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-clay-ink flex items-center gap-2">
                      {o.customer_name}
                      {o.delivery_slot && <span className="text-[10px] font-semibold text-sky-600">{o.delivery_slot === 'am' ? 'AM' : 'PM'}</span>}
                    </div>
                    <div className="text-sm text-gray-600">{o.address}</div>
                    <div className="text-xs text-gray-400">{o.product_type} x{o.quantity}</div>
                    <a href={`tel:${o.phone}`} className="text-xs text-clay-skydeep font-semibold mt-1 inline-flex items-center gap-1">
                      <ClayIcon name="phone" className="w-3.5 h-3.5" /> {o.phone}
                    </a>
                  </div>
                  <div className="flex flex-col gap-1">
                    {o.status === 'confirmed' && (
                      <button onClick={() => { updateStatus(o.id, 'out_for_delivery').then(fetchRoute); }} className="text-[11px] bg-orange-100 text-orange-700 font-semibold px-2 py-1 rounded-full">Out</button>
                    )}
                    <button onClick={() => { updateStatus(o.id, 'delivered').then(fetchRoute); }} className="text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">Delivered</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))
    )}
  </div>
)}
```

Note: `updateStatus` is `async` and calls `fetchOrders()` internally; it returns a promise, so `.then(fetchRoute)` refreshes the route after the status change.

- [ ] **Step 5: Verify in browser**

Run `npm run dev`, `/admin`, login, open the Route tab. Confirmed/out-for-delivery orders dated today (or undated) appear grouped by barangay. Tap-to-call link works. Marking delivered removes the stop on refresh.

- [ ] **Step 6: Commit**

```bash
git add components/AdminPanel.js
git commit -m "feat(admin): add mobile-first delivery route tab"
```

---

### Task 5: Container Tracking UI in Customer Detail

**Files:**
- Modify: `components/AdminPanel.js`

**Interfaces:**
- Consumes: `POST /api/customers/[phone]/container-adjust`; `selectedCustomer.containers_out`, `selectedCustomer.containerAdjustments`

- [ ] **Step 1: Add container adjust state**

Near the CRM state block, add:
```js
const [containerQty, setContainerQty] = useState(1);
const [containerReason, setContainerReason] = useState('');
const [savingContainer, setSavingContainer] = useState(false);
```

- [ ] **Step 2: Add the adjust handler**

After `saveContactLog` (or near the other detail handlers), add:
```js
async function adjustContainers(sign) {
  if (!selectedCustomer || !containerQty) return;
  setSavingContainer(true);
  try {
    await fetch(`/api/customers/${selectedCustomer.phone_normalized}/container-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', password: savedPassword },
      body: JSON.stringify({ delta: sign * Math.abs(containerQty), reason: containerReason }),
    });
    setContainerReason('');
    setContainerQty(1);
    await fetchCustomerDetail(selectedCustomer.phone_normalized);
  } catch (e) {
    console.error('Failed to adjust containers:', e);
  }
  setSavingContainer(false);
}
```

- [ ] **Step 3: Render the Containers Out card**

In the customer detail panel, after the Customer Info card and before the Notes section, add:
```jsx
<div className="clay-raised-sm rounded-2xl p-4">
  <h3 className="text-sm font-semibold text-gray-700 mb-2">
    <ClayIcon name="jug" className="w-4 h-4 inline mr-1" /> Containers Out
  </h3>
  <div className="text-3xl font-bold text-sky-700 mb-3">{selectedCustomer.containers_out ?? 0}</div>
  <div className="flex items-center gap-2 mb-2">
    <input
      type="number"
      min="1"
      max="100"
      value={containerQty}
      onChange={(e) => setContainerQty(Math.max(1, parseInt(e.target.value) || 1))}
      className="clay-input w-20 text-sm"
    />
    <input
      type="text"
      value={containerReason}
      onChange={(e) => setContainerReason(e.target.value)}
      placeholder="Reason (optional)"
      className="clay-input flex-1 text-sm"
    />
  </div>
  <div className="flex gap-2">
    <button onClick={() => adjustContainers(1)} disabled={savingContainer} className="flex-1 clay-btn-primary clay-pressable rounded-full py-1.5 text-sm font-semibold disabled:opacity-50">+ Give</button>
    <button onClick={() => adjustContainers(-1)} disabled={savingContainer} className="flex-1 clay-btn-white clay-pressable rounded-full py-1.5 text-sm font-semibold disabled:opacity-50">− Collect</button>
  </div>
  {selectedCustomer.containerAdjustments && selectedCustomer.containerAdjustments.length > 0 && (
    <div className="mt-3 space-y-1">
      {selectedCustomer.containerAdjustments.map((a) => (
        <div key={a.id} className="flex items-center justify-between text-xs clay-inset rounded-lg px-2 py-1">
          <span className={'font-semibold ' + (a.delta > 0 ? 'text-sky-600' : 'text-amber-600')}>{a.delta > 0 ? '+' : ''}{a.delta}</span>
          <span className="text-gray-500 flex-1 px-2 truncate">{a.reason || '—'}</span>
          <span className="text-gray-400">{new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Reset container inputs on customer switch**

In `fetchCustomerDetail`, where the other detail inputs are reset (`setQuickMessage('')` etc.), add:
```js
setContainerQty(1);
setContainerReason('');
```

- [ ] **Step 5: Verify in browser**

Open a customer detail, give 2 containers, confirm the count rises and the log shows `+2`; collect 1, confirm it drops and shows `−1`. Deliver an order with a new container and confirm the auto-derived count is reflected.

- [ ] **Step 6: Commit**

```bash
git add components/AdminPanel.js
git commit -m "feat(containers): containers-out card with give/collect adjustments"
```

---

### Task 6: Mobile-Responsive Order & Customer Tables

**Files:**
- Modify: `components/AdminPanel.js`

**Interfaces:**
- Consumes: existing `orders` (`filtered`), `customers` arrays and their handlers (`updateStatus`, `fetchCustomerDetail`)

- [ ] **Step 1: Make the Orders table desktop-only and add a mobile card list**

Find the Orders table scroll wrapper `<div className="overflow-x-auto">` (the one containing the orders `<table>`). Change its className to `hidden sm:block overflow-x-auto`.

Immediately after that wrapper's closing `</div>`, add a mobile card list:
```jsx
<div className="sm:hidden divide-y divide-gray-100">
  {filtered.map((o) => (
    <div key={o.id} className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-sky-600">{o.id}</span>
        <span className="font-bold text-sky-600">₱{o.total_amount}</span>
      </div>
      <div className="font-medium text-gray-800">{o.customer_name}</div>
      <div className="text-xs text-gray-400">{o.phone} · {o.barangay}</div>
      <div className="text-sm text-gray-600">{o.product_type} x{o.quantity}</div>
      <select
        value={o.status}
        disabled={updating === o.id}
        onChange={(e) => updateStatus(o.id, e.target.value)}
        className={'text-xs font-semibold px-2 py-1 rounded-full border-0 ' + STATUS_COLORS[o.status]}
      >
        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {o.sms_pending ? <div className="text-[10px] font-semibold text-amber-600">SMS reminder pending</div> : null}
    </div>
  ))}
</div>
```

- [ ] **Step 2: Make the Customers table desktop-only and add a mobile card list**

Find the Customers table scroll wrapper `<div className="overflow-x-auto">` (the one containing the customers `<table>`). Change its className to `hidden sm:block overflow-x-auto`.

After its closing `</div>`, add:
```jsx
<div className="sm:hidden divide-y divide-gray-100">
  {customers.map((c) => (
    <div key={c.phone_normalized} onClick={() => fetchCustomerDetail(c.phone_normalized)} className="p-4 space-y-1 cursor-pointer hover:bg-sky-50">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-800 flex items-center gap-1">
          {c.customer_name}
          {c.has_messenger && <ClayIcon name="chat" className="w-4 h-4 inline text-blue-500" />}
        </span>
        {c.segment && (() => {
          const def = SEGMENT_DEFS.find((s) => s.value === c.segment);
          return def ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${def.color}`}>{def.label}</span> : null;
        })()}
      </div>
      <div className="text-xs text-gray-400 font-mono">{c.phone_display || c.phone_normalized}</div>
      <div className="text-xs text-gray-600">{c.total_orders} orders · ₱{c.total_spent}</div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Verify responsive behavior**

Run `npm run dev`. In browser devtools, toggle a narrow viewport (375px). The Orders and Customers tabs show stacked cards; at `sm`+ the tables return. Actions (status change, open detail) work in both.

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add components/AdminPanel.js
git commit -m "feat(admin): responsive card layout for orders and customers on mobile"
```
