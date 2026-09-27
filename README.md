# LaunchGuard Paddle Backend

Minimal server-side billing/provisioning service for LaunchGuard.

## What it does

- Receives Paddle subscription webhooks.
- Verifies every webhook signature using Paddle's official Node.js SDK.
- Stores a lean subscription/entitlement cache in Postgres.
- Uses idempotent/out-of-order-safe subscription upserts.
- Keeps Paddle API keys and webhook secrets off the Chrome extension.

## Setup

1. Run `npm install`.
2. Create/connect a Neon Postgres database in Vercel.
3. Run `db/schema.sql` in the Neon SQL editor.
4. Set server-only environment variables:
   - `DATABASE_URL`
   - `PADDLE_API_KEY` (sandbox key while testing)
   - `PADDLE_ENV=sandbox`
5. Deploy to Vercel.
6. Confirm `/api/health` returns `{ "ok": true, ... }`.
7. In Paddle Sandbox: Developer tools -> Notifications -> New destination.
   - URL: `https://YOUR-PROJECT.vercel.app/api/paddle/webhook`
   - Events: `subscription.created`, `subscription.updated`
8. Save the destination, copy its Secret key, add it to Vercel as `PADDLE_WEBHOOK_SECRET`, then redeploy.
9. Use Paddle Notifications -> Simulations to send `subscription.created` and `subscription.updated` events.
10. Confirm both return HTTP 200, then run:

```sql
SELECT subscription_id, customer_id, status, entitled, price_id, product_id, event_occurred_at
FROM paddle_subscriptions
ORDER BY event_occurred_at DESC;
```

## Security

Never expose `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, or `DATABASE_URL` in the extension or frontend. The webhook handler verifies Paddle's signature before changing entitlement state.

The `installation_id` field is ready for the next step, where the external checkout page will pass a random LaunchGuard installation ID through Paddle `customData`, allowing automatic Pro unlock for the correct extension installation.
