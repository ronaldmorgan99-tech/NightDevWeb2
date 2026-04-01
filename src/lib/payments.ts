import Stripe from 'stripe';
import { Client as PayPalClient, Environment as PayPalEnv, OrdersController, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';

// Environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Stripe configuration
let stripe: Stripe | null = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  });
}

// PayPal configuration
let paypalClient: PayPalClient | null = null;
let paypalOrderController: OrdersController | null = null;
if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET) {
  paypalClient = new PayPalClient({
    environment: IS_PRODUCTION ? PayPalEnv.Production : PayPalEnv.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: PAYPAL_CLIENT_ID,
      oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
  });

  paypalOrderController = new OrdersController(paypalClient);
}

export interface PaymentProvider {
  name: 'stripe' | 'paypal';
  available: boolean;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
}

export interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

// Available payment providers
export const paymentProviders: PaymentProvider[] = [
  {
    name: 'stripe',
    available: !!stripe
  },
  {
    name: 'paypal',
    available: !!paypalClient
  }
];

// Validate payment configuration
export function validatePaymentConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!STRIPE_SECRET_KEY && !PAYPAL_CLIENT_ID) {
    errors.push('At least one payment provider (Stripe or PayPal) must be configured');
  }

  if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith('sk_')) {
    errors.push('Invalid Stripe secret key format');
  }

  if (PAYPAL_CLIENT_ID && !PAYPAL_CLIENT_SECRET) {
    errors.push('PayPal client secret is required when client ID is provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Stripe payment methods
export async function createStripePaymentIntent(amount: number, currency: string = 'usd'): Promise<PaymentIntent> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return {
    id: paymentIntent.id,
    client_secret: paymentIntent.client_secret!,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
}

export async function confirmStripePayment(paymentIntentId: string): Promise<boolean> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  } catch (error) {
    console.error('Error confirming Stripe payment:', error);
    return false;
  }
}

// PayPal payment methods
export async function createPayPalOrder(amount: number, currency: string = 'USD'): Promise<PayPalOrder> {
  if (!paypalOrderController) {
    throw new Error('PayPal is not configured');
  }

  try {
    const response = await paypalOrderController.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            amount: {
              currencyCode: currency,
              value: amount.toFixed(2),
            },
          },
        ],
      },
      prefer: 'return=representation',
    });

    const orderBody = response.body as unknown as { id: string; status: string; links?: Array<{ href: string; rel: string; method: string }> };
    return {
      id: orderBody.id,
      status: orderBody.status,
      links: orderBody.links || [],
    };
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw new Error('Failed to create PayPal order');
  }
}

export async function capturePayPalOrder(orderId: string): Promise<boolean> {
  if (!paypalOrderController) {
    throw new Error('PayPal is not configured');
  }

  try {
    const response = await paypalOrderController.captureOrder({ id: orderId });
    const captureBody = response.body as unknown as { status: string };
    return captureBody.status === 'COMPLETED';
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return false;
  }
}

export { stripe, paypalClient };