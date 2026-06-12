// Shared admin auth check for API routes. Matches the existing
// password-header convention used by /api/orders.
export function requireAdmin(req, res) {
  const { password } = req.headers;
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
