import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual
} from 'node:crypto';

import nodemailer from 'nodemailer';

import {
  getPaddle
} from './paddle.js';


let restoreMailer = null;


function getHashKey() {
  const key =
    process.env
      .INSTALLATION_HMAC_KEY;

  if (
    typeof key !== 'string' ||
    key.length < 32
  ) {
    throw new Error(
      'INSTALLATION_HMAC_KEY is not configured securely.'
    );
  }

  return key;
}


export function validInstallationId(
  value
) {
  return (
    typeof value === 'string' &&
    /^lg_[a-f0-9]{64}$/
      .test(value)
  );
}


export function validInstallationSecret(
  value
) {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/
      .test(value)
  );
}


export function normalizeRestoreEmail(
  value
) {
  const email =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email)
  ) {
    return null;
  }

  return email;
}


export function hashPrivate(
  namespace,
  value
) {
  return createHmac(
    'sha256',
    getHashKey()
  )
    .update(
      `${namespace}:${String(value)}`,
      'utf8'
    )
    .digest('hex');
}


export function sameHex(
  first,
  second
) {
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    first.length !== second.length
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
    a.length !== b.length
  ) {
    return false;
  }

  return timingSafeEqual(
    a,
    b
  );
}


export async function verifyInstallation(
  sql,
  installationId,
  installationSecret
) {
  if (
    !validInstallationId(
      installationId
    ) ||
    !validInstallationSecret(
      installationSecret
    )
  ) {
    return false;
  }

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
    rows.length !== 1
  ) {
    return false;
  }

  const expected =
    hashPrivate(
      'installation-secret',
      installationSecret
    );

  /*
   * Existing LaunchGuard registrations were created with the
   * raw HMAC(secret), without a namespace. Keep that exact format
   * for compatibility with the current registration endpoint.
   */
  const legacyExpected =
    createHmac(
      'sha256',
      getHashKey()
    )
      .update(
        installationSecret,
        'utf8'
      )
      .digest('hex');

  return (
    sameHex(
      rows[0].secret_hash,
      legacyExpected
    ) ||
    sameHex(
      rows[0].secret_hash,
      expected
    )
  );
}


export function paddlePriceIds() {
  const monthly =
    process.env
      .NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID;

  const annual =
    process.env
      .NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID;

  if (
    !/^pri_[a-z0-9]+$/i
      .test(
        String(monthly || '')
      ) ||
    !/^pri_[a-z0-9]+$/i
      .test(
        String(annual || '')
      ) ||
    monthly === annual
  ) {
    throw new Error(
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


export function statusCanRestore(
  status
) {
  return [
    'active',
    'trialing',
    'past_due',
    'paused'
  ].includes(
    status
  );
}


export function statusGrantsPro(
  status
) {
  return (
    status === 'active' ||
    status === 'trialing'
  );
}


export function createRestoreChallengeId() {
  return (
    'rst_' +
    randomBytes(24)
      .toString('hex')
  );
}


export function createRestoreCode() {
  return String(
    randomInt(
      0,
      1000000
    )
  ).padStart(
    6,
    '0'
  );
}


export function hashRestoreCode(
  challengeId,
  code
) {
  return hashPrivate(
    'restore-code',
    `${challengeId}:${code}`
  );
}


export function requestIpHash(
  request
) {
  const forwarded =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim();

  const direct =
    request.headers
      .get('x-real-ip')
      ?.trim();

  const value =
    forwarded ||
    direct ||
    'unavailable';

  return hashPrivate(
    'restore-ip',
    value
  );
}


export async function findEligibleSubscriptionByEmail(
  sql,
  email
) {
  const paddle =
    getPaddle();

  const customerCollection =
    paddle.customers.list({
      email: [email],
      perPage: 10
    });

  const customers =
    await customerCollection.next();

  if (
    !Array.isArray(customers) ||
    customers.length === 0
  ) {
    return null;
  }

  const prices =
    paddlePriceIds();

  for (const customer of customers) {
    if (
      !/^ctm_[a-z0-9]{26}$/i
        .test(
          String(customer?.id || '')
        )
    ) {
      continue;
    }

    const rows =
      await sql`
        SELECT
          subscription_id,
          customer_id,
          status,
          price_id,
          product_id,
          event_occurred_at

        FROM
          paddle_subscriptions

        WHERE
          customer_id =
            ${customer.id}
          AND price_id IN (
            ${prices.monthly},
            ${prices.annual}
          )
          AND status IN (
            'active',
            'trialing',
            'past_due',
            'paused'
          )

        ORDER BY
          CASE status
            WHEN 'active' THEN 1
            WHEN 'trialing' THEN 2
            WHEN 'past_due' THEN 3
            WHEN 'paused' THEN 4
            ELSE 5
          END,
          event_occurred_at DESC

        LIMIT 1
      `;

    if (
      rows.length === 1
    ) {
      return rows[0];
    }
  }

  return null;
}


export function matchingLaunchGuardItem(
  subscription
) {
  const prices =
    paddlePriceIds();

  const items =
    Array.isArray(
      subscription?.items
    )
      ? subscription.items
      : [];

  return (
    items.find(
      item =>
        prices.allowed.has(
          item?.price?.id
        )
    ) ||
    null
  );
}


function getRestoreMailer() {
  if (restoreMailer) {
    return restoreMailer;
  }

  const user =
    process.env
      .RESTORE_SMTP_USER;

  const password =
    process.env
      .RESTORE_SMTP_APP_PASSWORD;

  if (
    typeof user !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(user) ||
    typeof password !== 'string' ||
    password.length < 8
  ) {
    throw new Error(
      'Restore email SMTP credentials are not configured.'
    );
  }

  restoreMailer =
    nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass: password
      }
    });

  return restoreMailer;
}


export async function sendRestoreCode(
  email,
  code
) {
  const user =
    process.env
      .RESTORE_SMTP_USER;

  const mailer =
    getRestoreMailer();

  await mailer.sendMail({
    from:
      `LaunchGuard <${user}>`,

    to:
      email,

    replyTo:
      user,

    subject:
      'Your LaunchGuard Pro restore code',

    text:
      `Your LaunchGuard Pro restore code is ${code}.\n\n` +
      'It expires in 10 minutes and can be used only for the current restore request.\n\n' +
      'If you did not request this code, you can ignore this email.\n\n' +
      'LaunchGuard Support: ' + user,

    html:
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">' +
      '<h2>Restore LaunchGuard Pro</h2>' +
      '<p>Your one-time restore code is:</p>' +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
      '<p>This code expires in <strong>10 minutes</strong> and can be used only for the current restore request.</p>' +
      '<p>If you did not request this code, you can ignore this email.</p>' +
      `<p>LaunchGuard Support: ${user}</p>` +
      '</div>'
  });
}
