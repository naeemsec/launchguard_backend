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
  process.env
    .NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

const PADDLE_ENV =
  process.env
    .NEXT_PUBLIC_PADDLE_ENV;

const MONTHLY_PRICE_ID =
  process.env
    .NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID;

const ANNUAL_PRICE_ID =
  process.env
    .NEXT_PUBLIC_PADDLE_ANNUAL_PRICE_ID;


function validInstallationId(
  value
) {
  return (
    typeof value === 'string' &&
    /^lg_[a-f0-9]{64}$/
      .test(value)
  );
}


export default function CheckoutPage() {
  const paddleRef =
    useRef(null);

  const openedRef =
    useRef(false);


  const [
    status,
    setStatus
  ] =
    useState(
      'Preparing secure checkout…'
    );


  const [
    error,
    setError
  ] =
    useState('');


  const [
    selectedPlan,
    setSelectedPlan
  ] =
    useState(null);


  const [
    installationId,
    setInstallationId
  ] =
    useState(null);


  function validateConfig() {
    if (
      !PADDLE_TOKEN
    ) {
      throw new Error(
        'Paddle client-side token is not configured.'
      );
    }


    if (
      PADDLE_ENV !==
        'sandbox' &&
      PADDLE_ENV !==
        'production'
    ) {
      throw new Error(
        'Invalid Paddle environment.'
      );
    }


    if (
      !/^pri_[a-z0-9]+$/i
        .test(
          String(
            MONTHLY_PRICE_ID ||
            ''
          )
        )
    ) {
      throw new Error(
        'Monthly Paddle price is not configured.'
      );
    }


    if (
      !/^pri_[a-z0-9]+$/i
        .test(
          String(
            ANNUAL_PRICE_ID ||
            ''
          )
        )
    ) {
      throw new Error(
        'Annual Paddle price is not configured.'
      );
    }


    if (
      MONTHLY_PRICE_ID ===
      ANNUAL_PRICE_ID
    ) {
      throw new Error(
        'Monthly and annual prices must be different.'
      );
    }
  }


  function readRequest() {
    const params =
      new URLSearchParams(
        window.location.search
      );


    const plan =
      params.get('plan');


    const id =
      params.get(
        'installation_id'
      );


    if (
      plan !== 'monthly' &&
      plan !== 'annual'
    ) {
      throw new Error(
        'Invalid billing plan.'
      );
    }


    if (
      !validInstallationId(id)
    ) {
      throw new Error(
        'Invalid LaunchGuard installation.'
      );
    }


    return {
      plan,
      installationId: id
    };
  }


  function getPriceId(
    plan
  ) {
    return (
      plan === 'monthly'
        ? MONTHLY_PRICE_ID
        : ANNUAL_PRICE_ID
    );
  }


  async function openCheckout(
    plan,
    id
  ) {
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


      if (
        !validInstallationId(id)
      ) {
        throw new Error(
          'Invalid LaunchGuard installation.'
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


        /*
         * Paddle copies this data to the recurring
         * subscription created by checkout.
         *
         * Private installationSecret is NEVER sent here.
         */
        customData: {
          installation_id:
            id
        },


        settings: {
          displayMode:
            'overlay',

          variant:
            'one-page'
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


  useEffect(
    () => {
      let active =
        true;


      async function initialize() {
        try {
          validateConfig();


          const request =
            readRequest();


          if (!active) {
            return;
          }


          setSelectedPlan(
            request.plan
          );


          setInstallationId(
            request.installationId
          );


          const paddle =
            await initializePaddle({
              token:
                PADDLE_TOKEN,

              environment:
                PADDLE_ENV
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


          if (
            !openedRef.current
          ) {
            openedRef.current =
              true;


            await openCheckout(
              request.plan,
              request.installationId
            );
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
        active =
          false;
      };
    },
    []
  );


  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          'center',
        padding: '30px',
        background:
          '#0b1020',
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
          background:
            '#151c30',
          border:
            '1px solid #29324a'
        }}
      >

        <div
          style={{
            fontSize: '13px',
            letterSpacing:
              '1px',
            opacity: 0.7,
            marginBottom:
              '8px'
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
              {
                selectedPlan ===
                'monthly'
                  ? 'Monthly'
                  : 'Annual'
              }
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
                color:
                  '#ffb4b4'
              }}
            >
              {error}
            </p>


            {
              selectedPlan &&
              installationId &&
              (
                <button
                  type="button"

                  onClick={
                    () =>
                      openCheckout(
                        selectedPlan,
                        installationId
                      )
                  }

                  style={{
                    width: '100%',
                    border: 0,
                    borderRadius:
                      '10px',
                    padding:
                      '14px',
                    cursor:
                      'pointer',
                    fontWeight:
                      '700'
                  }}
                >
                  Try Checkout Again
                </button>
              )
            }

          </div>
        )}


        <p
          style={{
            marginTop:
              '24px',
            fontSize:
              '13px',
            opacity:
              0.65
          }}
        >
          Payments are processed securely by Paddle.
          LaunchGuard never receives your card details.
        </p>

      </section>

    </main>
  );
}