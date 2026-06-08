// Facebook Messenger API helper
// Docs: https://developers.facebook.com/docs/messenger-platform/send-messages

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * Send a message via Facebook Messenger
 * Note: Customer must have initiated conversation with your Page first
 * @param {string} recipientPsid - Page-scoped user ID (PSID)
 * @param {string} messageText - Message to send
 */
export async function sendMessengerMessage(recipientPsid, messageText) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not configured');
  }

  const response = await fetch(`${FB_GRAPH_URL}/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text: messageText },
      messaging_type: 'MESSAGE_TAG',
      tag: 'POST_PURCHASE_UPDATE', // Allowed for order updates
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to send Messenger message');
  }

  return data;
}

/**
 * Send a message with quick reply buttons
 */
export async function sendMessengerQuickReply(recipientPsid, messageText, quickReplies) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not configured');
  }

  const response = await fetch(`${FB_GRAPH_URL}/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: {
        text: messageText,
        quick_replies: quickReplies.map(qr => ({
          content_type: 'text',
          title: qr.title,
          payload: qr.payload,
        })),
      },
      messaging_type: 'MESSAGE_TAG',
      tag: 'POST_PURCHASE_UPDATE',
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to send Messenger message');
  }

  return data;
}

/**
 * Send an order receipt template
 */
export async function sendMessengerReceipt(recipientPsid, order) {
  if (!FB_PAGE_ACCESS_TOKEN) {
    throw new Error('FB_PAGE_ACCESS_TOKEN not configured');
  }

  const response = await fetch(`${FB_GRAPH_URL}/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'receipt',
            recipient_name: order.customer_name,
            order_number: order.id,
            currency: 'PHP',
            payment_method: order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method,
            summary: {
              total_cost: order.total_amount,
            },
            elements: [
              {
                title: `${order.product_type} (${order.container_size})`,
                subtitle: `${order.quantity} refill(s)`,
                quantity: order.quantity,
                price: order.total_amount,
                currency: 'PHP',
              },
            ],
          },
        },
      },
      messaging_type: 'MESSAGE_TAG',
      tag: 'POST_PURCHASE_UPDATE',
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to send receipt');
  }

  return data;
}

/**
 * Verify webhook signature from Facebook
 */
export function verifyWebhookSignature(signature, payload, appSecret) {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return `sha256=${expectedSignature}` === signature;
}
