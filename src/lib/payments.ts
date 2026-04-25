import crypto from 'crypto';
import type { IDatabase } from './db';

// Environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_SECRET = process.env.PAYPAL_WEBHOOK_SECRET || '';
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

type WebhookProcessResult = {
  accepted: boolean;
  reason?: 'duplicate' | 'out_of_order' | 'order_not_found' | 'invalid_event';
  orderId?: number;
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

const mockPaymentsEnabled = process.env.MOCK_PAYMENTS === '1';

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string | undefined): boolean {
  if (mockPaymentsEnabled && signatureHeader === 'test-valid') {
    return true;
  }
  if (!STRIPE_WEBHOOK_SECRET || !signatureHeader) return false;

  const pairs = signatureHeader.split(',').map((pair) => pair.trim());
  const timestamp = pairs.find((pair) => pair.startsWith('t='))?.slice(2);
  const signatures = pairs.filter((pair) => pair.startsWith('v1=')).map((pair) => pair.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return signatures.some((value) => safeCompare(value, expected));
}

function computePayPalHmac(payload: string, transmissionId: string, transmissionTime: string, webhookId: string): string {
  const signed = `${transmissionId}|${transmissionTime}|${webhookId}|${payload}`;
  return crypto.createHmac('sha256', PAYPAL_WEBHOOK_SECRET).update(signed, 'utf8').digest('hex');
}

export function verifyPayPalWebhookSignature(params: {
  payload: string;
  signature: string | undefined;
  transmissionId: string | undefined;
  transmissionTime: string | undefined;
  webhookId: string | undefined;
}): boolean {
  if (mockPaymentsEnabled && params.signature === 'test-valid') {
    return true;
  }
  if (!PAYPAL_WEBHOOK_SECRET) return false;
  if (!params.signature || !params.transmissionId || !params.transmissionTime || !params.webhookId) {
    return false;
  }

  const expected = computePayPalHmac(params.payload, params.transmissionId, params.transmissionTime, params.webhookId);
  return safeCompare(params.signature, expected);
}

async function updateOrderByWebhookEvent(
  db: IDatabase,
  provider: 'stripe' | 'paypal',
  orderId: number,
  eventId: string,
  eventCreatedAt: Date
): Promise<WebhookProcessResult> {
  const order = await db.queryOne<any>('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    return { accepted: false, reason: 'order_not_found' };
  }

  const eventIdField = provider === 'stripe' ? 'stripe_last_event_id' : 'paypal_last_event_id';
  const eventCreatedField = provider === 'stripe' ? 'stripe_last_event_created_at' : 'paypal_last_event_created_at';
  const eventProcessedField = provider === 'stripe' ? 'stripe_last_event_processed_at' : 'paypal_last_event_processed_at';
  const existingEventId = order[eventIdField];
  const existingEventCreatedAt = order[eventCreatedField] ? new Date(order[eventCreatedField]) : null;

  if (existingEventId && existingEventId === eventId) {
    return { accepted: false, reason: 'duplicate', orderId };
  }

  if (existingEventCreatedAt && existingEventCreatedAt.getTime() > eventCreatedAt.getTime()) {
    return { accepted: false, reason: 'out_of_order', orderId };
  }

  const sql = `
    UPDATE orders
    SET status = ?,
        payment_method = ?,
        payment_confirmed_at = CURRENT_TIMESTAMP,
        ${eventIdField} = ?,
        ${eventCreatedField} = ?,
        ${eventProcessedField} = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  await db.execute(sql, ['completed', provider, eventId, eventCreatedAt.toISOString(), orderId]);
  return { accepted: true, orderId };
}

export async function processStripeWebhookEvent(db: IDatabase, payload: any): Promise<WebhookProcessResult> {
  const eventId = String(payload?.id || '');
  const eventType = String(payload?.type || '');
  if (!eventId || !eventType) {
    return { accepted: false, reason: 'invalid_event' };
  }

  if (eventType !== 'payment_intent.succeeded') {
    return { accepted: true };
  }

  const paymentIntentId = String(payload?.data?.object?.id || '');
  if (!paymentIntentId) {
    return { accepted: false, reason: 'invalid_event' };
  }

  const metadataOrderId = Number.parseInt(String(payload?.data?.object?.metadata?.orderId || ''), 10);
  let order = Number.isInteger(metadataOrderId) && metadataOrderId > 0
    ? await db.queryOne<any>('SELECT id FROM orders WHERE id = ?', [metadataOrderId])
    : null;

  if (!order) {
    order = await db.queryOne<any>('SELECT id FROM orders WHERE stripe_payment_intent_id = ?', [paymentIntentId]);
  }
  if (!order?.id) {
    return { accepted: false, reason: 'order_not_found' };
  }

  const createdEpoch = Number(payload?.created);
  const eventCreatedAt = Number.isFinite(createdEpoch) && createdEpoch > 0
    ? new Date(createdEpoch * 1000)
    : new Date();

  return updateOrderByWebhookEvent(db, 'stripe', Number(order.id), eventId, eventCreatedAt);
}

export async function processPayPalWebhookEvent(db: IDatabase, payload: any): Promise<WebhookProcessResult> {
  const eventId = String(payload?.id || '');
  const eventType = String(payload?.event_type || '');
  if (!eventId || !eventType) {
    return { accepted: false, reason: 'invalid_event' };
  }

  if (eventType !== 'CHECKOUT.ORDER.APPROVED' && eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    return { accepted: true };
  }

  const resource = payload?.resource || {};
  const paypalOrderId = String(resource?.id || resource?.supplementary_data?.related_ids?.order_id || '');
  const customOrderId = Number.parseInt(String(resource?.custom_id || ''), 10);

  let order = Number.isInteger(customOrderId) && customOrderId > 0
    ? await db.queryOne<any>('SELECT id FROM orders WHERE id = ?', [customOrderId])
    : null;

  if (!order && paypalOrderId) {
    order = await db.queryOne<any>('SELECT id FROM orders WHERE paypal_order_id = ?', [paypalOrderId]);
  }

  if (!order?.id) {
    return { accepted: false, reason: 'order_not_found' };
  }

  const eventCreatedAt = payload?.create_time ? new Date(String(payload.create_time)) : new Date();
  return updateOrderByWebhookEvent(db, 'paypal', Number(order.id), eventId, eventCreatedAt);
}

export async function markOrderPaymentPending(params: {
  db: IDatabase;
  orderId: number;
  userId: number;
  provider: 'stripe' | 'paypal';
  providerPaymentId: string;
}): Promise<{ updated: boolean; reason?: 'order_not_found' | 'invalid_status' }> {
  const order = await params.db.queryOne<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [params.orderId, params.userId]);
  if (!order) return { updated: false, reason: 'order_not_found' };

  if (!['pending', 'payment_pending'].includes(String(order.status || ''))) {
    return { updated: false, reason: 'invalid_status' };
  }

  if (params.provider === 'stripe') {
    await params.db.execute(
      'UPDATE orders SET status = ?, payment_method = ?, stripe_payment_intent_id = ? WHERE id = ?',
      ['payment_pending', 'stripe', params.providerPaymentId, params.orderId]
    );
  } else {
    await params.db.execute(
      'UPDATE orders SET status = ?, payment_method = ?, paypal_order_id = ? WHERE id = ?',
      ['payment_pending', 'paypal', params.providerPaymentId, params.orderId]
    );
  }

  return { updated: true };
}

// Stripe payment methods
export async function createStripePaymentIntent(amount: number, currency: string = 'usd'): Promise<PaymentIntent> {
  if (mockPaymentsEnabled) {
    return {
      id: `pi_mock_${Date.now()}`,
      client_secret: 'pi_mock_client_secret',
      amount: Math.round(amount * 100),
      currency
    };
  }

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
  if (mockPaymentsEnabled) {
    return {
      id: `paypal_mock_${Date.now()}`,
      status: 'CREATED',
      links: []
    };
  }

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
  if (mockPaymentsEnabled) {
    return !!orderId;
  }

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
