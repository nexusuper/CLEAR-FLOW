import crypto from 'node:crypto';
import { getIp } from '@/lib/rate-limit';

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdmin(req) {
  const password = req.headers['password'];
  const expected = process.env.ADMIN_PASSWORD;
  if (!password || !expected) return false;
  return timingSafeEqual(password, expected);
}

const LOCKOUT_MAX = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

// In-memory per-IP lockout, same windowed-counter shape as lib/rate-limit.js.
// ponytail: state resets on cold start / isn't shared across instances — same
// accepted tradeoff lib/rate-limit.js already documents for this deployment.
const failures = new Map();

function checkLockout(req) {
  const ip = getIp(req);
  const now = Date.now();
  let entry = failures.get(ip);
  if (entry && now - entry.windowStart > LOCKOUT_WINDOW_MS) entry = undefined;

  if (entry && entry.count >= LOCKOUT_MAX) return 'locked';

  if (!verifyAdmin(req)) {
    if (!entry) entry = { count: 0, windowStart: now };
    entry.count += 1;
    failures.set(ip, entry);
    return 'failed';
  }

  failures.delete(ip);
  return 'ok';
}

// Checks lockout, verifies admin password, records failures / clears on success.
// Returns false and sends a response if auth fails or is locked out.
export async function verifyAdminWithLockout(req, res) {
  const result = checkLockout(req);
  if (result === 'locked') {
    res.setHeader('Retry-After', '900');
    res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    return false;
  }
  if (result === 'failed') {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// For routes where a missing password just means a public request (e.g. order
// tracking): only requests that present a password header count toward, or are
// blocked by, the lockout. Never sends a response — returns false for
// non-admin, locked-out, or wrong-password requests alike.
export async function verifyAdminSoftLockout(req) {
  if (!req.headers['password']) return false;
  return checkLockout(req) === 'ok';
}
