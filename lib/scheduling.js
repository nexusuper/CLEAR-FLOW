// Pure, isomorphic pickup/delivery scheduling rules — shared by the order
// form (client) and the orders API (server, source of truth).

export const PICKUP_MORNING_START = '06:00';
export const PICKUP_MORNING_END = '10:59';
export const PICKUP_AFTERNOON_START = '13:00';
export const PICKUP_AFTERNOON_END = '17:00';

export const DELIVERY_SAME_DAY_START = '13:00';
export const DELIVERY_SAME_DAY_END = '17:00';
export const DELIVERY_NEXT_DAY_START = '07:00';
export const DELIVERY_NEXT_DAY_END = '18:00';

export const DELIVERY_ONLY_START = '07:00';
export const DELIVERY_ONLY_END = '18:00';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTime(t) {
  return typeof t === 'string' && TIME_RE.test(t);
}

function isValidDate(d) {
  return typeof d === 'string' && DATE_RE.test(d);
}

// String comparison is safe for 'HH:MM' (zero-padded, fixed width) and
// 'YYYY-MM-DD' (zero-padded, fixed width) — no need to parse into Date objects.
function timeInRange(t, start, end) {
  return t >= start && t <= end;
}

// The business runs on Manila time (UTC+8). Deriving "today" from UTC means
// that between midnight and 08:00 PH the UTC date is still yesterday, so the
// date picker offers — and the server accepts — a delivery in the past.
export function manilaToday(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export function classifyPickupTime(time) {
  if (!isValidTime(time)) return null;
  if (timeInRange(time, PICKUP_MORNING_START, PICKUP_MORNING_END)) return 'morning';
  if (timeInRange(time, PICKUP_AFTERNOON_START, PICKUP_AFTERNOON_END)) return 'afternoon';
  return null;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function computeAllowedDeliveryWindow({ pickupDate, pickupTime }) {
  if (!isValidDate(pickupDate)) return null;
  const slot = classifyPickupTime(pickupTime);
  if (!slot) return null;
  if (slot === 'morning') {
    return { date: pickupDate, minTime: DELIVERY_SAME_DAY_START, maxTime: DELIVERY_SAME_DAY_END };
  }
  return { date: addDays(pickupDate, 1), minTime: DELIVERY_NEXT_DAY_START, maxTime: DELIVERY_NEXT_DAY_END };
}

// today: 'YYYY-MM-DD' string, injected by the caller (never computed internally)
// so this function stays pure and testable without mocking the clock.
export function validateSchedule({ hasEmptyContainers, pickupDate, pickupTime, deliveryDate, deliveryTime, today }) {
  if (!isValidDate(today)) return { ok: false, error: 'Invalid reference date' };
  if (!isValidDate(deliveryDate) || !isValidTime(deliveryTime)) {
    return { ok: false, error: 'Delivery date/time required' };
  }

  if (!hasEmptyContainers) {
    if (deliveryDate < today) return { ok: false, error: 'Delivery date cannot be in the past' };
    if (!timeInRange(deliveryTime, DELIVERY_ONLY_START, DELIVERY_ONLY_END)) {
      return { ok: false, error: 'Delivery time must be between 7:00 AM and 6:00 PM' };
    }
    return { ok: true };
  }

  if (!isValidDate(pickupDate) || !isValidTime(pickupTime)) {
    return { ok: false, error: 'Pickup date/time required' };
  }
  if (pickupDate < today) return { ok: false, error: 'Pickup date cannot be in the past' };
  if (!classifyPickupTime(pickupTime)) {
    return { ok: false, error: 'Pickup time must be 6:00–10:59 AM or 1:00–5:00 PM' };
  }

  const allowed = computeAllowedDeliveryWindow({ pickupDate, pickupTime });
  if (!allowed || deliveryDate !== allowed.date || !timeInRange(deliveryTime, allowed.minTime, allowed.maxTime)) {
    return { ok: false, error: 'Delivery time is outside the allowed window for this pickup time' };
  }

  // Explicit ordering invariant, independent of the window-bucket check above.
  if (`${deliveryDate}T${deliveryTime}` <= `${pickupDate}T${pickupTime}`) {
    return { ok: false, error: 'Delivery must be scheduled after pickup' };
  }

  return { ok: true };
}
