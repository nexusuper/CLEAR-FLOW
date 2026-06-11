// Helpers for sales/expense aggregation. All day grouping uses the
// Philippines timezone since created_at is stored as UTC ISO strings.
const MANILA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });

export function dayKey(isoString) {
  return MANILA_DAY.format(new Date(isoString));
}

export function todayKey() {
  return MANILA_DAY.format(new Date());
}

// Day key N days before today (Manila time)
export function daysAgoKey(n) {
  return MANILA_DAY.format(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

export function monthKey(isoString) {
  return dayKey(isoString).slice(0, 7);
}

// Orders count as revenue once delivered; walk-in sales always count.
export const REVENUE_ORDER_STATUSES = ['delivered'];

export function sumAmounts(rows) {
  return rows.reduce((acc, r) => acc + Number(r.total_amount ?? r.amount ?? 0), 0);
}
