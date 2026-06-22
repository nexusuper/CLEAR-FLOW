// Isomorphic customer segmentation — safe for both server and client.
export const SEGMENT_DEFS = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700' },
  { value: 'regular', label: 'Regular', color: 'bg-green-100 text-green-700' },
  { value: 'vip', label: 'VIP', color: 'bg-purple-100 text-purple-700' },
  { value: 'at-risk', label: 'At Risk', color: 'bg-orange-100 text-orange-700' },
  { value: 'churned', label: 'Churned', color: 'bg-red-100 text-red-700' },
];

export const SEGMENT_VALUES = new Set(SEGMENT_DEFS.map((s) => s.value));

export function computeSegment({ total_orders, total_spent, last_order }) {
  const daysSinceLast = (Date.now() - new Date(last_order).getTime()) / 86_400_000;
  if (total_orders >= 2 && daysSinceLast >= 30 && daysSinceLast < 60) return 'at-risk';
  if (daysSinceLast >= 60) return 'churned';
  if (total_orders >= 5 || total_spent >= 1500) return 'vip';
  if (total_orders >= 2) return 'regular';
  return 'new';
}
