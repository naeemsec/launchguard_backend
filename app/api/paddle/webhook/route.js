import { getPaddle } from '../../../../lib/paddle.js';
import { getSql } from '../../../../lib/db.js';

export const runtime = 'nodejs';

const SUPPORTED_EVENTS = new Set([
  'subscription.created',
  'subscription.updated'
]);

function stringOrNull(value) {
  return typeof value === 'string' && value.length > 0
    ? value
    : null;
}

function dateOrNull(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
}

function entitlementForStatus(status) {
  return [
    'active',
    'trialing',
    'past_due'
  ].includes(status);
}

export async function POST(request) {
  const webhookSecret =
    process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response(
      'Webhook secret is not configured.',
      {
        status: 503
      }
    );
  }

  const signature =
    request.headers.get('paddle-signature') || '';

  if (!signature) {
    return new Response(
      'Missing Paddle-Signature header.',
      {
        status: 400
      }
    );
  }

  /*
   * Important:
   * Signature verification must use the exact raw request body.
   */
  const rawBody = await request.text();

  let event;

  try {
    const paddle = getPaddle();

    event = await paddle.webhooks.unmarshal(
      rawBody,
      webhookSecret,
      signature
    );
  } catch (error) {
    console.error(
      'Rejected Paddle webhook:',
      error instanceof Error
        ? error.message
        : 'Unknown verification error'
    );

    return new Response(
      'Invalid webhook signature.',
      {
        status: 400
      }
    );
  }

  /*
   * Return success for valid Paddle events that LaunchGuard
   * does not currently need.
   */
  if (!SUPPORTED_EVENTS.has(event.eventType)) {
    return Response.json({
      ok: true,
      ignored: true,
      eventType: event.eventType
    });
  }

  const subscription = event.data;

  const firstItem =
    Array.isArray(subscription.items) &&
    subscription.items.length > 0
      ? subscription.items[0]
      : null;

  const priceId =
    stringOrNull(
      firstItem?.price?.id
    );

  const productId =
    stringOrNull(
      firstItem?.price?.productId
    );

  /*
   * Later the LaunchGuard checkout will send a random
   * installation ID through Paddle custom data.
   */
  const installationId =
    stringOrNull(
      subscription.customData?.installation_id
    );

  const periodStart =
    dateOrNull(
      subscription.currentBillingPeriod?.startsAt
    );

  const periodEnd =
    dateOrNull(
      subscription.currentBillingPeriod?.endsAt
    );

  const entitled =
    entitlementForStatus(
      subscription.status
    );

  const scheduledChangeJson =
    JSON.stringify(
      subscription.scheduledChange ?? null
    );

  const customDataJson =
    JSON.stringify(
      subscription.customData ?? null
    );

  const occurredAt =
    dateOrNull(event.occurredAt) ||
    new Date().toISOString();

  try {
    const sql = getSql();

    /*
     * Idempotent upsert:
     *
     * - duplicate Paddle events are safe
     * - an older webhook cannot overwrite newer state
     */
    await sql`
      INSERT INTO paddle_subscriptions (
        subscription_id,
        customer_id,
        status,
        entitled,
        price_id,
        product_id,
        installation_id,
        current_period_start,
        current_period_end,
        scheduled_change,
        custom_data,
        last_event_id,
        event_occurred_at,
        updated_at
      )
      VALUES (
        ${subscription.id},
        ${subscription.customerId},
        ${subscription.status},
        ${entitled},
        ${priceId},
        ${productId},
        ${installationId},
        ${periodStart},
        ${periodEnd},
        CAST(${scheduledChangeJson} AS jsonb),
        CAST(${customDataJson} AS jsonb),
        ${event.eventId},
        ${occurredAt},
        NOW()
      )

      ON CONFLICT (subscription_id)

      DO UPDATE SET
        customer_id =
          EXCLUDED.customer_id,

        status =
          EXCLUDED.status,

        entitled =
          EXCLUDED.entitled,

        price_id =
          EXCLUDED.price_id,

        product_id =
          EXCLUDED.product_id,

        installation_id =
          COALESCE(
            EXCLUDED.installation_id,
            paddle_subscriptions.installation_id
          ),

        current_period_start =
          EXCLUDED.current_period_start,

        current_period_end =
          EXCLUDED.current_period_end,

        scheduled_change =
          EXCLUDED.scheduled_change,

        custom_data =
          EXCLUDED.custom_data,

        last_event_id =
          EXCLUDED.last_event_id,

        event_occurred_at =
          EXCLUDED.event_occurred_at,

        updated_at =
          NOW()

      WHERE
        paddle_subscriptions.event_occurred_at
        <=
        EXCLUDED.event_occurred_at
    `;

    return Response.json({
      ok: true,
      eventType: event.eventType
    });

  } catch (error) {
    console.error(
      'Paddle webhook database error:',
      error instanceof Error
        ? error.message
        : 'Unknown database error'
    );

    return new Response(
      'Webhook processing failed.',
      {
        status: 500
      }
    );
  }
}