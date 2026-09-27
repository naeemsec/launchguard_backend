import { paddle } from '../../../../lib/paddle.js';
import { sql } from '../../../../lib/db.js';

export const runtime = 'nodejs';

const SUPPORTED_EVENTS = new Set([
  'subscription.created',
  'subscription.updated'
]);

function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function entitlementForStatus(status) {
  return ['active', 'trialing', 'past_due'].includes(status);
}

export async function POST(request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return new Response('Webhook secret is not configured.', { status: 503 });

  const signature = request.headers.get('paddle-signature') || '';
  const rawBody = await request.text();
  if (!signature) return new Response('Missing Paddle-Signature header.', { status: 400 });

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
  } catch {
    console.error('Rejected Paddle webhook: invalid signature.');
    return new Response('Invalid webhook signature.', { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(event.eventType)) {
    return Response.json({ ok: true, ignored: true, eventType: event.eventType });
  }

  const subscription = event.data;
  const firstItem = Array.isArray(subscription.items) ? subscription.items[0] : null;
  const priceId = stringOrNull(firstItem?.price?.id);
  const productId = stringOrNull(firstItem?.price?.productId);
  const installationId = stringOrNull(subscription.customData?.installation_id);
  const periodStart = stringOrNull(subscription.currentBillingPeriod?.startsAt);
  const periodEnd = stringOrNull(subscription.currentBillingPeriod?.endsAt);
  const entitled = entitlementForStatus(subscription.status);
  const scheduledChangeJson = JSON.stringify(subscription.scheduledChange ?? null);
  const customDataJson = JSON.stringify(subscription.customData ?? null);
  const occurredAt = event.occurredAt instanceof Date
    ? event.occurredAt.toISOString()
    : String(event.occurredAt);

  await sql`
    INSERT INTO paddle_subscriptions (
      subscription_id, customer_id, status, entitled, price_id, product_id,
      installation_id, current_period_start, current_period_end,
      scheduled_change, custom_data, last_event_id, event_occurred_at, updated_at
    )
    VALUES (
      ${subscription.id}, ${subscription.customerId}, ${subscription.status}, ${entitled},
      ${priceId}, ${productId}, ${installationId}, ${periodStart}, ${periodEnd},
      CAST(${scheduledChangeJson} AS jsonb), CAST(${customDataJson} AS jsonb),
      ${event.eventId}, ${occurredAt}, NOW()
    )
    ON CONFLICT (subscription_id)
    DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      status = EXCLUDED.status,
      entitled = EXCLUDED.entitled,
      price_id = EXCLUDED.price_id,
      product_id = EXCLUDED.product_id,
      installation_id = COALESCE(EXCLUDED.installation_id, paddle_subscriptions.installation_id),
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      scheduled_change = EXCLUDED.scheduled_change,
      custom_data = EXCLUDED.custom_data,
      last_event_id = EXCLUDED.last_event_id,
      event_occurred_at = EXCLUDED.event_occurred_at,
      updated_at = NOW()
    WHERE paddle_subscriptions.event_occurred_at <= EXCLUDED.event_occurred_at
  `;

  return Response.json({ ok: true, eventType: event.eventType });
}
