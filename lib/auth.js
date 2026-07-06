import crypto from 'node:crypto';
import { initDb } from '@/lib/db';
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

// Shared lockout core: returns 'locked' | 'failed' | 'ok' and records
// failures / clears the counter on success.
async function checkLockout(req) {
  const sql = await initDb();
  const ip = getIp(req);

  const rows = await sql`
    SELECT count FROM auth_failures
    WHERE ip = ${ip}
      AND window_start > NOW() - INTERVAL '15 minutes'
  `;
  if ((rows[0]?.count ?? 0) >= LOCKOUT_MAX) return 'locked';

  if (!verifyAdmin(req)) {
    await sql`
      INSERT INTO auth_failures (ip, count, window_start)
      VALUES (${ip}, 1, NOW())
      ON CONFLICT (ip) DO UPDATE SET
        count = CASE
          WHEN auth_failures.window_start > NOW() - INTERVAL '15 minutes'
          THEN auth_failures.count + 1
          ELSE 1
        END,
        window_start = CASE
          WHEN auth_failures.window_start > NOW() - INTERVAL '15 minutes'
          THEN auth_failures.window_start
          ELSE NOW()
        END
    `;
    return 'failed';
  }

  await sql`DELETE FROM auth_failures WHERE ip = ${ip}`;
  return 'ok';
}

// Checks lockout, verifies admin password, records failures / clears on success.
// Returns false and sends a response if auth fails or is locked out.
export async function verifyAdminWithLockout(req, res) {
  const result = await checkLockout(req);
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
  return (await checkLockout(req)) === 'ok';
}
