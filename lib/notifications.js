// Per-status notification message templates, shared by manual and auto notify.
export const NOTIFIABLE_STATUSES = ['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

const SMS_MESSAGES = {
  confirmed: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) has been confirmed and is being prepared. We'll be on our way soon! 💧`,
  out_for_delivery: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) is now OUT FOR DELIVERY! 🛵 Our rider is heading to you. Please be available to receive it. Thank you!`,
  delivered: (name, id) =>
    `Hi ${name}! Your Clear Flow water order (ID: ${id}) has been delivered. 🎉 Thank you for choosing Clear Flow! Order again anytime.`,
  cancelled: (name, id) =>
    `Hi ${name}, your Clear Flow water order (ID: ${id}) has been cancelled. Please call us at 0912-345-6789 if you have questions.`,
};

const MESSENGER_MESSAGES = {
  confirmed: (name, id) =>
    `✅ Hi ${name}! Your Clear Flow water order (#${id}) has been confirmed and is being prepared.\n\nWe'll notify you when it's on the way! 💧`,
  out_for_delivery: (name, id) =>
    `🛵 Hi ${name}! Your Clear Flow water order (#${id}) is now OUT FOR DELIVERY!\n\nOur rider is heading to you. Please be available to receive it. Thank you! 💧`,
  delivered: (name, id) =>
    `🎉 Hi ${name}! Your Clear Flow water order (#${id}) has been delivered!\n\nThank you for choosing Clear Flow! Order again anytime at our website. 💧`,
  cancelled: (name, id) =>
    `❌ Hi ${name}, your Clear Flow water order (#${id}) has been cancelled.\n\nIf you have questions, please reply to this message or call us at 0912-345-6789.`,
};

export function buildStatusMessage(order, status, channel) {
  const table = channel === 'messenger' ? MESSENGER_MESSAGES : SMS_MESSAGES;
  const fn = table[status];
  return fn ? fn(order.customer_name, order.id) : null;
}
