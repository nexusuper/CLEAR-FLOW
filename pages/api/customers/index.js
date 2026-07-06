import { initDb } from '@/lib/db';
import { verifyAdminWithLockout } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { computeSegment, SEGMENT_VALUES } from '@/lib/segments';

const adminRate = rateLimit({ windowMs: 60_000, max: 30 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!await verifyAdminWithLockout(req, res)) return;

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const tagFilter = (req.query.tag || '').trim();
    const sortParam = req.query.sort || 'last_order_desc';
    const segmentFilter = (req.query.segment || '').trim();
    const hasSegment = segmentFilter.length > 0 && SEGMENT_VALUES.has(segmentFilter);

    const hasSearch = search.length > 0;
    const escSearch = search.replace(/[%_\\]/g, '\\$&');
    const searchPattern = `%${escSearch}%`;
    const hasTag = tagFilter.length > 0;
    const escTag = tagFilter.replace(/[%_\\]/g, '\\$&');
    const tagPattern = `%${escTag}%`;

    // Neon tagged templates build ORDER BY with sql`` fragments
    const sortMap = {
      last_order_desc: sql`last_order DESC`,
      last_order_asc: sql`last_order ASC`,
      total_spent_desc: sql`total_spent DESC`,
      total_spent_asc: sql`total_spent ASC`,
      total_orders_desc: sql`total_orders DESC`,
      total_orders_asc: sql`total_orders ASC`,
      name_asc: sql`customer_name ASC`,
      name_desc: sql`customer_name DESC`,
    };
    const orderBy = sortMap[sortParam] || sql`last_order DESC`;

    const conditions = [];
    if (hasSearch) {
      conditions.push(sql`(o.customer_name ILIKE ${searchPattern} OR o.phone ILIKE ${searchPattern})`);
    }
    if (hasTag) {
      conditions.push(sql`EXISTS (SELECT 1 FROM customer_notes cn WHERE cn.phone_normalized = o.phone_normalized AND cn.tags ILIKE ${tagPattern})`);
    }
    const where = conditions.length
      ? conditions.slice(1).reduce((acc, c) => sql`${acc} AND ${c}`, sql`WHERE ${conditions[0]}`)
      : sql``;

    const selectCustomers = (limitClause) => sql`
      SELECT
        o.phone_normalized,
        MAX(o.customer_name) AS customer_name,
        COUNT(*)::int AS total_orders,
        SUM(o.total_amount)::real AS total_spent,
        MIN(o.created_at) AS first_order,
        MAX(o.created_at) AS last_order,
        BOOL_OR(o.messenger_psid IS NOT NULL) AS has_messenger,
        COALESCE((SELECT string_agg(DISTINCT cn.tags, ',') FROM customer_notes cn WHERE cn.phone_normalized = o.phone_normalized), '') AS tags
      FROM orders o
      ${where}
      GROUP BY o.phone_normalized
      ORDER BY ${orderBy}
      ${limitClause}
    `;

    const addSegment = (r) => ({
      ...r,
      segment: computeSegment({
        total_orders: Number(r.total_orders),
        total_spent: Number(r.total_spent),
        last_order: r.last_order,
      }),
    });

    if (hasSegment) {
      // ponytail: segment computed in JS (lib/segments.js), so fetch all matching
      // rows and paginate in memory; move to SQL if the customer list gets large
      const allRows = await selectCustomers(sql``);
      const filtered = allRows.map(addSegment).filter((r) => r.segment === segmentFilter);
      const total = filtered.length;
      return res.status(200).json({
        customers: filtered.slice(offset, offset + limit),
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      });
    }

    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM (
        SELECT o.phone_normalized FROM orders o
        ${where}
        GROUP BY o.phone_normalized
      ) sub
    `;
    const rows = await selectCustomers(sql`LIMIT ${limit} OFFSET ${offset}`);
    const total = countResult[0]?.total ?? 0;
    return res.status(200).json({
      customers: rows.map(addSegment),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error('Customer list query failed:', err);
    return res.status(500).json({ error: 'Failed to load customers' });
  }
}
