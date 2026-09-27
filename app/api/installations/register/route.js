import {
  createHmac,
  timingSafeEqual
} from 'node:crypto';

import {
  getSql
} from '../../../../lib/db.js';


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


function getHashKey() {
  const key =
    process.env
      .INSTALLATION_HMAC_KEY;


  if (
    typeof key !==
      'string' ||
    key.length < 32
  ) {
    throw new Error(
      'INSTALLATION_HMAC_KEY is not configured securely.'
    );
  }


  return key;
}


function hashSecret(
  secret
) {
  return createHmac(
    'sha256',
    getHashKey()
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
      'string'
  ) {
    return false;
  }


  if (
    a.length !==
      b.length
  ) {
    return false;
  }


  const aBuffer =
    Buffer.from(
      a,
      'hex'
    );


  const bBuffer =
    Buffer.from(
      b,
      'hex'
    );


  if (
    aBuffer.length !==
      bBuffer.length
  ) {
    return false;
  }


  return timingSafeEqual(
    aBuffer,
    bBuffer
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


    const secretHash =
      hashSecret(
        installationSecret
      );


    /*
     * First-write wins.
     *
     * A later caller cannot overwrite the secret for an
     * existing installation ID.
     */
    await sql`
      INSERT INTO
        installation_registrations (
          installation_id,
          secret_hash,
          created_at,
          last_seen_at
        )

      VALUES (
        ${installationId},
        ${secretHash},
        NOW(),
        NOW()
      )

      ON CONFLICT (
        installation_id
      )

      DO NOTHING
    `;


    const rows =
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
      rows.length !== 1 ||
      !sameHash(
        rows[0].secret_hash,
        secretHash
      )
    ) {
      return Response.json(
        {
          error:
            'Installation identity conflict.'
        },
        {
          status: 409,
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


    return Response.json(
      {
        ok: true
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
      'Installation registration error:',
      error instanceof Error
        ? error.message
        : 'Unknown server error'
    );


    return Response.json(
      {
        error:
          'Unable to register installation.'
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