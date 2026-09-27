import { sql } from '../../../lib/db.js';

export const runtime = 'nodejs';

function validInstallationId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const installationId = body?.installationId;
  if (!validInstallationId(installationId)) {
    return Response.json({ error: 'Invalid installation ID.' }, { status: 400 });
  }

  const rows = await sql`
    SELECT status, entitled, price_id, product_id, current_period_end, event_occurred_at
    FROM paddle_subscriptions
    WHERE installation_id = ${installationId}
    ORDER BY event_occurred_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return Response.json({ entitled: false, status: 'not_found' }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  const row = rows[0];
  return Response.json({
    entitled: Boolean(row.entitled),
    status: row.status,
    priceId: row.price_id,
    productId: row.product_id,
    currentPeriodEnd: row.current_period_end
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
