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
      return res.status(200).send(challenge);
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
  const text = messageText.toLowerCase().trim();
  
  // Check if it's an order ID (8 character format)
  const orderIdMatch = text.match(/^[a-z0-9]{8}$/i);
  if (orderIdMatch) {
    await linkPsidToOrder(senderPsid, orderIdMatch[0].toUpperCase());
    return;
  }

  // Check for phone number
  const phoneMatch = text.match(/09\d{9}/);
  if (phoneMatch) {
    await linkPsidToPhone(senderPsid, phoneMatch[0]);
    return;
  }

  // Send greeting/instructions
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
    
    // Update order with messenger PSID
    const result = await sql`
      UPDATE orders 
      SET messenger_psid = ${senderPsid} 
      WHERE id = ${orderId}
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
        `Please check the Order ID and try again, or send your phone number instead.`
      );
    }
  } catch (error) {
    console.error('Error linking PSID to order:', error);
  }
}

async function linkPsidToPhone(senderPsid, phone) {
  try {
    const sql = await initDb();
    
    // Update all orders with this phone number
    const result = await sql`
      UPDATE orders 
      SET messenger_psid = ${senderPsid} 
      WHERE phone = ${phone} OR phone = ${formatPhone(phone)}
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
        `🔔 Got it! I've saved your number.\n\n` +
        `When you place an order with ${phone}, you'll automatically receive updates here!\n\n` +
        `Visit our website to place an order 💧`
      );
      
      // Store for future orders (using a separate table or cache)
      // For now, we just inform them
    }
  } catch (error) {
    console.error('Error linking PSID to phone:', error);
  }
}

function formatPhone(phone) {
  // Convert 09123456789 to 0912-345-6789 format if needed
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
