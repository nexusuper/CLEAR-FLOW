import { initDb } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { computeSegment, SEGMENT_VALUES } from '@/lib/segments';

const adminRate = rateLimit({ windowMs: 60_000, max: 3 });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!adminRate(req, res)) return;
  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let sql;
  try {
    sql = await initDb();
  } catch (err) {
    console.error('DB init failed:', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }

  try {
    const search = (req.query.search || '').trim();
    const tagFilter = (req.query.tag || '').trim();
    const segmentFilter = (req.query.segment || '').trim();
    const sortParam = req.query.sort || 'last_order_desc';

    const hasSearch = search.length > 0;
    const escSearch = search.replace(/[%_\\]/g, '\\$&');
    const searchPattern = `%${escSearch}%`;
    const hasTag = tagFilter.length > 0;
    const escTag = tagFilter.replace(/[%_\\]/g, '\\$&');
    const tagPattern = `%${escTag}%`;
    const hasSegment = segmentFilter.length > 0 && SEGMENT_VALUES.has(segmentFilter);

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

    let rows;
    if (hasSearch && hasTag) {
      rows = await sql`
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
        WHERE (o.customer_name ILIKE ${searchPattern} OR o.phone ILIKE ${searchPattern})
          AND EXISTS (SELECT 1 FROM customer_notes cn WHERE cn.phone_normalized = o.phone_normalized AND cn.tags ILIKE ${tagPattern})
        GROUP BY o.phone_normalized
        ORDER BY ${orderBy}
        LIMIT 10000
      `;
    } else if (hasSearch) {
      rows = await sql`
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
        WHERE o.customer_name ILIKE ${searchPattern} OR o.phone ILIKE ${searchPattern}
        GROUP BY o.phone_normalized
        ORDER BY ${orderBy}
        LIMIT 10000
      `;
    } else if (hasTag) {
      rows = await sql`
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
        WHERE EXISTS (SELECT 1 FROM customer_notes cn WHERE cn.phone_normalized = o.phone_normalized AND cn.tags ILIKE ${tagPattern})
        GROUP BY o.phone_normalized
        ORDER BY ${orderBy}
        LIMIT 10000
      `;
    } else {
      rows = await sql`
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
        GROUP BY o.phone_normalized
        ORDER BY ${orderBy}
        LIMIT 10000
      `;
    }

    let customers = rows.map((r) => ({
      ...r,
      segment: computeSegment({
        total_orders: Number(r.total_orders),
        total_spent: Number(r.total_spent),
        last_order: r.last_order,
      }),
    }));

    if (hasSegment) {
      customers = customers.filter((c) => c.segment === segmentFilter);
    }

    return res.status(200).json({ customers });
  } catch (err) {
    console.error('Customer export query failed:', err);
    return res.status(500).json({ error: 'Failed to export customers' });
  }
}
