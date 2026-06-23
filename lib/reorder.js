// Pure, isomorphic reorder-cadence logic. Safe for client or server import.

const DAY_MS = 86_400_000;

/**
 * Given a customer's orders (any order), compute their reorder cadence status.
 * Requires >= 2 orders with valid timestamps to be eligible.
 */
export function computeReorderStatus(orders) {
  const none = { eligible: false, avgIntervalDays: 0, daysSinceLast: 0, status: 'ok' };
  if (!Array.isArray(orders) || orders.length < 2) return none;

  const times = orders
    .map((o) => Date.parse(o.created_at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (times.length < 2) return none;

  const first = times[0];
  const last = times[times.length - 1];
  const avgIntervalDays = (last - first) / (times.length - 1) / DAY_MS;
  if (!Number.isFinite(avgIntervalDays) || avgIntervalDays <= 0) return none;

  const daysSinceLast = (Date.now() - last) / DAY_MS;

  let status = 'ok';
  if (daysSinceLast >= avgIntervalDays * 1.5) status = 'overdue';
  else if (daysSinceLast >= avgIntervalDays) status = 'due';

  return { eligible: true, avgIntervalDays, daysSinceLast, status };
}
