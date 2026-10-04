// ==================================
// app/api/entitlement/route.js
// // ==================================
import {
  createHmac,
  timingSafeEqual
} from 'node:crypto';

import {
  getSql
} from '../../../lib/db.js';


export const runtime =
  'nodejs';


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


function validInstallationSecret(
  value
) {
  return (
    typeof value ===
      'string' &&
    /^[a-f0-9]{64}$/
      .test(value)
  );
}


function hashSecret(
  secret
) {
  const key =
    process.env
      .INSTALLATION_HMAC_KEY;


  if (
    typeof key !==
      'string' ||
    key.length < 32
  ) {
    throw Error(
      'INSTALLATION_HMAC_KEY is not configured.'
    );
  }


  return createHmac(
    'sha256',
    key
  )
    .update(
      secret,
      'utf8'
    )
    .digest(
      'hex'
    );
}


function sameHash(
  first,
  second
) {
  if (
    typeof first !==
      'string' ||
    typeof second !==
      'string' ||
    first.length !==
      second.length
  ) {
    return false;
  }


  const a =
    Buffer.from(
      first,
      'hex'
    );


  const b =
    Buffer.from(
      second,
      'hex'
    );


  if (
    a.length !==
      b.length
  ) {
    return false;
  }


  return timingSafeEqual(
    a,
    b
  );
}


function paddlePrices() {
  const monthly =
    process.env
      .NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID;


  const annual =
    process.env
      .NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID;


  if (
    !/^pri_[a-z0-9]+$/i
      .test(
        String(
          monthly || ''
        )
      ) ||
    !/^pri_[a-z0-9]+$/i
      .test(
        String(
          annual || ''
        )
      ) ||
    monthly === annual
  ) {
    throw Error(
      'LaunchGuard Paddle prices are not configured.'
    );
  }


  return {
    monthly,
    annual,

    allowed:
      new Set([
        monthly,
        annual
      ])
  };
}


function statusAllowsAccess(
  status
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}


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


  if (
    !validInstallationId(
      installationId
    ) ||
    !validInstallationSecret(
      installationSecret
    )
  ) {
    return noStore(
      {
        error:
          'Invalid installation identity.'
      },
      400
    );
  }


  try {
    const sql =
      getSql();


    const registrations =
      await sql`
        SELECT
          secret_hash

        FROM
          installation_registrations

        WHERE
          installation_id =
            ${installationId}

        LIMIT 1
      `;


    /*
     * Free installation that has not opened checkout yet.
     *
     * This is not an authentication failure.
     */
    if (
      registrations.length === 0
    ) {
      return noStore({
        entitled:
          false,

        hasSubscription:
          false,

        status:
          'not_registered',

        plan:
          null,

        priceId:
          null,

        productId:
          null,

        currentPeriodStart:
          null,

        currentPeriodEnd:
          null,

        scheduledChange:
          null
      });
    }


    const expectedHash =
      hashSecret(
        installationSecret
      );


    if (
      registrations.length !== 1 ||
      !sameHash(
        registrations[0]
          .secret_hash,
        expectedHash
      )
    ) {
      return noStore(
        {
          error:
            'Installation verification failed.'
        },
        401
      );
    }


    await sql`
      UPDATE
        installation_registrations

      SET
        last_seen_at =
          NOW()

      WHERE
        installation_id =
          ${installationId}
    `;


    const subscriptions =
      await sql`
        SELECT
          subscription_id,
          status,
          entitled,
          price_id,
          product_id,
          current_period_start,
          current_period_end,
          scheduled_change,
          event_occurred_at

        FROM
          paddle_subscriptions

        WHERE
          installation_id =
            ${installationId}

        ORDER BY
          event_occurred_at
          DESC

        LIMIT 20
      `;


    const prices =
      paddlePrices();


    const row =
      subscriptions.find(
        subscription =>
          prices.allowed.has(
            subscription.price_id
          )
      );


    if (!row) {
      return noStore({
        entitled:
          false,

        hasSubscription:
          false,

        status:
          'not_found',

        plan:
          null,

        priceId:
          null,

        productId:
          null,

        currentPeriodStart:
          null,

        currentPeriodEnd:
          null,

        scheduledChange:
          null
      });
    }


    const periodEnd =
      row.current_period_end
        ? new Date(
            row.current_period_end
          ).getTime()
        : null;


    const periodValid =
      periodEnd === null ||
      (
        Number.isFinite(
          periodEnd
        ) &&
        periodEnd >
          Date.now()
      );


    const grantsAccess =
      row.entitled === true &&
      statusAllowsAccess(
        row.status
      ) &&
      periodValid;


    const plan =
      row.price_id ===
        prices.monthly
        ? 'monthly'
        : 'annual';


    return noStore({
      entitled:
        grantsAccess,

      hasSubscription:
        true,

      status:
        row.status,

      plan,

      priceId:
        row.price_id,

      productId:
        row.product_id,

      currentPeriodStart:
        row.current_period_start,

      currentPeriodEnd:
        row.current_period_end,

      scheduledChange:
        row.scheduled_change ??
        null
    });

  } catch (error) {
    console.error(
      'Entitlement database error:',
      error instanceof Error
        ? error.message
        : 'Unknown server error'
    );


    return noStore(
      {
        error:
          'Unable to check entitlement.'
      },
      500
    );
  }
}