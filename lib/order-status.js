// Status state machine — single source of truth shared by the API and admin UI.

export const STATUSES = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

export const TRANSITIONS = {
  pending:          ['confirmed', 'cancelled'],
  confirmed:        ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered:        [],
  cancelled:        [],
};

export const DELETABLE_STATUSES = ['delivered', 'cancelled'];
export const NOTIFIABLE_STATUSES = ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

export function nextStatuses(current) {
  return TRANSITIONS[current] || [];
}

export function canTransition(from, to) {
  return nextStatuses(from).includes(to);
}
