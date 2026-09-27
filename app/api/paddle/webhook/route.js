// ==================================
// app/api/paddle/webhook/route.js
// // ==================================
import {
  getPaddle
} from '../../../../lib/paddle.js';

import {
  getSql
} from '../../../../lib/db.js';


export const runtime =
  'nodejs';


const SUPPORTED_EVENTS =
  new Set([
    'transaction.completed',
    'subscription.created',
    'subscription.updated',
    'subscription.canceled'
  ]);


function stringOrNull(
  value
) {
  return (
    typeof value ===
      'string' &&
    value.length > 0
  )
    ? value
    : null;
}


function dateOrNull(
  value
) {
  if (!value) {
    return null;
  }


  if (
    value instanceof Date
  ) {
    return value
      .toISOString();
  }


  if (
    typeof value ===
      'string'
  ) {
    return value;
  }


  return null;
}


function validInstallationId(
  value
) {
  return (
    typeof value ===
      'string' &&
    /^lg_[a-f0-9]{64}$/
      .test(value)
  );
}


function allowedPriceIds() {
  const ids =
    [
      process.env
        .NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID,

      process.env
        .NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID
    ]
      .filter(
        value =>
          /^pri_[a-z0-9]+$/i
            .test(
              String(
                value || ''
              )
            )
      );


  if (
    ids.length !== 2
  ) {
    throw new Error(
      'LaunchGuard Paddle prices are not configured.'
    );
  }


  return new Set(ids);
}


function entitlementForStatus(
  status
) {
  /*
   * Strict access policy.
   *
   * No Pro while past_due.
   */
  return (
    status === 'active' ||
    status === 'trialing'
  );
}


export async function POST(
  request
) {
  const webhookSecret =
    process.env
      .PADDLE_WEBHOOK_SECRET;


  if (!webhookSecret) {
    return new Response(
      'Webhook secret is not configured.',
      {
        status: 503
      }
    );
  }


  const signature =
    request.headers.get(
      'paddle-signature'
    ) || '';


  if (!signature) {
    return new Response(
      'Missing Paddle-Signature header.',
      {
        status: 400
      }
    );
  }


  /*
   * Signature verification needs the exact raw body.
   */
  const rawBody =
    await request.text();


  let event;


  try {
    const paddle =
      getPaddle();


    event =
      await paddle.webhooks
        .unmarshal(
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


  if (
    !SUPPORTED_EVENTS.has(
      event.eventType
    )
  ) {
    return Response.json({
      ok: true,
      ignored: true,
      eventType:
        event.eventType
    });
  }


  if (
    event.eventType ===
      'transaction.completed'
  ) {
    return Response.json({
      ok: true,
      eventType:
        event.eventType
    });
  }


  const subscription =
    event.data;


  const allowedPrices =
    allowedPriceIds();


  const items =
    Array.isArray(
      subscription.items
    )
      ? subscription.items
      : [];


  /*
   * Only LaunchGuard Pro's configured monthly/annual
   * Paddle prices are allowed to grant entitlement.
   */
  const matchedItem =
    items.find(
      item =>
        allowedPrices.has(
          item?.price?.id
        )
    ) || null;


  const priceId =
    stringOrNull(
      matchedItem
        ?.price
        ?.id
    );


  const productId =
    stringOrNull(
      matchedItem
        ?.price
        ?.productId
    );


  const requestedInstallationId =
    stringOrNull(
      subscription
        .customData
        ?.installation_id
    );


  const installationId =
    validInstallationId(
      requestedInstallationId
    )
      ? requestedInstallationId
      : null;


  const periodStart =
    dateOrNull(
      subscription
        .currentBillingPeriod
        ?.startsAt
    );


  const periodEnd =
    dateOrNull(
      subscription
        .currentBillingPeriod
        ?.endsAt
    );


  const scheduledChangeJson =
    JSON.stringify(
      subscription
        .scheduledChange ??
      null
    );


  const customDataJson =
    JSON.stringify(
      subscription
        .customData ??
      null
    );


  const occurredAt =
    dateOrNull(
      event.occurredAt
    ) ||
    new Date()
      .toISOString();


  try {
    const sql =
      getSql();


    /*
     * Paddle custom data alone is NOT enough.
     *
     * The installation must have registered its private
     * secret with our backend before checkout.
     */
    let registered =
      false;


    if (
      installationId
    ) {
      const registrations =
        await sql`
          SELECT
            installation_id

          FROM
            installation_registrations

          WHERE
            installation_id =
            ${installationId}

          LIMIT 1
        `;


      registered =
        registrations.length ===
        1;
    }


    const entitled =
      Boolean(
        matchedItem &&
        installationId &&
        registered &&
        entitlementForStatus(
          subscription.status
        )
      );


    await sql`
      INSERT INTO
        paddle_subscriptions (
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
        CAST(
          ${scheduledChangeJson}
          AS jsonb
        ),
        CAST(
          ${customDataJson}
          AS jsonb
        ),
        ${event.eventId},
        ${occurredAt},
        NOW()
      )

      ON CONFLICT (
        subscription_id
      )

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
            paddle_subscriptions
              .installation_id
          ),

        current_period_start =
          EXCLUDED
            .current_period_start,

        current_period_end =
          EXCLUDED
            .current_period_end,

        scheduled_change =
          EXCLUDED
            .scheduled_change,

        custom_data =
          EXCLUDED
            .custom_data,

        last_event_id =
          EXCLUDED
            .last_event_id,

        event_occurred_at =
          EXCLUDED
            .event_occurred_at,

        updated_at =
          NOW()

      WHERE
        paddle_subscriptions
          .event_occurred_at
        <=
        EXCLUDED
          .event_occurred_at
    `;


    return Response.json({
      ok: true,

      eventType:
        event.eventType,

      status:
        subscription.status,

      entitled
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