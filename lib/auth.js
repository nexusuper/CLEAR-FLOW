import crypto from 'node:crypto';

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
