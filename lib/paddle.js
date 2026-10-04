// (backend). lib/paddle.js
import {
  Environment,
  Paddle
} from '@paddle/paddle-node-sdk';

let paddleClient = null;

export function getPaddle() {
  if (paddleClient) {
    return paddleClient;
  }

  const apiKey = process.env.PADDLE_API_KEY;
  const paddleEnvironment = process.env.PADDLE_ENV;

  if (!apiKey) {
    throw new Error(
      'PADDLE_API_KEY is not configured in the server environment.'
    );
  }

  if (!paddleEnvironment) {
    throw new Error(
      'PADDLE_ENV is not configured in the server environment.'
    );
  }

  if (
    paddleEnvironment !== 'sandbox' &&
    paddleEnvironment !== 'production'
  ) {
    throw new Error(
      'PADDLE_ENV must be either "sandbox" or "production".'
    );
  }

  paddleClient = new Paddle(apiKey, {
    environment:
      paddleEnvironment === 'sandbox'
        ? Environment.sandbox
        : Environment.production
  });

  return paddleClient;
}