// Facebook Messenger Webhook
// Receives messages and stores customer PSID for notifications
import { initDb } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/facebook';

export const config = {
  api: { bodyParser: false },
};

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!VERIFY_TOKEN) {
      console.error('FB_VERIFY_TOKEN not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Messenger webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  if (req.method === 'POST') {
    const rawBody = await readRawBody(req);
    const appSecret = process.env.FB_APP_SECRET;

    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature || !verifyWebhookSignature(signature, rawBody, appSecret)) {
        return res.status(403).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('FB_APP_SECRET not set — webhook signature verification is disabled');
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    if (body.object !== 'page') {
      return res.status(404).json({ error: 'Not a page event' });
    }

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderPsid = event.sender?.id;
        if (!senderPsid) continue;
        if (event.message?.text) {
          await handleMessage(senderPsid, event.message.text);
        }
        if (event.postback?.payload) {
          await handlePostback(senderPsid, event.postback.payload);
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleMessage(senderPsid, messageText) {
  const text = messageText.toLowerCase().trim();

  const orderIdMatch = text.match(/^[a-z0-9]{8}$/i);
  if (orderIdMatch) {
    await linkPsidToOrder(senderPsid, orderIdMatch[0].toUpperCase());
    return;
  }

  const phoneMatch = text.match(/09\d{9}/);
  if (phoneMatch) {
    await linkPsidToPhone(senderPsid, phoneMatch[0]);
    return;
  }

  await sendReply(senderPsid,
    `👋 Hi! I'm the Clear Flow assistant.\n\n` +
    `To receive order updates via Messenger, please send me:\n` +
    `• Your Order ID (e.g., A1B2C3D4), or\n` +
    `• Your phone number (e.g., 09123456789)\n\n` +
    `You can also visit our website to place a new order! 💧`
  );
}

async function handlePostback(senderPsid, payload) {
  if (payload === 'GET_STARTED') {
    await sendReply(senderPsid,
      `👋 Welcome to Clear Flow!\n\n` +
      `We deliver fresh purified water right to your door.\n\n` +
      `To link your account for order notifications, send me your Order ID or phone number.\n\n` +
      `Questions? Just type your message and we'll get back to you! 💧`
    );
  }
}

async function linkPsidToOrder(senderPsid, orderId) {
  try {
    const sql = await initDb();

    // Only link if no PSID is already set — prevents hijacking of existing links
    const result = await sql`
      UPDATE orders
      SET messenger_psid = ${senderPsid}
      WHERE id = ${orderId} AND messenger_psid IS NULL
      RETURNING customer_name, status
    `;

    if (result.length > 0) {
      const order = result[0];
      await sendReply(senderPsid,
        `✅ Linked! Hi ${order.customer_name}!\n\n` +
        `Your order #${orderId} is currently: ${formatStatus(order.status)}\n\n` +
        `You'll receive updates here when your order status changes. 📱`
      );
    } else {
      // Either order not found or already linked
      const exists = await sql`SELECT id FROM orders WHERE id = ${orderId}`;
      if (exists.length > 0) {
        await sendReply(senderPsid,
          `ℹ️ Order #${orderId} already has Messenger notifications linked.\n\n` +
          `If you need to update this, please contact us directly.`
        );
      } else {
        await sendReply(senderPsid,
          `❌ Sorry, I couldn't find order #${orderId}.\n\n` +
          `Please check the Order ID and try again, or send your phone number instead.`
        );
      }
    }
  } catch (error) {
    console.error('Error linking PSID to order:', error);
  }
}

async function linkPsidToPhone(senderPsid, phone) {
  try {
    const sql = await initDb();

    const result = await sql`
      UPDATE orders
      SET messenger_psid = ${senderPsid}
      WHERE (phone = ${phone} OR phone = ${formatPhone(phone)})
      AND messenger_psid IS NULL
      RETURNING id, customer_name, status
    `;

    if (result.length > 0) {
      const order = result[0];
      await sendReply(senderPsid,
        `✅ Linked! Hi ${order.customer_name}!\n\n` +
        `Found ${result.length} order(s) with this phone number.\n` +
        `Latest order #${order.id}: ${formatStatus(order.status)}\n\n` +
        `You'll receive updates here for all future orders! 📱`
      );
    } else {
      await sendReply(senderPsid,
        `I couldn't find any unlinked orders for ${phone}.\n\n` +
        `If you have an order, please send your Order ID directly, or contact us for help. 💧`
      );
    }
  } catch (error) {
    console.error('Error linking PSID to phone:', error);
  }
}

function formatPhone(phone) {
  if (phone.length === 11 && phone.startsWith('09')) {
    return `${phone.slice(0, 4)}-${phone.slice(4, 7)}-${phone.slice(7)}`;
  }
  return phone;
}

function formatStatus(status) {
  const labels = {
    pending: '⏳ Pending',
    confirmed: '✅ Confirmed',
    out_for_delivery: '🛵 Out for Delivery',
    delivered: '🎉 Delivered',
    cancelled: '❌ Cancelled',
  };
  return labels[status] || status;
}

async function sendReply(recipientPsid, messageText) {
  const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!FB_PAGE_ACCESS_TOKEN) {
    console.log('FB_PAGE_ACCESS_TOKEN not set, skipping reply');
    return;
  }

  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: messageText },
        messaging_type: 'RESPONSE',
      }),
    });
  } catch (error) {
    console.error('Error sending Messenger reply:', error);
  }
}
