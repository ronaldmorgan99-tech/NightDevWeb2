// Environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type StripePaymentIntentResponse = {
  id: string;
  client_secret: string | null;
  amount: number;
  currency: string;
  status: string;
};

type StripeClient = {
  paymentIntents: {
    create(params: {
      amount: number;
      currency: string;
      automatic_payment_methods: { enabled: boolean };
    }): Promise<StripePaymentIntentResponse>;
    retrieve(paymentIntentId: string): Promise<StripePaymentIntentResponse>;
  };
};

type PayPalOrderController = {
  createOrder(params: {
    body: {
      intent: 'CAPTURE';
      purchaseUnits: Array<{
        amount: {
          currencyCode: string;
          value: string;
        };
      }>;
    };
    prefer: string;
  }): Promise<{ body: unknown }>;
  captureOrder(params: { id: string }): Promise<{ body: unknown }>;
};

let stripe: StripeClient | null = null;
let paypalClient: unknown = null;
let paypalOrderController: PayPalOrderController | null = null;

const stripeAvailable = !!STRIPE_SECRET_KEY;
const paypalAvailable = !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);

const dynamicImport = (moduleName: string): Promise<any> =>
  new Function('m', 'return import(m)')(moduleName) as Promise<any>;

async function getStripeClient(): Promise<StripeClient> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
  }

  if (stripe) {
    return stripe;
  }

  const stripeModule = await dynamicImport('stripe');
  const Stripe = stripeModule.default;

  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia',
  }) as unknown as StripeClient;

  return stripe;
}

async function getPayPalOrderController(): Promise<PayPalOrderController> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal is not configured');
  }

  if (paypalOrderController) {
    return paypalOrderController;
  }

  const paypal = await dynamicImport('@paypal/paypal-server-sdk');

  paypalClient = new paypal.Client({
    environment: IS_PRODUCTION ? paypal.Environment.Production : paypal.Environment.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: PAYPAL_CLIENT_ID,
      oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
  });

  paypalOrderController = new paypal.OrdersController(paypalClient) as unknown as PayPalOrderController;
  return paypalOrderController;
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
    available: stripeAvailable
  },
  {
    name: 'paypal',
    available: paypalAvailable
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
  const stripeClient = await getStripeClient();

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client secret');
  }

  return {
    id: paymentIntent.id,
    client_secret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
}

export async function confirmStripePayment(paymentIntentId: string): Promise<boolean> {
  try {
    const stripeClient = await getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  } catch (error) {
    console.error('Error confirming Stripe payment:', error);
    return false;
  }
}

// PayPal payment methods
export async function createPayPalOrder(amount: number, currency: string = 'USD'): Promise<PayPalOrder> {
  const orderController = await getPayPalOrderController();

  try {
    const response = await orderController.createOrder({
      body: {
        intent: 'CAPTURE',
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

    const orderBody = response.body as { id: string; status: string; links?: Array<{ href: string; rel: string; method: string }> };
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
  const orderController = await getPayPalOrderController();

  try {
    const response = await orderController.captureOrder({ id: orderId });
    const captureBody = response.body as { status: string };
    return captureBody.status === 'COMPLETED';
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return false;
  }
}

export { stripe, paypalClient };
