import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Constant-time comparison of the supplied admin password against ADMIN_PASSWORD.
export function verifyPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!password || !expected) return false;
  return safeEqual(password, expected);
}

function sign(payloadB64) {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
}

// Issue a signed, expiring session token. Payload carries only an expiry timestamp.
export function createSessionToken(ttlMs = TOKEN_TTL_MS) {
  const secret = getSecret();
  if (!secret) return null;
  const payload = JSON.stringify({ exp: Date.now() + ttlMs });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !getSecret()) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;
  if (!safeEqual(sig, sign(payloadB64))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}

// True when the request carries a valid `Authorization: Bearer <token>` session.
export function requireAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return verifyToken(token);
}
