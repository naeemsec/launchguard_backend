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
    throw new Error(
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
    .digest('hex');
}


function sameHash(
  a,
  b
) {
  if (
    typeof a !==
      'string' ||
    typeof b !==
      'string' ||
    a.length !== b.length
  ) {
    return false;
  }


  const first =
    Buffer.from(
      a,
      'hex'
    );


  const second =
    Buffer.from(
      b,
      'hex'
    );


  if (
    first.length !==
      second.length
  ) {
    return false;
  }


  return timingSafeEqual(
    first,
    second
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


function statusAllowsAccess(
  status
) {
  /*
   * Strict mode:
   * past_due does NOT grant Pro.
   */
  return (
    status === 'active' ||
    status === 'trialing'
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
    return Response.json(
      {
        error:
          'Invalid JSON body.'
      },
      {
        status: 400
      }
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
    return Response.json(
      {
        error:
          'Invalid installation identity.'
      },
      {
        status: 400
      }
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


    if (
      registrations.length !==
      1
    ) {
      return Response.json(
        {
          error:
            'Installation verification failed.'
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store'
          }
        }
      );
    }


    const expectedHash =
      hashSecret(
        installationSecret
      );


    if (
      !sameHash(
        registrations[0]
          .secret_hash,
        expectedHash
      )
    ) {
      return Response.json(
        {
          error:
            'Installation verification failed.'
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store'
          }
        }
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
          status,
          entitled,
          price_id,
          product_id,
          current_period_end,
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


    const allowed =
      allowedPriceIds();


    /*
     * Ignore subscriptions for any other Paddle price.
     */
    const row =
      subscriptions.find(
        subscription =>
          allowed.has(
            subscription.price_id
          )
      );


    if (!row) {
      return Response.json(
        {
          entitled: false,
          status:
            'not_found'
        },
        {
          headers: {
            'Cache-Control':
              'no-store'
          }
        }
      );
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


    return Response.json(
      {
        entitled:
          grantsAccess,

        status:
          row.status,

        priceId:
          row.price_id,

        productId:
          row.product_id,

        currentPeriodEnd:
          row.current_period_end
      },
      {
        headers: {
          'Cache-Control':
            'no-store'
        }
      }
    );

  } catch (error) {
    console.error(
      'Entitlement database error:',
      error instanceof Error
        ? error.message
        : 'Unknown server error'
    );


    return Response.json(
      {
        error:
          'Unable to check entitlement.'
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store'
        }
      }
    );
  }
}