'use client';

import {
  useEffect,
  useRef,
  useState
} from 'react';

import {
  initializePaddle
} from '@paddle/paddle-js';


const PADDLE_TOKEN =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

const PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV;

const MONTHLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID;

const ANNUAL_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID;


export default function CheckoutPage() {
  const paddleRef =
    useRef(null);

  const openedRef =
    useRef(false);

  const [status, setStatus] =
    useState('Preparing secure checkout…');

  const [error, setError] =
    useState('');

  const [selectedPlan, setSelectedPlan] =
    useState(null);


  function validateConfig() {
    if (!PADDLE_TOKEN) {
      throw new Error(
        'Paddle client-side token is not configured.'
      );
    }

    if (
      PADDLE_ENV !== 'sandbox' &&
      PADDLE_ENV !== 'production'
    ) {
      throw new Error(
        'NEXT_PUBLIC_PADDLE_ENV must be sandbox or production.'
      );
    }

    if (!MONTHLY_PRICE_ID) {
      throw new Error(
        'Monthly Paddle price ID is not configured.'
      );
    }

    if (!ANNUAL_PRICE_ID) {
      throw new Error(
        'Annual Paddle price ID is not configured.'
      );
    }
  }


  function getRequestedPlan() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const plan =
      params.get('plan');

    if (
      plan !== 'monthly' &&
      plan !== 'annual'
    ) {
      throw new Error(
        'Invalid billing plan.'
      );
    }

    return plan;
  }


  function getPriceId(plan) {
    return plan === 'monthly'
      ? MONTHLY_PRICE_ID
      : ANNUAL_PRICE_ID;
  }


  async function openCheckout(plan) {
    try {
      setError('');
      setStatus(
        'Opening Paddle checkout…'
      );

      const paddle =
        paddleRef.current;

      if (!paddle) {
        throw new Error(
          'Paddle is not ready yet.'
        );
      }

      const priceId =
        getPriceId(plan);

      paddle.Checkout.open({
        items: [
          {
            priceId,
            quantity: 1
          }
        ],

        settings: {
          displayMode: 'overlay',
          variant: 'one-page'
        }
      });

      setStatus(
        'Checkout opened securely.'
      );

    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
        'Unable to open Paddle checkout.'
      );

      setStatus('');
    }
  }


  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        validateConfig();

        const plan =
          getRequestedPlan();

        if (!active) {
          return;
        }

        setSelectedPlan(plan);

        const paddle =
          await initializePaddle({
            token: PADDLE_TOKEN,
            environment: PADDLE_ENV
          });

        if (!paddle) {
          throw new Error(
            'Paddle failed to initialize.'
          );
        }

        if (!active) {
          return;
        }

        paddleRef.current =
          paddle;

        /*
         * Automatically open checkout once.
         *
         * Extension:
         * upgrade.html
         *      ↓
         * /checkout?plan=monthly
         *      ↓
         * Paddle overlay opens automatically
         */
        if (!openedRef.current) {
          openedRef.current =
            true;

          await openCheckout(plan);
        }

      } catch (err) {
        console.error(err);

        if (!active) {
          return;
        }

        setError(
          err?.message ||
          'Unable to initialize checkout.'
        );

        setStatus('');
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, []);


  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
        background: '#0b1020',
        color: '#ffffff',
        fontFamily:
          'system-ui, sans-serif'
      }}
    >

      <section
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '32px',
          borderRadius: '18px',
          background: '#151c30',
          border:
            '1px solid #29324a'
        }}
      >

        <div
          style={{
            fontSize: '13px',
            letterSpacing: '1px',
            opacity: 0.7,
            marginBottom: '8px'
          }}
        >
          LAUNCHGUARD PRO
        </div>

        <h1
          style={{
            marginTop: 0
          }}
        >
          Secure Checkout
        </h1>

        {selectedPlan && (
          <p
            style={{
              opacity: 0.75
            }}
          >
            Selected plan:{' '}
            <strong>
              {selectedPlan ===
              'monthly'
                ? 'Monthly'
                : 'Annual'}
            </strong>
          </p>
        )}

        {status && (
          <p>
            {status}
          </p>
        )}

        {error && (
          <div>
            <p
              style={{
                color: '#ffb4b4'
              }}
            >
              {error}
            </p>

            {selectedPlan && (
              <button
                type="button"
                onClick={() =>
                  openCheckout(
                    selectedPlan
                  )
                }
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: '10px',
                  padding: '14px',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                Try Checkout Again
              </button>
            )}
          </div>
        )}

        <p
          style={{
            marginTop: '24px',
            fontSize: '13px',
            opacity: 0.65
          }}
        >
          Payments are processed securely
          by Paddle. LaunchGuard does not
          receive your card details.
        </p>

      </section>

    </main>
  );
}