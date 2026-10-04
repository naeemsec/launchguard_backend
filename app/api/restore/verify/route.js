import {
  getSql
} from '../../../../lib/db.js';

import {
  getPaddle
} from '../../../../lib/paddle.js';

import {
  hashRestoreCode,
  matchingLaunchGuardItem,
  sameHex,
  statusCanRestore,
  statusGrantsPro,
  validInstallationId,
  validInstallationSecret,
  verifyInstallation
} from '../../../../lib/restore.js';


export const runtime =
  'nodejs';


function noStore(
  body,
  status = 200
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store'
      }
    }
  );
}


function validChallengeId(
  value
) {
  return (
    typeof value === 'string' &&
    /^rst_[a-f0-9]{48}$/
      .test(value)
  );
}


function validCode(
  value
) {
  return (
    typeof value === 'string' &&
    /^\d{6}$/
      .test(value)
  );
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
    return value.toISOString();
  }

  if (
    typeof value === 'string'
  ) {
    return value;
  }

  return null;
}


export async function POST(
  request
) {
  let body;

  try {
    body =
      await request.json();
  } catch {
    return noStore(
      {
        error:
          'Invalid JSON body.'
      },
      400
    );
  }


  const installationId =
    body?.installationId;

  const installationSecret =
    body?.installationSecret;

  const challengeId =
    String(
      body?.challengeId || ''
    ).trim();

  const code =
    String(
      body?.code || ''
    )
      .replace(/\s+/g, '');


  if (
    !validInstallationId(
      installationId
    ) ||
    !validInstallationSecret(
      installationSecret
    ) ||
    !validChallengeId(
      challengeId
    ) ||
    !validCode(
      code
    )
  ) {
    return noStore(
      {
        error:
          'Invalid restore verification request.'
      },
      400
    );
  }


  try {
    const sql =
      getSql();


    const installationVerified =
      await verifyInstallation(
        sql,
        installationId,
        installationSecret
      );


    if (!installationVerified) {
      return noStore(
        {
          error:
            'Installation verification failed.'
        },
        401
      );
    }


    /*
     * Increment attempts atomically. A challenge can be tried at most five
     * times, must belong to this installation, must be unconsumed, and must
     * still be within its 10-minute lifetime.
     */
    const challenges =
      await sql`
        UPDATE
          restore_challenges

        SET
          attempts =
            attempts + 1

        WHERE
          challenge_id =
            ${challengeId}
          AND installation_id =
            ${installationId}
          AND consumed_at IS NULL
          AND expires_at >
            NOW()
          AND attempts < 5

        RETURNING
          customer_id,
          subscription_id,
          otp_hash,
          attempts
      `;


    if (
      challenges.length !== 1
    ) {
      return noStore(
        {
          error:
            'Restore code is expired, invalid, or has reached its attempt limit.'
        },
        400
      );
    }


    const challenge =
      challenges[0];


    const suppliedHash =
      hashRestoreCode(
        challengeId,
        code
      );


    if (
      !sameHex(
        challenge.otp_hash,
        suppliedHash
      )
    ) {
      return noStore(
        {
          error:
            'Restore code is incorrect.'
        },
        401
      );
    }


    if (
      !/^ctm_[a-z0-9]{26}$/i
        .test(
          String(
            challenge.customer_id || ''
          )
        ) ||
      !/^sub_[a-z0-9]{26}$/i
        .test(
          String(
            challenge.subscription_id || ''
          )
        )
    ) {
      return noStore(
        {
          error:
            'No eligible LaunchGuard subscription was found for this restore request.'
        },
        404
      );
    }


    const paddle =
      getPaddle();


    const subscription =
      await paddle.subscriptions.get(
        challenge.subscription_id
      );


    if (
      subscription?.customerId !==
        challenge.customer_id ||
      !statusCanRestore(
        subscription?.status
      )
    ) {
      return noStore(
        {
          error:
            'This subscription is no longer eligible for restore.'
        },
        409
      );
    }


    const matchedItem =
      matchingLaunchGuardItem(
        subscription
      );


    if (!matchedItem) {
      return noStore(
        {
          error:
            'This subscription does not contain LaunchGuard Pro.'
        },
        409
      );
    }


    const existingCustomData =
      subscription.customData &&
      typeof subscription.customData === 'object' &&
      !Array.isArray(
        subscription.customData
      )
        ? subscription.customData
        : {};


    /*
     * Make Paddle itself authoritative for the new installation binding.
     * Future subscription webhooks therefore carry the restored ID too.
     */
    const updatedSubscription =
      await paddle.subscriptions.update(
        subscription.id,
        {
          customData: {
            ...existingCustomData,
            installation_id:
              installationId
          }
        }
      );


    const effectiveSubscription =
      updatedSubscription ||
      subscription;

    const effectiveItem =
      matchingLaunchGuardItem(
        effectiveSubscription
      ) ||
      matchedItem;

    const periodStart =
      dateOrNull(
        effectiveSubscription
          ?.currentBillingPeriod
          ?.startsAt
      );

    const periodEnd =
      dateOrNull(
        effectiveSubscription
          ?.currentBillingPeriod
          ?.endsAt
      );

    const scheduledChangeJson =
      JSON.stringify(
        effectiveSubscription
          ?.scheduledChange ??
        null
      );

    const mergedCustomDataJson =
      JSON.stringify({
        ...existingCustomData,
        ...(effectiveSubscription?.customData || {}),
        installation_id:
          installationId
      });

    const entitled =
      Boolean(
        effectiveItem &&
        statusGrantsPro(
          effectiveSubscription.status
        )
      );


    /*
     * Immediate local DB rebind means the new installation can validate
     * without waiting for Paddle's subscription.updated webhook. The webhook
     * remains the long-term source of subscription lifecycle changes.
     */
    await sql`
      UPDATE
        paddle_subscriptions

      SET
        customer_id =
          ${effectiveSubscription.customerId},

        status =
          ${effectiveSubscription.status},

        entitled =
          ${entitled},

        price_id =
          ${effectiveItem?.price?.id || null},

        product_id =
          ${effectiveItem?.price?.productId || null},

        installation_id =
          ${installationId},

        current_period_start =
          ${periodStart},

        current_period_end =
          ${periodEnd},

        scheduled_change =
          CAST(
            ${scheduledChangeJson}
            AS jsonb
          ),

        custom_data =
          CAST(
            ${mergedCustomDataJson}
            AS jsonb
          ),

        updated_at =
          NOW()

      WHERE
        subscription_id =
          ${challenge.subscription_id}
        AND customer_id =
          ${challenge.customer_id}
    `;


    await sql`
      UPDATE
        restore_challenges

      SET
        consumed_at =
          NOW()

      WHERE
        challenge_id =
          ${challengeId}
        AND installation_id =
          ${installationId}
    `;


    await sql`
      DELETE FROM
        restore_challenges

      WHERE
        installation_id =
          ${installationId}
        AND challenge_id <>
          ${challengeId}
        AND consumed_at IS NULL
    `;


    return noStore({
      ok: true,
      restored: true,
      entitled,
      status:
        effectiveSubscription.status
    });

  } catch (error) {
    console.error(
      'Restore verification error:',
      error instanceof Error
        ? error.message
        : 'Unknown restore verification error'
    );


    return noStore(
      {
        error:
          'Unable to complete subscription restore.'
      },
      500
    );
  }
}
