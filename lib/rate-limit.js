// NOTE: In-memory rate limiter — state is not shared across concurrent Vercel
// function instances (each cold start gets its own Map). For a global limiter,
// use @upstash/ratelimit backed by Upstash Redis (Vercel Marketplace, free tier).
// Admin brute-force is handled separately by verifyAdminWithLockout in lib/auth.js.
const hits = new Map();

const CLEANUP_INTERVAL = 60_000;
let cleanupTimer;

function scheduleCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.start > entry.window) hits.delete(key);
    }
    if (hits.size === 0) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

export function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  return function check(req, res) {
    const ip =
      req.headers['x-real-ip'] ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    const route = req.url?.split('?')[0] || '/';
    const key = `${ip}:${route}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now, window: windowMs };
      hits.set(key, entry);
      scheduleCleanup();
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return false;
    }
    return true;
  };
}
