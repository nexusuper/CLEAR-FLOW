// Best-effort in-memory rate limiter.
// NOTE: In serverless deployments each warm instance keeps its own counters, so
// this throttles abuse within an instance but is not a global guarantee. For
// strict limits across instances, back this with a shared store (e.g. Redis/Upstash).

const buckets = new Map();

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Returns { allowed, retryAfter } where retryAfter is seconds until the window resets.
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}
