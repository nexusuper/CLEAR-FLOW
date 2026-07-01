// Server-only crypto helpers for loyalty reward codes. Do NOT import in client code.
import crypto from 'node:crypto';

export const CODE_TTL_MINUTES = 10;
export const CODE_MAX_ATTEMPTS = 5;

export function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashCode(phone, code) {
  const secret = process.env.REWARD_CODE_SECRET;
  if (!secret) throw new Error('REWARD_CODE_SECRET not configured');
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}
