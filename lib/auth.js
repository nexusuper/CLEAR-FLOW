import { timingSafeEqual } from 'crypto';

export function checkAdminAuth(req) {
  const provided = req.headers.password;
  const expected = process.env.ADMIN_PASSWORD;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
