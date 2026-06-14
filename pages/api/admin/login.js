import { verifyPassword, createSessionToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Throttle brute-force attempts: 10 tries per IP per 5 minutes.
  const { allowed, retryAfter } = rateLimit(`login:${getClientIp(req)}`, 10, 5 * 60 * 1000);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  const { password } = req.body || {};
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = createSessionToken();
  if (!token) {
    return res.status(500).json({ error: 'Authentication not configured' });
  }

  return res.status(200).json({ token });
}
