import {
  getSql
} from '../../../../lib/db.js';

import {
  createRestoreChallengeId,
  createRestoreCode,
  findEligibleSubscriptionByEmail,
  hashPrivate,
  hashRestoreCode,
  normalizeRestoreEmail,
  requestIpHash,
  sendRestoreCode,
  validInstallationId,
  validInstallationSecret,
  verifyInstallation
} from '../../../../lib/restore.js';


export const runtime =
  'nodejs';


function noStore(
  body,
  status = 200,
  extraHeaders = {}
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
        ...extraHeaders
      }
    }
  );
}


function numberFromCount(
  rows
) {
  return Number(
    rows?.[0]?.count || 0
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

  const email =
    normalizeRestoreEmail(
      body?.email
    );


  if (
    !validInstallationId(
      installationId
    ) ||
    !validInstallationSecret(
      installationSecret
    ) ||
    !email
  ) {
    return noStore(
      {
        error:
          'Invalid restore request.'
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


    /*
     * Opportunistic cleanup. Challenges are short-lived and do not need
     * to remain in Neon after their abuse-control window has passed.
     */
    await sql`
      DELETE FROM
        restore_challenges

      WHERE
        expires_at <
          NOW() - INTERVAL '1 day'
        OR (
          consumed_at IS NOT NULL
          AND consumed_at <
            NOW() - INTERVAL '1 day'
        )
    `;


    const emailHash =
      hashPrivate(
        'restore-email',
        email
      );

    const ipHash =
      requestIpHash(
        request
      );


    const byInstallation =
      await sql`
        SELECT
          COUNT(*) AS count

        FROM
          restore_challenges

        WHERE
          installation_id =
            ${installationId}
          AND created_at >
            NOW() - INTERVAL '15 minutes'
      `;


    const byEmail =
      await sql`
        SELECT
          COUNT(*) AS count

        FROM
          restore_challenges

        WHERE
          email_hash =
            ${emailHash}
          AND created_at >
            NOW() - INTERVAL '1 hour'
      `;


    const byIp =
      await sql`
        SELECT
          COUNT(*) AS count

        FROM
          restore_challenges

        WHERE
          request_ip_hash =
            ${ipHash}
          AND created_at >
            NOW() - INTERVAL '15 minutes'
      `;


    if (
      numberFromCount(
        byInstallation
      ) >= 3 ||
      numberFromCount(
        byEmail
      ) >= 5 ||
      numberFromCount(
        byIp
      ) >= 10
    ) {
      return noStore(
        {
          error:
            'Too many restore requests. Try again later.'
        },
        429,
        {
          'Retry-After':
            '900'
        }
      );
    }


    const challengeId =
      createRestoreChallengeId();

    const code =
      createRestoreCode();

    const codeHash =
      hashRestoreCode(
        challengeId,
        code
      );


    /*
     * Paddle lookup is done server-side. The response remains intentionally
     * generic so the endpoint cannot be used to enumerate paid customers.
     */
    const subscription =
      await findEligibleSubscriptionByEmail(
        sql,
        email
      );


    await sql`
      INSERT INTO
        restore_challenges (
          challenge_id,
          installation_id,
          customer_id,
          subscription_id,
          email_hash,
          request_ip_hash,
          otp_hash,
          attempts,
          expires_at,
          consumed_at,
          created_at
        )

      VALUES (
        ${challengeId},
        ${installationId},
        ${subscription?.customer_id || null},
        ${subscription?.subscription_id || null},
        ${emailHash},
        ${ipHash},
        ${codeHash},
        0,
        NOW() + INTERVAL '10 minutes',
        NULL,
        NOW()
      )
    `;


    if (subscription) {
      try {
        await sendRestoreCode(
          email,
          code
        );
      } catch (error) {
        /*
         * Do not reveal whether the address belongs to a customer.
         * Keep the outward response identical and record only a generic
         * server-side failure without the email address or OTP.
         */
        console.error(
          'Restore email delivery failed:',
          error instanceof Error
            ? error.message
            : 'Unknown email delivery error'
        );
      }
    }


    return noStore({
      ok: true,
      challengeId,
      expiresInSeconds: 600,
      message:
        'If an eligible LaunchGuard subscription exists for that email, a verification code has been sent.'
    });

  } catch (error) {
    console.error(
      'Restore request error:',
      error instanceof Error
        ? error.message
        : 'Unknown restore request error'
    );


    return noStore(
      {
        error:
          'Unable to start subscription restore.'
      },
      500
    );
  }
}
