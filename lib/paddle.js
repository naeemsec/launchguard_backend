import { Environment, Paddle } from '@paddle/paddle-node-sdk';

const apiKey = process.env.PADDLE_API_KEY;
const paddleEnv = process.env.PADDLE_ENV;

if (!apiKey) throw new Error('PADDLE_API_KEY is not configured.');
if (!paddleEnv) throw new Error('PADDLE_ENV is not configured.');
if (!['sandbox', 'production'].includes(paddleEnv)) {
  throw new Error('PADDLE_ENV must be "sandbox" or "production".');
}

export const paddle = new Paddle(apiKey, {
  environment: paddleEnv === 'sandbox' ? Environment.sandbox : Environment.production
});
