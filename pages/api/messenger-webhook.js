// Facebook Messenger Webhook
// Receives messages and stores customer PSID for notifications
import { initDb } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/facebook';
import { timingSafeEqual } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const checkRate = rateLimit({ windowMs: 60_000, max: 60 });

export const config = { api: { bodyParser: false } };

const MAX_BODY_SIZE = 1024 * 256;

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (!checkRate(req, res)) return;

  // Webhook verification (GET request from Facebook)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && VERIFY_TOKEN && timingSafeEqual(token, VERIFY_TOKEN)) {
      return res.status(200).type('text/plain').send(String(challenge).replace(/[^0-9]/g, ''));
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // Incoming messages (POST request)
  if (req.method === 'POST') {
    let raw;
    try {
      raw = await rawBody(req);
    } catch {
      return res.status(413).json({ error: 'Payload too large' });
    }
    const appSecret = process.env.FB_APP_SECRET;
    if (!appSecret) {
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    const sig = req.headers['x-hub-signature-256'];
    if (!verifyWebhookSignature(sig, raw, appSecret)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    let body;
    try { body = JSON.parse(raw.toString()); } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    if (body.object !== 'page') {
      return res.status(404).json({ error: 'Not a page event' });
    }

    // Process each entry
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderPsid = event.sender?.id;

        if (event.message?.text) {
          await handleMessage(senderPsid, event.message.text);
        }

        if (event.postback?.payload) {
          await handlePostback(senderPsid, event.postback.payload);
        }
      }
    }

    // Always return 200 quickly to Facebook
    return res.status(200).json({ status: 'ok' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleMessage(senderPsid, messageText) {
  const text = messageText.trim();

  // Only Order ID linkage is supported (8-char alphanumeric)
  const orderIdMatch = text.match(/^[a-z0-9]{8}$/i);
  if (orderIdMatch) {
    await linkPsidToOrder(senderPsid, orderIdMatch[0].toUpperCase());
    return;
  }

  // Fallback: guide customer to use their Order ID
  await sendReply(senderPsid,
    `👋 Hi! I'm the Clear Flow assistant.\n\n` +
    `To receive order updates here, send me your Order ID (e.g., A1B2C3D4).\n\n` +
    `You can find your Order ID on your order confirmation page, or look it up at our website using your phone number. 💧`
  );
}

async function handlePostback(senderPsid, payload) {
  if (payload === 'GET_STARTED') {
    await sendReply(senderPsid,
      `👋 Welcome to Clear Flow!\n\n` +
      `We deliver fresh purified water right to your door.\n\n` +
      `To get order updates here, send me your Order ID (e.g., A1B2C3D4). You can find it on your confirmation page after placing an order.\n\n` +
      `Questions? Just type your message and we'll get back to you! 💧`
    );
  }
}

async function linkPsidToOrder(senderPsid, orderId) {
  try {
    const sql = await initDb();

    // Only orders still in-flight and created recently can be linked — closes
    // the window where a stale/completed order ID (e.g. from an old screenshot)
    // could be used by a stranger to bind their Messenger to someone else's order.
    const result = await sql`
      UPDATE orders
      SET messenger_psid = ${senderPsid}
      WHERE id = ${orderId} AND messenger_psid IS NULL
        AND status NOT IN ('delivered', 'cancelled')
        AND created_at > ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}
      RETURNING customer_name, status
    `;

    if (result.length > 0) {
      const order = result[0];
      await sendReply(senderPsid,
        `✅ Found it! Hi ${order.customer_name}!\n\n` +
        `Your order #${orderId} is currently: ${formatStatus(order.status)}\n\n` +
        `You'll receive updates here when your order status changes. 📱`
      );
    } else {
      await sendReply(senderPsid,
        `❌ Sorry, I couldn't find order #${orderId}.\n\n` +
        `Please double-check the Order ID from your confirmation page and try again.`
      );
    }
  } catch (error) {
    console.error('Error linking PSID to order:', error);
  }
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
    await fetch('https://graph.facebook.com/v18.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FB_PAGE_ACCESS_TOKEN}` },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text: messageText },
      }),
    });
  } catch (error) {
    console.error('Error sending Messenger reply:', error);
  }
}
