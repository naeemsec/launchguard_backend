import {
  createHmac,
  timingSafeEqual
} from 'node:crypto';

import {
  getSql
} from '../../../../lib/db.js';

import {
  getPaddle
} from '../../../../lib/paddle.js';


export const runtime =
  'nodejs';


const ALLOWED_ACTIONS =
  new Set([
    'manage',
    'overview',
    'update_payment_method',
    'cancel'
  ]);


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
      )
  ) {
    throw Error(
      'Paddle prices are not configured.'
    );
  }


  return new Set([
    monthly,
    annual
  ]);
}


function validPaddleCustomerId(
  value
) {
  return (
    typeof value ===
      'string' &&
    /^ctm_[a-z0-9]{26}$/i
      .test(value)
  );
}


function validPaddleSubscriptionId(
  value
) {
  return (
    typeof value ===
      'string' &&
    /^sub_[a-z0-9]{26}$/i
      .test(value)
  );
}


function validatePortalURL(
  value
) {
  if (
    typeof value !==
      'string' ||
    !value
  ) {
    throw Error(
      'Paddle did not return a portal URL.'
    );
  }


  const url =
    new URL(value);


  const allowed =
    new Set([
      'customer-portal.paddle.com',
      'sandbox-customer-portal.paddle.com'
    ]);


  if (
    url.protocol !== 'https:' ||
    !allowed.has(
      url.hostname
    )
  ) {
    throw Error(
      'Paddle returned an invalid customer portal URL.'
    );
  }


  return url.href;
}


function response(
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
    return response(
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


  const action =
    body?.action;


  if (
    !validInstallationId(
      installationId
    ) ||
    !validInstallationSecret(
      installationSecret
    )
  ) {
    return response(
      {
        error:
          'Invalid installation identity.'
      },
      400
    );
  }


  if (
    !ALLOWED_ACTIONS.has(
      action
    )
  ) {
    return response(
      {
        error:
          'Invalid billing action.'
      },
      400
    );
  }


  try {
    const sql =
      getSql();


    /*
     * Verify private installation proof.
     */
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
      registrations.length !== 1
    ) {
      return response(
        {
          error:
            'Installation verification failed.'
        },
        401
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
      return response(
        {
          error:
            'Installation verification failed.'
        },
        401
      );
    }


    /*
     * Find LaunchGuard subscription.
     */
    const rows =
      await sql`
        SELECT
          subscription_id,
          customer_id,
          status,
          price_id,
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


    const subscription =
      rows.find(
        row =>
          prices.has(
            row.price_id
          )
      );


    if (!subscription) {
      return response(
        {
          error:
            'No LaunchGuard subscription was found.'
        },
        404
      );
    }


    if (
      !validPaddleCustomerId(
        subscription.customer_id
      ) ||
      !validPaddleSubscriptionId(
        subscription.subscription_id
      )
    ) {
      throw Error(
        'Stored Paddle subscription identity is invalid.'
      );
    }


    /*
     * Action-specific safety.
     */

    if (
      action ===
        'cancel' &&
      ![
        'active',
        'trialing',
        'past_due'
      ].includes(
        subscription.status
      )
    ) {
      return response(
        {
          error:
            'This subscription cannot currently be canceled.'
        },
        409
      );
    }


    if (
      action ===
        'update_payment_method' &&
      ![
        'active',
        'trialing',
        'past_due'
      ].includes(
        subscription.status
      )
    ) {
      return response(
        {
          error:
            'Payment details cannot be updated for this subscription.'
        },
        409
      );
    }


    /*
     * Generate NEW temporary Paddle portal session.
     *
     * Never cache this URL.
     */
    const paddle =
      getPaddle();


    const session =
      await paddle
        .customerPortalSessions
        .create(
          subscription.customer_id,
          [
            subscription.subscription_id
          ]
        );


    const overview =
      session?.urls
        ?.general
        ?.overview;


    const subscriptionLinks =
      Array.isArray(
        session?.urls?.subscriptions
      )
        ? session.urls.subscriptions
        : [];


    const links =
      subscriptionLinks.find(
        item =>
          item.id ===
          subscription.subscription_id
      ) ||
      subscriptionLinks[0] ||
      null;


    let portalURL;


    if (
      action === 'overview'
    ) {
      portalURL =
        overview;
    }


    else if (
      action === 'manage'
    ) {
      /*
       * viewSubscription was added by Paddle in 2026.
       * Fall back to portal overview for older SDKs.
       */
      portalURL =
        links?.viewSubscription ||
        overview;
    }


    else if (
      action ===
        'update_payment_method'
    ) {
      portalURL =
        links
          ?.updateSubscriptionPaymentMethod;


      if (!portalURL) {
        return response(
          {
            error:
              'Paddle did not provide a payment-method update link.'
          },
          502
        );
      }
    }


    else if (
      action === 'cancel'
    ) {
      portalURL =
        links
          ?.cancelSubscription;


      if (!portalURL) {
        return response(
          {
            error:
              'Paddle did not provide a cancellation link.'
          },
          502
        );
      }
    }


    return response({
      url:
        validatePortalURL(
          portalURL
        )
    });

  } catch (error) {
    console.error(
      'Billing portal error:',
      error instanceof Error
        ? error.message
        : 'Unknown billing portal error'
    );


    return response(
      {
        error:
          'Unable to open Paddle customer portal.'
      },
      500
    );
  }
}