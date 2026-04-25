import { EventEmitter } from 'events';
import express from 'express';
import type { CookieOptions } from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './src/lib/db';
import { seedDb } from './src/lib/seed';
import { GoogleGenAI, type GenerateVideosOperation } from '@google/genai';
import { z } from 'zod';
import { PUBLIC_SETTINGS_ALLOWLIST, isPublicSetting } from './src/lib/settingsAllowlist';
import { sendWelcomeEmail } from './src/lib/mailer';
import {
  capturePayPalOrder,
  createPayPalOrder,
  createStripePaymentIntent,
  markOrderPaymentPending,
  paymentProviders,
  processPayPalWebhookEvent,
  processStripeWebhookEvent,
  verifyPayPalWebhookSignature,
  verifyStripeWebhookSignature
} from './src/lib/payments';
import { sanitizeUserText } from './src/lib/sanitize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const JWT_SECRET = process.env.JWT_SECRET || '';

const AUTH_COOKIE_NAME = 'token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_ORIGINS = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const HAS_SPLIT_ORIGIN_DEPLOYMENT = CLIENT_ORIGINS.length > 0;
const ERROR_TRACKING_WEBHOOK = process.env.ERROR_TRACKING_WEBHOOK || '';
const ERROR_TRACKING_WEBHOOK_CACHE_MS = 60_000;
const parseEnvNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS = parseEnvNumber(process.env.AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS, 10 * 60 * 1000);
const AUTH_RATE_LIMIT_CREDENTIAL_MAX = parseEnvNumber(process.env.AUTH_RATE_LIMIT_CREDENTIAL_MAX, 8);
const AUTH_RATE_LIMIT_SESSION_WINDOW_MS = parseEnvNumber(process.env.AUTH_RATE_LIMIT_SESSION_WINDOW_MS, 5 * 60 * 1000);
const AUTH_RATE_LIMIT_SESSION_MAX = parseEnvNumber(process.env.AUTH_RATE_LIMIT_SESSION_MAX, 30);

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION && HAS_SPLIT_ORIGIN_DEPLOYMENT ? 'none' : 'lax',
  path: '/'
};

const authRegisterSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(128)
});

const authLoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128)
});

const profileUpdateSchema = z.object({
  avatar_url: z.string().trim().max(2048).optional(),
  banner_url: z.string().trim().max(2048).optional(),
  bio: z.string().trim().max(500).optional(),
  username: z.string().trim().min(3).max(32).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128).optional()
}).superRefine((payload, ctx) => {
  if (payload.newPassword && !payload.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentPassword'],
      message: 'Current password required to set new password'
    });
  }
});

const adminSettingsItemSchema = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.any()), z.record(z.string(), z.any())])
});

const adminSettingsUpdateSchema = z.union([
  z.array(adminSettingsItemSchema),
  z.object({ settings: z.array(adminSettingsItemSchema) })
]);

const threadCreateSchema = z.object({
  forum_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(10_000)
});

const postCreateSchema = z.object({
  thread_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1).max(10_000)
});

const postUpdateSchema = z.object({
  content: z.string().trim().min(1).max(10_000).optional(),
  is_hidden: z.boolean().optional(),
  is_deleted: z.boolean().optional()
});

const threadUpdateSchema = z.object({
  is_pinned: z.boolean().optional(),
  is_locked: z.boolean().optional(),
  is_solved: z.boolean().optional(),
  is_hidden: z.boolean().optional()
});

const supportTicketCreateSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  message: z.string().trim().min(1).max(5_000),
  ticket_type: z.enum(['user', 'admin']).optional().default('user')
});

const ticketMessageSchema = z.object({
  message: z.string().trim().min(1).max(5_000)
});

const directMessageSchema = z.object({
  receiver_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1).max(5_000)
});

const reportCreateSchema = z.object({
  target_type: z.enum(['post', 'thread', 'user']),
  target_id: z.coerce.number().int().positive(),
  reason: z.string().trim().min(5).max(1000)
});

const cartItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1)
});

const categoryIdQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional()
});

const memberSearchQuerySchema = z.object({
  search: z.string().trim().max(100).optional()
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive()
});

const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive()
});

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive()
});

const forumCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100)
});

const forumCategoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  display_order: z.coerce.number().int().min(0).optional().default(0)
});

const forumCreateSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional().default(''),
  min_role_to_thread: z.enum(['member', 'moderator', 'admin']).optional().default('member'),
  display_order: z.coerce.number().int().min(0).optional().default(0)
});

const roleUpdateSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member', 'suspended'])
});

const adminReportActionSchema = z.object({
  action: z.enum(['hide', 'remove', 'suspend', 'dismiss']),
  reason: z.string().trim().max(1000).optional()
});

const adminTicketStatusSchema = z.object({
  status: z.enum(['open', 'pending', 'closed'])
});

function validateEnv() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters.');
  }

  if (!process.env.NODE_ENV) {
    throw new Error('NODE_ENV is required (development or production).');
  }

  if (!['development', 'production'].includes(process.env.NODE_ENV)) {
    throw new Error("NODE_ENV must be 'development' or 'production'.");
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production.');
  }

  if (CLIENT_ORIGINS.length > 0) {
    for (const origin of CLIENT_ORIGINS) {
      try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error(`CLIENT_ORIGIN contains unsupported protocol: ${origin}`);
        }
      } catch {
        throw new Error(`CLIENT_ORIGIN contains an invalid URL origin: ${origin}`);
      }
    }
  }

  // Validate payment configuration
  const hasStripe = process.env.STRIPE_SECRET_KEY;
  const hasPayPal = process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET;

  if (!hasStripe && !hasPayPal) {
    console.warn('Warning: No payment providers configured. Store checkout will not work.');
  }

  if (hasStripe && !process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
    throw new Error('Invalid Stripe secret key format. Must start with "sk_".');
  }

  if (process.env.PAYPAL_CLIENT_ID && !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal client secret is required when PayPal client ID is provided.');
  }
}

function sanitizeProxyEnvironment() {
  const proxyVars = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy',
    'npm_config_http_proxy',
    'npm_config_https_proxy',
    'npm_config_proxy'
  ];

  const setProxy = proxyVars.filter((v) => !!process.env[v]);
  if (setProxy.length > 0) {
    console.warn(
      'npm WARN: Unknown env config "http-proxy" / proxy vars found and will be removed in future npm versions.\n' +
      `Detected: ${setProxy.join(', ')}. Clearing these variables in this process for predictable behavior.`
    );

    setProxy.forEach((v) => { delete process.env[v]; });
  }

  // Avoid noisy Node.js MaxListeners warnings in legitimate high-connection usage by increasing the default.
  const minLimit = 20;
  if (EventEmitter.defaultMaxListeners < minLimit) {
    EventEmitter.defaultMaxListeners = minLimit;
  }
}

type LogLevel = 'info' | 'warn' | 'error';
type StructuredLogContext = Record<string, string | number | boolean | null | undefined>;

const logStructured = (level: LogLevel, event: string, context: StructuredLogContext = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
};

let cachedErrorTrackingWebhook: { value: string; fetchedAt: number } | null = null;
const resolveErrorTrackingWebhook = async () => {
  if (ERROR_TRACKING_WEBHOOK) {
    return ERROR_TRACKING_WEBHOOK;
  }

  const now = Date.now();
  if (cachedErrorTrackingWebhook && (now - cachedErrorTrackingWebhook.fetchedAt) < ERROR_TRACKING_WEBHOOK_CACHE_MS) {
    return cachedErrorTrackingWebhook.value;
  }

  try {
    const setting = await db.queryOne<{ value?: string }>('SELECT value FROM settings WHERE key = ?', ['discord_webhook_url']);
    const webhook = String(setting?.value || '').trim();
    cachedErrorTrackingWebhook = { value: webhook, fetchedAt: now };
    return webhook;
  } catch {
    cachedErrorTrackingWebhook = { value: '', fetchedAt: now };
    return '';
  }
};

const captureException = async (error: unknown, context: Record<string, unknown> = {}) => {
  const normalizedMessage = error instanceof Error ? error.message : String(error);
  logStructured('error', 'exception.captured', {
    message: normalizedMessage,
    context: JSON.stringify(context)
  });

  const errorTrackingWebhook = await resolveErrorTrackingWebhook();
  if (!errorTrackingWebhook) {
    return;
  }

  try {
    const payload = {
      environment: process.env.NODE_ENV,
      message: normalizedMessage,
      stack: error instanceof Error ? error.stack : undefined,
      context
    };
    const response = await fetch(errorTrackingWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `[${process.env.NODE_ENV || 'unknown'}] ${normalizedMessage}`.slice(0, 1900),
        ...payload
      })
    });
    if (!response.ok) {
      const failureBody = await response.text().catch(() => '');
      logStructured('warn', 'exception.webhook_rejected', {
        status: response.status,
        statusText: response.statusText || '',
        body: failureBody.slice(0, 500)
      });
    }
  } catch (webhookError) {
    logStructured('warn', 'exception.webhook_failed', {
      message: webhookError instanceof Error ? webhookError.message : String(webhookError)
    });
  }
};

type LatencyMetrics = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
};

type ApiMetrics = {
  totalRequests: number;
  errorCount: number;
  statusCounts: Record<string, number>;
  byRoute: Record<string, { requests: number; errors: number; latency: LatencyMetrics }>;
};

type AuthFlowMetrics = {
  registerAttempts: number;
  registerSuccess: number;
  registerFailure: number;
  loginAttempts: number;
  loginSuccess: number;
  loginFailure: number;
  meChecks: number;
  meUnauthorized: number;
};

type SocketMetrics = {
  authFailures: number;
  connections: number;
  disconnects: number;
  connectionErrors: number;
  activeConnections: number;
  roomCount: number;
  roomMemberships: number;
  maxRoomOccupancy: number;
};

const createLatencyMetric = (): LatencyMetrics => ({ count: 0, totalMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0 });

const observabilityMetrics = {
  api: {
    totalRequests: 0,
    errorCount: 0,
    statusCounts: {},
    byRoute: {}
  } as ApiMetrics,
  auth: {
    registerAttempts: 0,
    registerSuccess: 0,
    registerFailure: 0,
    loginAttempts: 0,
    loginSuccess: 0,
    loginFailure: 0,
    meChecks: 0,
    meUnauthorized: 0
  } as AuthFlowMetrics,
  media: {
    '/api/media/animate': createLatencyMetric(),
    '/api/media/poll': createLatencyMetric()
  },
  socket: {
    authFailures: 0,
    connections: 0,
    disconnects: 0,
    connectionErrors: 0,
    activeConnections: 0,
    roomCount: 0,
    roomMemberships: 0,
    maxRoomOccupancy: 0
  } as SocketMetrics
};

const recordLatency = (metric: LatencyMetrics, durationMs: number) => {
  metric.count += 1;
  metric.totalMs += durationMs;
  metric.minMs = Math.min(metric.minMs, durationMs);
  metric.maxMs = Math.max(metric.maxMs, durationMs);
};

const summarizeLatency = (metric: LatencyMetrics) => ({
  count: metric.count,
  avgMs: metric.count > 0 ? Number((metric.totalMs / metric.count).toFixed(2)) : 0,
  minMs: metric.count > 0 ? Number(metric.minMs.toFixed(2)) : 0,
  maxMs: Number(metric.maxMs.toFixed(2))
});

const getOrCreateRouteMetric = (routeKey: string) => {
  if (!observabilityMetrics.api.byRoute[routeKey]) {
    observabilityMetrics.api.byRoute[routeKey] = {
      requests: 0,
      errors: 0,
      latency: createLatencyMetric()
    };
  }

  return observabilityMetrics.api.byRoute[routeKey];
};

const summarizeApiMetrics = () => {
  const errorRate = observabilityMetrics.api.totalRequests > 0
    ? Number(((observabilityMetrics.api.errorCount / observabilityMetrics.api.totalRequests) * 100).toFixed(2))
    : 0;

  const byRoute = Object.fromEntries(
    Object.entries(observabilityMetrics.api.byRoute).map(([route, metric]) => [
      route,
      {
        requests: metric.requests,
        errors: metric.errors,
        errorRatePct: metric.requests > 0 ? Number(((metric.errors / metric.requests) * 100).toFixed(2)) : 0,
        latency: summarizeLatency(metric.latency)
      }
    ])
  );

  return {
    totalRequests: observabilityMetrics.api.totalRequests,
    errorCount: observabilityMetrics.api.errorCount,
    errorRatePct: errorRate,
    statusCounts: observabilityMetrics.api.statusCounts,
    byRoute
  };
};

async function start() {
  console.log('--- STARTING NIGHTRESPAWN SERVER ---');
  validateEnv();
  sanitizeProxyEnvironment();
  if (ERROR_TRACKING_WEBHOOK) {
    logStructured('info', 'error_tracking.initialized', { environment: process.env.NODE_ENV || 'unknown' });
  } else {
    logStructured('warn', 'error_tracking.not_configured');
  }

  // Startup order is deterministic: create/validate schema first, then seed/reset data.
  try {
    console.log('Initializing database schema...');
    await initDb();
    console.log('Database schema is ready. Running seed/reset checks...');
    await seedDb();
    console.log('Database startup tasks completed.');
  } catch (err) {
    console.error('Database startup failed:', err);
    process.exit(1);
  }

  const app = express();
  app.set('trust proxy', 1);
  const server = http.createServer(app);
  const socketCorsOrigins = CLIENT_ORIGINS.length > 0 ? CLIENT_ORIGINS : IS_PRODUCTION ? false : true;
  const io = new Server(server, {
    cors: {
      origin: socketCorsOrigins,
      credentials: HAS_SPLIT_ORIGIN_DEPLOYMENT,
      methods: ['GET', 'POST', 'OPTIONS', 'HEAD', 'PUT', 'DELETE', 'PATCH']
    }
  });
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buffer) => {
      (req as any).rawBody = buffer.toString('utf8');
    }
  }));
  app.use(cookieParser());

  const corsMethods = ['GET', 'POST', 'OPTIONS', 'HEAD', 'PUT', 'DELETE', 'PATCH'].join(', ');
  const corsHeaders = ['Content-Type', 'X-CSRF-Token'].join(', ');
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && CLIENT_ORIGINS.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', corsMethods);
    res.setHeader('Access-Control-Allow-Headers', corsHeaders);

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  const validateBody = <T>(schema: z.ZodSchema<T>) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const parsedPayload = schema.safeParse(req.body);
    if (!parsedPayload.success) {
      return res.status(400).json({ error: parsedPayload.error.issues[0]?.message || 'Invalid request payload' });
    }
    req.body = parsedPayload.data;
    next();
  };

  const validateQuery = <T>(schema: z.ZodSchema<T>) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const parsedQuery = schema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues[0]?.message || 'Invalid query parameters' });
    }
    req.query = parsedQuery.data as any;
    next();
  };

  const validateParams = <T>(schema: z.ZodSchema<T>) => (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const parsedParams = schema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues[0]?.message || 'Invalid route parameters' });
    }
    req.params = parsedParams.data as any;
    next();
  };

  const createRateLimit = (windowMs: number, maxRequests: number, errorMessage: string) => {
    const requests = new Map<string, number[]>();
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const now = Date.now();
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      const timestamps = (requests.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
      timestamps.push(now);
      requests.set(key, timestamps);

      if (timestamps.length > maxRequests) {
        return res.status(429).json({ error: errorMessage });
      }
      next();
    };
  };

  app.use((req, res, next) => {
    const shouldLog = req.path.startsWith('/api/auth')
      || req.path.startsWith('/api/settings')
      || req.path.startsWith('/api/admin/settings')
      || req.path.startsWith('/api/media');

    next();
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return next();
    }

    const startHr = process.hrtime.bigint();
    const requestId = req.headers['x-request-id'] ? String(req.headers['x-request-id']) : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startHr) / 1_000_000;
      const routePattern = req.route?.path;
      const routePath = typeof routePattern === 'string' ? routePattern : req.path;
      const routeKey = `${req.method} ${routePath}`;
      const userId = req.path.startsWith('/api/auth') || req.path.startsWith('/api/media') ? getUserFromToken(req)?.id ?? null : null;

      observabilityMetrics.api.totalRequests += 1;
      observabilityMetrics.api.statusCounts[String(res.statusCode)] = (observabilityMetrics.api.statusCounts[String(res.statusCode)] || 0) + 1;

      const routeMetric = getOrCreateRouteMetric(routeKey);
      routeMetric.requests += 1;
      recordLatency(routeMetric.latency, durationMs);

      if (res.statusCode >= 400) {
        observabilityMetrics.api.errorCount += 1;
        routeMetric.errors += 1;
      }

      logStructured('info', 'http.request', {
        requestId,
        method: req.method,
        path: req.path,
        route: routePath,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        userId
      });

      if (res.statusCode >= 500) {
        void captureException(new Error(`HTTP ${res.statusCode} response`), {
          scope: 'api_route',
          requestId,
          method: req.method,
          path: req.path,
          route: routePath,
          statusCode: res.statusCode,
          userId
        });
      }
    });

    next();
  });

  const strictCredentialRateLimit = createRateLimit(
    AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS,
    AUTH_RATE_LIMIT_CREDENTIAL_MAX,
    'Too many credential attempts. Please try again in 10 minutes.'
  );
  const authSessionRateLimit = createRateLimit(
    AUTH_RATE_LIMIT_SESSION_WINDOW_MS,
    AUTH_RATE_LIMIT_SESSION_MAX,
    'Too many authentication requests. Please slow down.'
  );
  app.use('/api/auth/login', strictCredentialRateLimit);
  app.use('/api/auth/register', strictCredentialRateLimit);
  app.use(['/api/auth/me', '/api/auth/logout'], authSessionRateLimit);

  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      path: '/'
    },
    value: (req: express.Request) => req.headers['x-csrf-token'] as string || ''
  });

  app.get('/api/csrf-token', csrfProtection, (_req, res) => {
    res.json({ csrfToken: (_req as any).csrfToken() });
  });

  // We need login/register to be possible for new anonymous sessions, so we skip CSRF there.
  // Apply CSRF protection to all other state-changing routes.
  app.use('/api', (req, res, next) => {
    if ([
      '/auth/login',
      '/auth/register',
      '/auth/logout',
      '/csrf-token',
      '/payments/stripe/webhook',
      '/payments/paypal/webhook'
    ].includes(req.path)) {
      return next();
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return csrfProtection(req, res, next);
    }
    next();
  });

  // --- SOCKET.IO AUTH ---
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie;
    if (!cookie) {
      observabilityMetrics.socket.authFailures += 1;
      logStructured('warn', 'socket.auth.failed', {
        socketId: socket.id,
        reason: 'missing_cookie'
      });
      return next(new Error('Authentication error'));
    }
    
    const token = cookie.split('; ').find(row => row.startsWith(`${AUTH_COOKIE_NAME}=`))?.split('=')[1];
    if (!token) {
      observabilityMetrics.socket.authFailures += 1;
      logStructured('warn', 'socket.auth.failed', {
        socketId: socket.id,
        reason: 'missing_token'
      });
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      socket.data.user = decoded;
      logStructured('info', 'socket.auth.succeeded', {
        socketId: socket.id,
        userId: decoded?.id ?? null
      });
      next();
    } catch (err) {
      observabilityMetrics.socket.authFailures += 1;
      logStructured('warn', 'socket.auth.failed', {
        socketId: socket.id,
        reason: 'invalid_token'
      });
      next(new Error('Authentication error'));
    }
  });

  const userSockets = new Map<number, Set<string>>();

  const MEDIA_OPERATION_TTL_MS = 30 * 60 * 1000;
  const MEDIA_MODEL = 'veo-2.0-generate-001';
  const dataUriRegex = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/;
  const mediaAnimatePayloadSchema = z.object({
    imageBase64: z.string().min(1, 'imageBase64 is required'),
    prompt: z.string().max(2000, 'prompt is too long').optional().default('')
  });


  const serverNodeSchema = z.object({
    name: z.string().min(1).max(100),
    ip: z.string().min(1).max(255),
    region: z.string().max(100).optional().default('Unknown'),
    game: z.string().max(50).optional().default('Rust'),
    map: z.string().max(100).optional().default('Unknown')
  });

  const discordWidgetMemberSchema = z.object({
    id: z.string().optional(),
    username: z.string().optional(),
    discriminator: z.string().optional(),
    status: z.string().optional(),
    avatar_url: z.string().url().optional()
  });

  const discordWidgetChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    position: z.number().optional()
  });

  const discordWidgetResponseSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    instant_invite: z.string().optional(),
    channels: z.array(discordWidgetChannelSchema).optional().default([]),
    members: z.array(discordWidgetMemberSchema).optional().default([]),
    presence_count: z.number().optional().default(0)
  });

  type MediaOperationStatus = 'in_progress' | 'done' | 'error';
  type MediaOperationRecord = {
    ownerId: number;
    createdAt: number;
    expiresAt: number;
    status: MediaOperationStatus;
    providerOperation: GenerateVideosOperation;
    uri?: string;
    error?: string;
  };

  const mediaOperations = new Map<string, MediaOperationRecord>();
  const mediaClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  const pruneExpiredMediaOperations = () => {
    const now = Date.now();
    for (const [operationName, operation] of mediaOperations.entries()) {
      if (operation.expiresAt <= now) {
        mediaOperations.delete(operationName);
      }
    }
  };

  setInterval(pruneExpiredMediaOperations, 60_000).unref();

  const updateSocketRoomLoad = () => {
    let roomCount = 0;
    let roomMemberships = 0;
    let maxRoomOccupancy = 0;

    for (const [roomName, roomSockets] of io.sockets.adapter.rooms) {
      if (io.sockets.sockets.has(roomName)) {
        continue;
      }
      const size = roomSockets.size;
      roomCount += 1;
      roomMemberships += size;
      maxRoomOccupancy = Math.max(maxRoomOccupancy, size);
    }

    observabilityMetrics.socket.roomCount = roomCount;
    observabilityMetrics.socket.roomMemberships = roomMemberships;
    observabilityMetrics.socket.maxRoomOccupancy = maxRoomOccupancy;
  };

  io.of('/').adapter.on('join-room', () => updateSocketRoomLoad());
  io.of('/').adapter.on('leave-room', () => updateSocketRoomLoad());

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    const currentSockets = userSockets.get(userId) || new Set<string>();
    currentSockets.add(socket.id);
    userSockets.set(userId, currentSockets);
    observabilityMetrics.socket.connections += 1;
    observabilityMetrics.socket.activeConnections += 1;
    updateSocketRoomLoad();
    logStructured('info', 'socket.connected', {
      userId,
      socketId: socket.id,
      activeConnections: observabilityMetrics.socket.activeConnections
    });

    socket.on('error', (err: Error) => {
      observabilityMetrics.socket.connectionErrors += 1;
      void captureException(err, {
        scope: 'socket',
        socketId: socket.id,
        userId
      });
      logStructured('error', 'socket.error', {
        userId,
        socketId: socket.id,
        message: err.message
      });
    });

    socket.on('disconnect', () => {
      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
        } else {
          userSockets.set(userId, userSet);
        }
      }
      observabilityMetrics.socket.disconnects += 1;
      observabilityMetrics.socket.activeConnections = Math.max(0, observabilityMetrics.socket.activeConnections - 1);
      updateSocketRoomLoad();
      logStructured('info', 'socket.disconnected', {
        userId,
        socketId: socket.id,
        activeConnections: observabilityMetrics.socket.activeConnections
      });
    });
  });

  // --- AUTH MIDDLEWARE ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) {
      if (req.path === '/api/auth/me') {
        observabilityMetrics.auth.meUnauthorized += 1;
      }
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      if (req.path === '/api/auth/me') {
        observabilityMetrics.auth.meUnauthorized += 1;
      }
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const getUserFromToken = (req: any) => {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const isStaffRole = (role?: string) => role === 'admin' || role === 'moderator';

  // Check if a user's role meets or exceeds the minimum required role
  // Role hierarchy: admin > moderator > member > suspended
  const meetsMinRole = (userRole: string, minRequiredRole: string): boolean => {
    const roleHierarchy: { [key: string]: number } = {
      'admin': 4,
      'moderator': 3,
      'member': 2,
      'suspended': 1
    };
    const userRank = roleHierarchy[userRole] || 0;
    const requiredRank = roleHierarchy[minRequiredRole] || 0;
    return userRank >= requiredRank;
  };

  const createModerationAction = async (
    moderatorId: number,
    actionType: string,
    targetType: 'post' | 'thread' | 'user',
    targetId: number,
    reason?: string
  ) => {
    await db.execute(
      'INSERT INTO moderation_actions (moderator_id, action_type, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)',
      [moderatorId, actionType, targetType, targetId, reason ?? null]
    );
  };

  const syncServerNodesFromJson = async (rawJson: string) => {
    let parsed: any = [];
    try {
      parsed = JSON.parse(rawJson || '[]');
    } catch {
      parsed = [];
    }

    const servers = Array.isArray(parsed) ? parsed : [];
    await db.execute('DELETE FROM server_nodes');

    for (const entry of servers) {
      const name = String(entry?.name || entry?.label || 'Unnamed Node');
      const ip = String(entry?.ip || entry?.address || '0.0.0.0:0');
      const region = String(entry?.region || 'Unknown');
      const game = String(entry?.game || 'Rust');
      const map = String(entry?.map || 'Unknown');
      const playersCurrent = Number.isFinite(Number(entry?.players_current ?? entry?.players)) ? Math.max(0, Number(entry.players_current ?? entry.players)) : 0;
      const status = entry?.status === 'online' ? 'online' : 'offline';

      await db.execute(
        'INSERT INTO server_nodes (name, ip, region, game, map, players_current, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, ip, region, game, map, playersCurrent, status]
      );
    }
  };

  // --- API ROUTES ---

  app.post('/api/telemetry/client-error', async (req, res) => {
    const payload = req.body || {};
    logStructured('error', 'frontend.exception', {
      type: String(payload.type || 'unknown'),
      message: String(payload.message || 'Unknown client error'),
      source: String(payload.source || ''),
      url: String(payload.url || ''),
      line: Number(payload.line || 0),
      column: Number(payload.column || 0)
    });

    await captureException(payload.message || 'Unknown client error', {
      scope: 'frontend',
      payload
    });

    res.status(202).json({ accepted: true });
  });

  // Auth
  app.post('/api/auth/register', validateBody(authRegisterSchema), async (req, res) => {
    const { username, email, password } = req.body;
    observabilityMetrics.auth.registerAttempts += 1;

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

      const user = await db.queryOne<any>(
        'SELECT id, username, email, role FROM users WHERE username = ?',
        [username]
      );

      if (!user) {
        observabilityMetrics.auth.registerFailure += 1;
        return res.status(500).json({ error: 'Failed to load registered user' });
      }

      try {
        await sendWelcomeEmail({ to: user.email, username: user.username });
      } catch (mailErr) {
        console.error(`Failed to send welcome email to ${user.email}:`, mailErr);
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
      observabilityMetrics.auth.registerSuccess += 1;
      res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err: any) {
      observabilityMetrics.auth.registerFailure += 1;
      void captureException(err, { scope: 'auth', flow: 'register' });
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', validateBody(authLoginSchema), async (req, res) => {
    const { username, password } = req.body;
    observabilityMetrics.auth.loginAttempts += 1;
    try {
      const user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);
      if (!user || !bcrypt.compareSync(password, user.password)) {
        observabilityMetrics.auth.loginFailure += 1;
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
      observabilityMetrics.auth.loginSuccess += 1;
      res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err: any) {
      observabilityMetrics.auth.loginFailure += 1;
      void captureException(err, { scope: 'auth', flow: 'login' });
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', authenticate, csrfProtection, async (req: any, res) => {
    observabilityMetrics.auth.meChecks += 1;
    try {
      const user = await db.queryOne<any>('SELECT id, username, email, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?', [req.user.id]);
      res.json({ user, csrfToken: req.csrfToken() });
    } catch (err: any) {
      void captureException(err, { scope: 'auth', flow: 'me' });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/auth/me', authenticate, validateBody(profileUpdateSchema), async (req: any, res) => {
    const { avatar_url, banner_url, bio, username, email, currentPassword, newPassword } = req.body;
    try {
      const updates: string[] = [];
      const params: any[] = [];
      
      // Handle username update
      if (username !== undefined && username !== '') {
        // Check if username is already taken (by another user)
        const existingUser = await db.queryOne<any>('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id]);
        if (existingUser) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        updates.push('username = ?');
        params.push(username);
      }

      // Handle email update
      if (email !== undefined && email !== '') {
        // Check if email is already taken (by another user)
        const existingUser = await db.queryOne<any>('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
        if (existingUser) {
          return res.status(400).json({ error: 'Email already taken' });
        }
        updates.push('email = ?');
        params.push(email);
      }

      // Handle password update
      if (newPassword !== undefined && newPassword !== '') {
        // Verify current password
        const user = await db.queryOne<any>('SELECT password FROM users WHERE id = ?', [req.user.id]);
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      // Handle profile updates
      if (avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(avatar_url);
      }
      if (banner_url !== undefined) {
        updates.push('banner_url = ?');
        params.push(banner_url);
      }
      if (bio !== undefined) {
        updates.push('bio = ?');
        params.push(sanitizeUserText(bio));
      }
      
      if (updates.length > 0) {
        params.push(req.user.id);
        await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      
      const user = await db.queryOne<any>('SELECT id, username, email, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?', [req.user.id]);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    res.json({ message: 'Logged out' });
  });

  // Users
  app.get('/api/users/:id', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const user = await db.queryOne<any>('SELECT id, username, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?', [req.params.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-stats', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const stats = await db.query<any>('SELECT * FROM game_stats WHERE user_id = ?', [req.params.id]);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-transactions', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const transactions = await db.query<any>('SELECT * FROM game_transactions WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-matches', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const matches = await db.query<any>('SELECT * FROM game_matches WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(matches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/leaderboards/wealth', async (req, res) => {
    try {
      const leaderboard = await db.query<any>(`
        SELECT u.username, u.avatar_url, SUM(gs.total_wealth) as total_wealth
        FROM users u
        JOIN game_stats gs ON u.id = gs.user_id
        GROUP BY u.id
        ORDER BY total_wealth DESC
        LIMIT 10
      `);
      res.json(leaderboard);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Forums
  app.get('/api/forums/categories', async (req, res) => {
    try {
      const categories = await db.query<any>('SELECT * FROM forum_categories ORDER BY display_order ASC');
      const forums = await db.query<any>(`
        SELECT
          f.*,
          COALESCE(tc.thread_count, 0) AS thread_count,
          COALESCE(pc.post_count, 0) AS post_count
        FROM forums f
        LEFT JOIN (
          SELECT forum_id, COUNT(*) AS thread_count
          FROM threads
          GROUP BY forum_id
        ) tc ON tc.forum_id = f.id
        LEFT JOIN (
          SELECT t.forum_id, COUNT(p.id) AS post_count
          FROM threads t
          LEFT JOIN posts p ON p.thread_id = t.id
          GROUP BY t.forum_id
        ) pc ON pc.forum_id = f.id
        ORDER BY f.display_order ASC
      `);
      
      const result = categories.map(cat => ({
        ...cat,
        forums: forums.filter(f => f.category_id === cat.id)
      }));
      
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/community/stats', async (_req, res) => {
    try {
      const [users, threads, posts, servers] = await Promise.all([
        db.queryOne<any>('SELECT COUNT(*) as count FROM users'),
        db.queryOne<any>('SELECT COUNT(*) as count FROM threads'),
        db.queryOne<any>('SELECT COUNT(*) as count FROM posts'),
        db.queryOne<any>(`
          SELECT
            COUNT(*) as total_servers,
            SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_servers,
            SUM(CASE WHEN status = 'online' THEN COALESCE(players_current, 0) ELSE 0 END) as active_players
          FROM server_nodes
        `)
      ]);

      res.json({
        users: Number(users?.count || 0),
        threads: Number(threads?.count || 0),
        posts: Number(posts?.count || 0),
        total_servers: Number(servers?.total_servers || 0),
        online_servers: Number(servers?.online_servers || 0),
        active_players: Number(servers?.active_players || 0)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/discord/feed', async (_req, res) => {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return res.json({ items: [] });
    }

    try {
      const widgetResponse = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
        headers: { Accept: 'application/json' }
      });

      if (!widgetResponse.ok) {
        return res.status(widgetResponse.status).json({ error: 'Failed to fetch Discord feed', items: [] });
      }

      const widgetJson = await widgetResponse.json();
      const widgetData = discordWidgetResponseSchema.parse(widgetJson);

      const nowIso = new Date().toISOString();
      const memberItems = widgetData.members.slice(0, 6).map((member, index) => ({
        id: member.id || `member-${index}`,
        author: member.username || 'Unknown User',
        content: `${member.status || 'online'} in ${widgetData.name || 'Discord'}`,
        createdAt: nowIso,
        avatarUrl: member.avatar_url || null
      }));

      const channelItems = widgetData.channels
        .slice()
        .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 3)
        .map((channel) => ({
          id: `channel-${channel.id}`,
          author: 'Channel Update',
          content: `#${channel.name} is active`,
          createdAt: nowIso,
          avatarUrl: null as string | null
        }));

      const normalizedItems = [...memberItems, ...channelItems]
        .map((item) => ({
          id: String(item.id),
          author: String(item.author),
          content: String(item.content),
          createdAt: new Date(item.createdAt).toISOString(),
          ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {})
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json({
        items: normalizedItems
      });
    } catch (err: any) {
      res.status(502).json({ error: err.message || 'Discord feed unavailable', items: [] });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await db.query<any>('SELECT * FROM site_settings');
      const dictionary = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      const user = getUserFromToken(req);
      if (user?.role === 'admin') {
        return res.json(dictionary);
      }

      const publicSettings: Record<string, any> = {};
      for (const key of Object.keys(dictionary)) {
        if (isPublicSetting(key)) {
          publicSettings[key] = dictionary[key];
        }
      }

      return res.json(publicSettings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const legacyServerSetting = await db.queryOne<any>("SELECT value FROM site_settings WHERE `key` = 'network_servers'");
  const existingNodeCount = await db.queryOne<any>('SELECT COUNT(*) as count FROM server_nodes');
  if (legacyServerSetting?.value && Number(existingNodeCount?.count || 0) === 0) {
    await syncServerNodesFromJson(String(legacyServerSetting.value));
  }

  app.get('/api/servers', async (_req, res) => {
    try {
      const servers = await db.query<any>(`
        SELECT id, name, ip, region, game, map, players_current, status
        FROM server_nodes
        ORDER BY created_at DESC
      `);
      const normalized = servers.map((server) => ({
        ...server,
        players_current: Number(server.players_current) || 0,
        players: Number(server.players_current) || 0,
        status: server.status === 'online' ? 'online' : 'offline'
      }));
      res.json(normalized);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/servers', authenticate, isAdmin, async (req, res) => {
    try {
      const payload = serverNodeSchema.parse(req.body);
      await db.execute(
        'INSERT INTO server_nodes (name, ip, region, game, map, players_current, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [payload.name, payload.ip, payload.region, payload.game, payload.map, 0, 'offline']
      );
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/servers/:id/status', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    const { id } = req.params;
    const status = req.body?.status === 'online' ? 'online' : 'offline';
    const players = Number.isFinite(Number(req.body?.players)) ? Math.max(0, Number(req.body.players)) : 0;

    try {
      await db.execute(
        'UPDATE server_nodes SET status = ?, players_current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, players, id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Admin Metrics
  app.get('/api/admin/metrics', authenticate, isAdmin, async (req, res) => {
    try {
      const users = await db.queryOne<any>('SELECT COUNT(*) as count FROM users');
      const threads = await db.queryOne<any>('SELECT COUNT(*) as count FROM threads');
      const posts = await db.queryOne<any>('SELECT COUNT(*) as count FROM posts');
      const reports = await db.queryOne<any>("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'");
      
      res.json({
        totalUsers: users.count,
        totalThreads: threads.count,
        totalPosts: posts.count,
        pendingReports: reports.count
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Forums & Threads
  app.get('/api/forums/:id', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const forum = await db.queryOne<any>('SELECT * FROM forums WHERE id = ?', [req.params.id]);
      const threads = await db.query<any>(`
        SELECT
          t.*,
          u.username as author_name,
          COUNT(p.id) as post_count
        FROM threads t 
        JOIN users u ON t.author_id = u.id 
        LEFT JOIN posts p ON p.thread_id = t.id
        WHERE t.forum_id = ? 
        GROUP BY t.id, u.username
        ORDER BY t.is_pinned DESC, t.created_at DESC
      `, [req.params.id]);
      res.json({ forum, threads });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/threads', authenticate, validateBody(threadCreateSchema), async (req: any, res) => {
    const { forum_id, title, content } = req.body;
    const sanitizedTitle = sanitizeUserText(title);
    const sanitizedContent = sanitizeUserText(content);
    try {
      // Fetch forum to check min_role_to_thread permission
      const forum = await db.queryOne<any>('SELECT id, min_role_to_thread FROM forums WHERE id = ?', [forum_id]);
      if (!forum) {
        return res.status(404).json({ error: 'Forum not found' });
      }

      // Check if user's role meets the minimum role requirement for this forum
      if (!meetsMinRole(req.user.role, forum.min_role_to_thread)) {
        return res.status(403).json({ error: 'You do not have permission to create threads in this forum' });
      }

      const result = await db.execute('INSERT INTO threads (forum_id, author_id, title) VALUES (?, ?, ?)', [forum_id, req.user.id, sanitizedTitle]);
      const threadId = result.lastInsertRowid || result.insertId;
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [threadId, req.user.id, sanitizedContent]);
      res.json({ id: threadId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/threads/:id', validateParams(idParamSchema), async (req: any, res) => {
    try {
      const thread = await db.queryOne<any>(`
        SELECT t.*, u.username as author_name, f.name as forum_name 
        FROM threads t 
        JOIN users u ON t.author_id = u.id 
        JOIN forums f ON t.forum_id = f.id 
        WHERE t.id = ?
      `, [req.params.id]);
      const posts = await db.query<any>(`
        SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role 
        FROM posts p 
        JOIN users u ON p.author_id = u.id 
        WHERE p.thread_id = ? 
        ORDER BY p.created_at ASC
      `, [req.params.id]);
      res.json({ thread, posts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/threads', validateQuery(categoryIdQuerySchema), async (req: any, res) => {
    const { categoryId } = req.query;
    try {
      const threads = await db.query<any>(`
        SELECT 
          t.id,
          t.title,
          t.views,
          t.created_at as createdAt,
          u.username as author,
          (SELECT COUNT(*) - 1 FROM posts p WHERE p.thread_id = t.id) as replies
        FROM threads t
        JOIN users u ON u.id = t.author_id
        JOIN forums f ON f.id = t.forum_id
        WHERE (? IS NULL OR f.category_id = ?)
        ORDER BY t.is_pinned DESC, t.updated_at DESC
      `, [categoryId || null, categoryId || null]);
      res.json(threads);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/posts', authenticate, validateBody(postCreateSchema), async (req: any, res) => {
    const { thread_id, content } = req.body;
    const sanitizedContent = sanitizeUserText(content);
    try {
      // Fetch thread and its forum to check permissions
      const thread = await db.queryOne<any>(`
        SELECT t.id, f.min_role_to_thread
        FROM threads t
        JOIN forums f ON t.forum_id = f.id
        WHERE t.id = ?
      `, [thread_id]);
      
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      // Check if user's role meets the minimum role requirement for this forum
      if (!meetsMinRole(req.user.role, thread.min_role_to_thread)) {
        return res.status(403).json({ error: 'You do not have permission to post in this forum' });
      }

      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [thread_id, req.user.id, sanitizedContent]);
      await db.execute('UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [thread_id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/posts/:id', authenticate, validateParams(idParamSchema), validateBody(postUpdateSchema), async (req: any, res) => {
    const { content, is_hidden, is_deleted } = req.body;
    try {
      const post = await db.queryOne<any>('SELECT * FROM posts WHERE id = ?', [req.params.id]);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const isStaff = isStaffRole(req.user.role);
      const isOwner = post.author_id === req.user.id;
      if (!isOwner && !isStaff) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if ((is_hidden !== undefined || is_deleted !== undefined) && !isStaff) {
        return res.status(403).json({ error: 'Only moderators can hide/delete posts' });
      }

      const updates: string[] = [];
      const params: any[] = [];
      const moderationEvents: Array<{ action: string; reason: string }> = [];

      if (content !== undefined) {
        updates.push('content = ?');
        params.push(sanitizeUserText(content));
      }
      if (is_hidden !== undefined) {
        updates.push('is_hidden = ?');
        params.push(is_hidden ? 1 : 0);
        if ((post.is_hidden ?? 0) !== (is_hidden ? 1 : 0)) {
          moderationEvents.push({
            action: is_hidden ? 'hide_post' : 'unhide_post',
            reason: `Post ${is_hidden ? 'hidden' : 'unhidden'} via /api/posts/:id PATCH`
          });
        }
      }
      if (is_deleted !== undefined) {
        updates.push('is_deleted = ?');
        params.push(is_deleted ? 1 : 0);
        if ((post.is_deleted ?? 0) !== (is_deleted ? 1 : 0)) {
          moderationEvents.push({
            action: is_deleted ? 'delete_post' : 'restore_post',
            reason: `Post ${is_deleted ? 'deleted' : 'restored'} via /api/posts/:id PATCH`
          });
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await db.execute(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);

      if (isStaff && moderationEvents.length > 0) {
        for (const event of moderationEvents) {
          await createModerationAction(req.user.id, event.action, 'post', Number(req.params.id), event.reason);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/threads/:id', authenticate, validateParams(idParamSchema), validateBody(threadUpdateSchema), async (req: any, res) => {
    const { is_pinned, is_locked, is_solved, is_hidden } = req.body;
    if (!['admin', 'moderator'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    try {
      const thread = await db.queryOne<any>('SELECT * FROM threads WHERE id = ?', [req.params.id]);
      if (!thread) return res.status(404).json({ error: 'Thread not found' });

      const isStaff = isStaffRole(req.user.role);
      const isOwner = thread.author_id === req.user.id;

      if (is_pinned !== undefined && !isStaff) {
        return res.status(403).json({ error: 'Only moderators can pin/unpin threads' });
      }
      if (is_hidden !== undefined && !isStaff) {
        return res.status(403).json({ error: 'Only moderators can hide/unhide threads' });
      }
      if ((is_locked !== undefined || is_solved !== undefined) && !isStaff && !isOwner) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updates: string[] = [];
      const params: any[] = [];
      const moderationEvents: Array<{ action: string; reason: string }> = [];

      if (is_pinned !== undefined) {
        updates.push('is_pinned = ?');
        params.push(is_pinned ? 1 : 0);
        if ((thread.is_pinned ?? 0) !== (is_pinned ? 1 : 0)) {
          moderationEvents.push({
            action: is_pinned ? 'pin_thread' : 'unpin_thread',
            reason: `Thread ${is_pinned ? 'pinned' : 'unpinned'} via /api/threads/:id PATCH`
          });
        }
      }
      if (is_locked !== undefined) {
        updates.push('is_locked = ?');
        params.push(is_locked ? 1 : 0);
        if (isStaff && (thread.is_locked ?? 0) !== (is_locked ? 1 : 0)) {
          moderationEvents.push({
            action: is_locked ? 'lock_thread' : 'unlock_thread',
            reason: `Thread ${is_locked ? 'locked' : 'unlocked'} via /api/threads/:id PATCH`
          });
        }
      }
      if (is_solved !== undefined) {
        updates.push('is_solved = ?');
        params.push(is_solved ? 1 : 0);
        if (isStaff && (thread.is_solved ?? 0) !== (is_solved ? 1 : 0)) {
          moderationEvents.push({
            action: is_solved ? 'solve_thread' : 'unsolve_thread',
            reason: `Thread ${is_solved ? 'solved' : 'unsolved'} via /api/threads/:id PATCH`
          });
        }
      }
      if (is_hidden !== undefined) {
        updates.push('is_hidden = ?');
        params.push(is_hidden ? 1 : 0);
        if ((thread.is_hidden ?? 0) !== (is_hidden ? 1 : 0)) {
          moderationEvents.push({
            action: is_hidden ? 'hide_thread' : 'unhide_thread',
            reason: `Thread ${is_hidden ? 'hidden' : 'unhidden'} via /api/threads/:id PATCH`
          });
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await db.execute(`UPDATE threads SET ${updates.join(', ')} WHERE id = ?`, params);

      if (isStaff && moderationEvents.length > 0) {
        for (const event of moderationEvents) {
          await createModerationAction(req.user.id, event.action, 'thread', Number(req.params.id), event.reason);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/threads/:id', authenticate, validateParams(idParamSchema), async (req: any, res) => {
    try {
      const thread = await db.queryOne<any>('SELECT * FROM threads WHERE id = ?', [req.params.id]);
      if (!thread) return res.status(404).json({ error: 'Thread not found' });
      const isStaff = isStaffRole(req.user.role);
      const isOwner = thread.author_id === req.user.id;
      if (!isStaff && !isOwner) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await db.execute('DELETE FROM posts WHERE thread_id = ?', [req.params.id]);
      await db.execute('DELETE FROM threads WHERE id = ?', [req.params.id]);

      if (isStaff) {
        await createModerationAction(
          req.user.id,
          'delete_thread',
          'thread',
          Number(req.params.id),
          'Thread deleted via /api/threads/:id DELETE'
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reports', authenticate, validateBody(reportCreateSchema), async (req: any, res) => {
    const { target_type, target_id, reason } = req.body;
    try {
      await db.execute(
        'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
        [req.user.id, target_type, target_id, reason]
      );

      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Members
  app.get('/api/members', validateQuery(memberSearchQuerySchema), async (req: any, res) => {
    try {
      const search = req.query.search || '';

      const members = search
        ? await db.query<any>(
            'SELECT id, username, role, avatar_url, created_at FROM users WHERE username LIKE ? COLLATE NOCASE ORDER BY created_at DESC',
            [`%${search}%`]
          )
        : await db.query<any>('SELECT id, username, role, avatar_url, created_at FROM users ORDER BY created_at DESC');

      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Store
  app.get('/api/store/products', async (req, res) => {
    try {
      const products = await db.query<any>('SELECT * FROM products');
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cart management - stored in database
  app.post('/api/cart', authenticate, validateBody(cartItemSchema), async (req: any, res) => {
    try {
      const { productId, quantity } = req.body;

      // Fetch product to verify it exists and get price
      const product = await db.queryOne<any>('SELECT id, name, price, stock FROM products WHERE id = ?', [productId]);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get or create user's cart
      let cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
      if (!cart) {
        const cartResult = await db.execute('INSERT INTO carts (user_id) VALUES (?)', [req.user.id]);
        cart = { id: cartResult.lastInsertRowid || cartResult.insertId };
      }

      // Check if item already exists in cart
      const existingItem = await db.queryOne<any>(
        'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cart.id, productId]
      );

      if (existingItem) {
        // Update existing item quantity
        await db.execute(
          'UPDATE cart_items SET quantity = quantity + ?, price = ? WHERE id = ?',
          [quantity, product.price, existingItem.id]
        );
      } else {
        // Add new item to cart
        await db.execute(
          'INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [cart.id, productId, quantity, product.price]
        );
      }

      // Update cart timestamp
      await db.execute('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cart.id]);

      // Get cart size for response
      const cartSize = await db.queryOne<any>(
        'SELECT COUNT(*) as count FROM cart_items WHERE cart_id = ?',
        [cart.id]
      );

      res.json({ success: true, cartSize: cartSize.count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cart', authenticate, async (req: any, res) => {
    try {
      // Get user's cart
      const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
      if (!cart) {
        return res.json({ items: [], total: 0, count: 0 });
      }

      // Get cart items with product details
      const items = await db.query<any>(`
        SELECT ci.product_id as productId, ci.quantity, ci.price, p.name
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ?
      `, [cart.id]);

      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      res.json({ items, total, count: items.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cart/:productId', authenticate, validateParams(productIdParamSchema), async (req: any, res) => {
    try {
      const productId = req.params.productId;

      // Get user's cart
      const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
      if (!cart) {
        return res.status(404).json({ error: 'Cart not found' });
      }

      // Check if item exists in cart
      const item = await db.queryOne<any>(
        'SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cart.id, productId]
      );
      if (!item) {
        return res.status(404).json({ error: 'Item not in cart' });
      }

      // Remove item from cart
      await db.execute('DELETE FROM cart_items WHERE id = ?', [item.id]);

      // Update cart timestamp
      await db.execute('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cart.id]);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/orders', authenticate, async (req: any, res) => {
    try {
      // Get user's cart from database
      const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
      if (!cart) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      // Get cart items
      const items = await db.query<any>(`
        SELECT ci.product_id, ci.quantity, ci.price, p.name
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ?
      `, [cart.id]);

      if (items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create order in database
      const orderResult = await db.execute(
        'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
        [req.user.id, totalPrice, 'pending']
      );
      const orderId = orderResult.lastInsertRowid || orderResult.insertId;

      // Create order items
      for (const item of items) {
        await db.execute(
          'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.price]
        );
      }

      // Clear user's cart
      await db.execute('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);

      res.json({
        id: orderId,
        userId: req.user.id,
        totalPrice,
        itemsCount: items.length,
        status: 'pending'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders', authenticate, async (req: any, res) => {
    try {
      const orders = await db.query<any>(
        'SELECT id, total_amount as total_price, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id]
      );
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders/:id', authenticate, validateParams(idParamSchema), async (req: any, res) => {
    try {
      const order = await db.queryOne<any>(
        'SELECT * FROM orders WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Payment endpoints
  app.get('/api/payments/providers', (req, res) => {
    res.json({ providers: paymentProviders });
  });

  app.post('/api/payments/stripe/create-intent', authenticate, async (req: any, res) => {
    try {
      const { amount, currency = 'usd' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const paymentIntent = await createStripePaymentIntent(amount, currency);

      res.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments/paypal/create-order', authenticate, async (req: any, res) => {
    try {
      const { amount, currency = 'USD' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const order = await createPayPalOrder(amount, currency);
      const approvalUrl = Array.isArray(order.links)
        ? order.links.find((link: any) => link.rel === 'approve')?.href
        : undefined;

      res.json({
        orderId: order.id,
        status: order.status,
        approvalUrl
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments/stripe/confirm/:orderId', authenticate, validateParams(orderIdParamSchema), async (req: any, res) => {
    try {
      const { paymentIntentId } = req.body;
      const orderId = req.params.orderId;

      // Verify order belongs to user and is pending
      const order = await db.queryOne<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!['pending', 'payment_pending'].includes(String(order.status || ''))) {
        return res.status(400).json({ error: 'Order is not in pending status' });
      }
      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Payment intent ID is required' });
      }

      const pending = await markOrderPaymentPending({
        db,
        orderId: Number(orderId),
        userId: req.user.id,
        provider: 'stripe',
        providerPaymentId: String(paymentIntentId)
      });
      if (!pending.updated) {
        return res.status(400).json({ error: 'Order is not in a payable status' });
      }

      res.json({ success: true, status: 'payment_pending', message: 'Awaiting Stripe webhook confirmation' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments/paypal/capture/:orderId', authenticate, validateParams(orderIdParamSchema), async (req: any, res) => {
    try {
      const { paypalOrderId } = req.body;
      const orderId = req.params.orderId;

      // Verify order belongs to user and is pending
      const order = await db.queryOne<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!['pending', 'payment_pending'].includes(String(order.status || ''))) {
        return res.status(400).json({ error: 'Order is not in pending status' });
      }

      const success = await capturePayPalOrder(paypalOrderId);

      if (!success) {
        res.status(400).json({ error: 'Payment capture failed' });
        return;
      }

      const pending = await markOrderPaymentPending({
        db,
        orderId: Number(orderId),
        userId: req.user.id,
        provider: 'paypal',
        providerPaymentId: String(paypalOrderId)
      });
      if (!pending.updated) {
        return res.status(400).json({ error: 'Order is not in a payable status' });
      }

      res.json({ success: true, status: 'payment_pending', message: 'Awaiting PayPal webhook confirmation' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments/stripe/webhook', async (req: any, res) => {
    try {
      const rawPayload = req.rawBody || JSON.stringify(req.body || {});
      const signature = req.get('stripe-signature');
      if (!verifyStripeWebhookSignature(rawPayload, signature)) {
        return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
      }

      const result = await processStripeWebhookEvent(db, req.body || {});
      if (!result.accepted && result.reason === 'order_not_found') {
        return res.status(404).json({ error: 'Order not found for webhook event' });
      }

      return res.json({
        received: true,
        accepted: result.accepted,
        reason: result.reason || null,
        orderId: result.orderId ?? null
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/payments/paypal/webhook', async (req: any, res) => {
    try {
      const rawPayload = req.rawBody || JSON.stringify(req.body || {});
      const valid = verifyPayPalWebhookSignature({
        payload: rawPayload,
        signature: req.get('paypal-transmission-sig'),
        transmissionId: req.get('paypal-transmission-id'),
        transmissionTime: req.get('paypal-transmission-time'),
        webhookId: req.get('paypal-webhook-id') || process.env.PAYPAL_WEBHOOK_ID
      });
      if (!valid) {
        return res.status(400).json({ error: 'Invalid PayPal webhook signature' });
      }

      const result = await processPayPalWebhookEvent(db, req.body || {});
      if (!result.accepted && result.reason === 'order_not_found') {
        return res.status(404).json({ error: 'Order not found for webhook event' });
      }

      return res.json({
        received: true,
        accepted: result.accepted,
        reason: result.reason || null,
        orderId: result.orderId ?? null
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Support
  app.get('/api/tickets', authenticate, async (req: any, res) => {
    try {
      const tickets = await db.query<any>('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets', authenticate, validateBody(supportTicketCreateSchema), async (req: any, res) => {
    const { subject, priority, message, ticket_type } = req.body;
    try {
      const result = await db.execute('INSERT INTO tickets (user_id, subject, priority, ticket_type) VALUES (?, ?, ?, ?)', [req.user.id, sanitizeUserText(subject), priority, ticket_type || 'user']);
      const ticketId = result.lastInsertRowid || result.insertId;
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticketId, req.user.id, sanitizeUserText(message)]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tickets/:id', authenticate, validateParams(idParamSchema), async (req: any, res) => {
    try {
      const ticket = await db.queryOne<any>(`
        SELECT t.*, u.username as author_name, u.avatar_url as author_avatar
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = ? AND t.user_id = ?
      `, [req.params.id, req.user.id]);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const messages = await db.query<any>(`
        SELECT tm.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role
        FROM ticket_messages tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.ticket_id = ?
        ORDER BY tm.created_at ASC
      `, [req.params.id]);
      res.json({ ticket, messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets/:id/messages', authenticate, validateParams(idParamSchema), validateBody(ticketMessageSchema), async (req: any, res) => {
    const { message } = req.body;
    try {
      const ticket = await db.queryOne<any>('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, req.user.id, sanitizeUserText(message)]);
      await db.execute("UPDATE tickets SET status = 'pending' WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin
  app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
    try {
      const users = await db.query<any>('SELECT id, username, email, role, created_at FROM users');
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/users/:id/role', authenticate, isAdmin, validateParams(idParamSchema), validateBody(roleUpdateSchema), async (req: any, res) => {
    const { role } = req.body;
    try {
      await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/reports', authenticate, isAdmin, async (req, res) => {
    try {
      const reports = await db.query<any>(`
        SELECT r.*, u.username as reporter_name 
        FROM reports r 
        JOIN users u ON r.reporter_id = u.id 
        ORDER BY r.created_at DESC
      `);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/reports/:id/action', authenticate, isAdmin, validateParams(idParamSchema), validateBody(adminReportActionSchema), async (req: any, res) => {
    const { action, reason } = req.body;
    try {
      const report = await db.queryOne<any>('SELECT * FROM reports WHERE id = ?', [req.params.id]);
      if (!report) return res.status(404).json({ error: 'Report not found' });

      if (action === 'hide' && report.target_type === 'post') {
        await db.execute('UPDATE posts SET is_hidden = 1 WHERE id = ?', [report.target_id]);
      }
      if (action === 'remove' && report.target_type === 'post') {
        await db.execute('UPDATE posts SET is_deleted = 1 WHERE id = ?', [report.target_id]);
      }
      if (action === 'remove' && report.target_type === 'thread') {
        await db.execute('DELETE FROM threads WHERE id = ?', [report.target_id]);
      }
      if (action === 'suspend' && report.target_type === 'user') {
        await db.execute("UPDATE users SET role = 'suspended' WHERE id = ?", [report.target_id]);
      }

      await db.execute("UPDATE reports SET status = 'resolved' WHERE id = ?", [req.params.id]);
      await db.execute(
        'INSERT INTO moderation_actions (moderator_id, action_type, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, action, report.target_type, report.target_id, reason || null]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/audit-log', authenticate, isAdmin, async (req, res) => {
    try {
      const logs = await db.query<any>(`
        SELECT m.*, u.username as moderator_name 
        FROM moderation_actions m 
        JOIN users u ON m.moderator_id = u.id 
        ORDER BY m.created_at DESC
      `);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/settings', authenticate, isAdmin, async (req, res) => {
    try {
      const settings = await db.query<any>('SELECT * FROM site_settings');
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/settings', authenticate, isAdmin, validateBody(adminSettingsUpdateSchema), async (req, res) => {
    const settings = Array.isArray(req.body) ? req.body : req.body.settings;
    try {
      for (const setting of settings) {
        await db.execute(
          'UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
          [typeof setting.value === 'string' ? setting.value.trim() : JSON.stringify(setting.value), setting.key]
        );
      }

      const networkServersSetting = settings.find((setting: any) => setting.key === 'network_servers');
      if (networkServersSetting) {
        await syncServerNodesFromJson(String(networkServersSetting.value || '[]'));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/analytics', authenticate, isAdmin, async (req, res) => {
    try {
      const users = await db.queryOne<any>('SELECT COUNT(*) as count FROM users');
      const posts = await db.queryOne<any>('SELECT COUNT(*) as count FROM posts');
      const threads = await db.queryOne<any>('SELECT COUNT(*) as count FROM threads');
      const revenue = await db.queryOne<any>('SELECT COALESCE(SUM(total_amount), 0) as value FROM orders');

      const registrations = await db.query<any>(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= datetime('now', '-6 days')
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `);
      const orders = await db.query<any>(`
        SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE created_at >= datetime('now', '-6 days')
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `);

      res.json({
        stats: { users: users.count, posts: posts.count, threads: threads.count, revenue: Number(revenue.value || 0) },
        registrations,
        orders
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/tags', authenticate, isAdmin, async (req, res) => {
    try {
      const tags = await db.query<any>('SELECT * FROM tags ORDER BY created_at DESC');
      res.json(tags);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tags', authenticate, isAdmin, async (req, res) => {
    const { name, color } = req.body;
    try {
      await db.execute('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/tags/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    const { name, color } = req.body;
    try {
      await db.execute('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/tags/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    try {
      await db.execute('DELETE FROM tags WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/categories', authenticate, isAdmin, validateBody(forumCategoryCreateSchema), async (req, res) => {
    const { name } = req.body;
    try {
      await db.execute('INSERT INTO forum_categories (name) VALUES (?)', [name]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/categories/:id', authenticate, isAdmin, validateBody(forumCategoryUpdateSchema), async (req, res) => {
    const { name, display_order } = req.body;
    try {
      await db.execute('UPDATE forum_categories SET name = ?, display_order = ? WHERE id = ?', [name, display_order || 0, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/categories/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    try {
      await db.execute('DELETE FROM forum_categories WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/forums', authenticate, isAdmin, validateBody(forumCreateSchema), async (req, res) => {
    const { category_id, name, description, min_role_to_thread, display_order } = req.body;
    try {
      await db.execute(
        'INSERT INTO forums (category_id, name, description, min_role_to_thread, display_order) VALUES (?, ?, ?, ?, ?)',
        [category_id, name, description || '', min_role_to_thread || 'member', display_order || 0]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/forums/:id', authenticate, isAdmin, validateBody(forumCreateSchema), async (req, res) => {
    const { category_id, name, description, min_role_to_thread, display_order } = req.body;
    try {
      await db.execute(
        'UPDATE forums SET category_id = ?, name = ?, description = ?, min_role_to_thread = ?, display_order = ? WHERE id = ?',
        [category_id, name, description || '', min_role_to_thread || 'member', display_order || 0, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/forums/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    try {
      await db.execute('DELETE FROM forums WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/products', authenticate, isAdmin, async (req, res) => {
    const { name, description, price, image_url, category, stock } = req.body;
    try {
      await db.execute(
        'INSERT INTO products (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description || '', price, image_url || '', category || 'Digital', stock ?? -1]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/products/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    const { name, description, price, image_url, category, stock } = req.body;
    try {
      await db.execute(
        'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ? WHERE id = ?',
        [name, description || '', price, image_url || '', category || 'Digital', stock ?? -1, req.params.id]
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/products/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    try {
      await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/tickets', authenticate, isAdmin, async (req, res) => {
    try {
      const tickets = await db.query<any>(`
        SELECT 
          t.*,
          u.username as author_name,
          u.avatar_url as author_avatar,
          (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) as message_count
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
      `);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/tickets/:id', authenticate, isAdmin, validateParams(idParamSchema), async (req: any, res) => {
    try {
      const ticket = await db.queryOne<any>(`
        SELECT t.*, u.username as author_name, u.avatar_url as author_avatar
        FROM tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.id = ?
      `, [req.params.id]);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      const messages = await db.query<any>(`
        SELECT tm.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role
        FROM ticket_messages tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.ticket_id = ?
        ORDER BY tm.created_at ASC
      `, [req.params.id]);
      res.json({ ticket, messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tickets/:id/messages', authenticate, isAdmin, validateParams(idParamSchema), validateBody(ticketMessageSchema), async (req: any, res) => {
    const { message } = req.body;
    try {
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, req.user.id, sanitizeUserText(message)]);
      await db.execute("UPDATE tickets SET status = 'pending' WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/tickets/:id', authenticate, isAdmin, validateParams(idParamSchema), validateBody(adminTicketStatusSchema), async (req: any, res) => {
    const { status } = req.body;
    try {
      await db.execute('UPDATE tickets SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- MESSAGING & NOTIFICATIONS ---

  app.get('/api/messages/conversations', authenticate, async (req: any, res) => {
    try {
      const conversations = await db.query<any>(`
        SELECT 
          u.id, u.username, u.avatar_url,
          m.content as last_message, m.created_at as last_message_at,
          (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM users u
        JOIN (
          SELECT 
            CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
            MAX(created_at) as max_date
          FROM messages
          WHERE sender_id = ? OR receiver_id = ?
          GROUP BY other_user_id
        ) latest ON u.id = latest.other_user_id
        JOIN messages m ON (
          (m.sender_id = ? AND m.receiver_id = u.id) OR (m.sender_id = u.id AND m.receiver_id = ?)
        ) AND m.created_at = latest.max_date
        ORDER BY last_message_at DESC
      `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/messages/:userId', authenticate, validateParams(userIdParamSchema), async (req: any, res) => {
    try {
      const messages = await db.query<any>(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
      `, [req.user.id, req.params.userId, req.params.userId, req.user.id]);
      
      // Mark as read
      await db.execute('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [req.params.userId, req.user.id]);
      
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/messages', authenticate, validateBody(directMessageSchema), async (req: any, res) => {
    const { receiver_id, content } = req.body;
    const sanitizedContent = sanitizeUserText(content);
    try {
      const result = await db.execute('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [req.user.id, receiver_id, sanitizedContent]);
      const messageId = result.lastInsertRowid || result.insertId;
      const message = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [messageId]);
      
      if (!message) {
        throw new Error('Failed to retrieve created message');
      }
      
      // Emit via socket to all devices/tabs for receiver
      const receiverSocketIds = userSockets.get(Number(receiver_id)) || new Set<string>();
      for (const socketId of receiverSocketIds) {
        io.to(socketId).emit('new_message', message);
      }

      // Create notification
      const sender = await db.queryOne<any>('SELECT username FROM users WHERE id = ?', [req.user.id]);
      await db.execute('INSERT INTO notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)', 
        [receiver_id, 'message', `New message from ${sender.username}`, sanitizedContent.substring(0, 50), `/messages?user=${req.user.id}`]);
      
      const notification = await db.queryOne<any>('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1');
      for (const socketId of receiverSocketIds) {
        io.to(socketId).emit('new_notification', notification);
      }

      res.json(message);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/notifications', authenticate, async (req: any, res) => {
    try {
      const notifications = await db.query<any>('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/notifications/:id/read', authenticate, validateParams(idParamSchema), async (req: any, res) => {
    try {
      await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/notifications/read-all', authenticate, async (req: any, res) => {
    try {
      await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- MEDIA ---
  app.post('/api/media/animate', authenticate, async (req: any, res) => {
    const startedAt = Date.now();
    if (!mediaClient) {
      return res.status(503).json({ error: 'Media provider is not configured. Missing GEMINI_API_KEY.' });
    }

    const parsedPayload = mediaAnimatePayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return res.status(400).json({
        error: 'Invalid media generation payload.',
        details: parsedPayload.error.issues.map(issue => issue.message)
      });
    }

    const { imageBase64, prompt } = parsedPayload.data;
    const imageMatch = dataUriRegex.exec(imageBase64);
    const mimeType = imageMatch?.groups?.mime;
    const inlineData = imageMatch?.groups?.data;

    if (!mimeType || !inlineData || !/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) {
      return res.status(400).json({ error: 'imageBase64 must be a valid data URI (PNG/JPEG/WEBP).' });
    }

    if (!prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required for animation.' });
    }

    try {
      const providerOperation = await mediaClient.models.generateVideos({
        model: MEDIA_MODEL,
        source: {
          prompt: prompt.trim(),
          image: {
            imageBytes: inlineData,
            mimeType
          }
        },
        config: {
          numberOfVideos: 1,
          aspectRatio: '16:9'
        }
      });

      const operationName = providerOperation.name || `op_${Date.now()}_${req.user.id}`;

      mediaOperations.set(operationName, {
        ownerId: req.user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + MEDIA_OPERATION_TTL_MS,
        status: providerOperation.done ? 'done' : 'in_progress',
        providerOperation,
        uri: providerOperation.response?.generatedVideos?.[0]?.video?.uri
      });

      res.json({ operationName });
    } catch (err: any) {
      console.error('Media provider animate error:', err);
      void captureException(err, { scope: 'media', endpoint: '/api/media/animate', userId: req.user.id });
      const providerMessage = err?.message || 'Unknown media provider error';
      res.status(502).json({ error: `Media provider failed to start generation: ${providerMessage}` });
    } finally {
      const durationMs = Date.now() - startedAt;
      recordLatency(observabilityMetrics.media['/api/media/animate'], durationMs);
      logStructured('info', 'media.latency', {
        endpoint: '/api/media/animate',
        durationMs,
        ...summarizeLatency(observabilityMetrics.media['/api/media/animate'])
      });
    }
  });

  app.get('/api/media/poll', authenticate, async (req: any, res) => {
    const startedAt = Date.now();
    pruneExpiredMediaOperations();

    const operationName = String(req.query.operationName || '');
    if (!operationName) {
      return res.status(400).json({ error: 'operationName query parameter is required.' });
    }

    const operation = mediaOperations.get(operationName);
    if (!operation) return res.status(410).json({ error: 'Operation not found or expired.' });
    if (operation.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    if (operation.status === 'error') {
      return res.json({ done: true, error: operation.error || 'Generation failed.' });
    }

    if (operation.status === 'done') {
      if (!operation.uri) {
        return res.json({ done: true, error: 'Generation completed without a video URI.' });
      }
      return res.json({ done: true, uri: operation.uri });
    }

    if (!mediaClient) {
      operation.status = 'error';
      operation.error = 'Media provider is not configured. Missing GEMINI_API_KEY.';
      return res.status(503).json({ error: operation.error });
    }

    try {
      const latestOperation = await mediaClient.operations.getVideosOperation({
        operation: operation.providerOperation
      });

      operation.providerOperation = latestOperation;
      operation.expiresAt = Date.now() + MEDIA_OPERATION_TTL_MS;

      if (!latestOperation.done) {
        return res.json({ done: false });
      }

      const providerError = latestOperation.error?.message ? String(latestOperation.error.message) : '';
      if (providerError) {
        operation.status = 'error';
        operation.error = providerError;
        return res.json({ done: true, error: providerError });
      }

      const uri = latestOperation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        operation.status = 'error';
        operation.error = 'Provider returned no video URI.';
        return res.json({ done: true, error: operation.error });
      }

      operation.status = 'done';
      operation.uri = uri;
      return res.json({ done: true, uri });
    } catch (err: any) {
      console.error('Media provider poll error:', err);
      void captureException(err, { scope: 'media', endpoint: '/api/media/poll', userId: req.user.id });
      operation.status = 'error';
      operation.error = err?.message || 'Failed to poll media provider.';
      return res.status(502).json({ done: true, error: operation.error });
    } finally {
      const durationMs = Date.now() - startedAt;
      recordLatency(observabilityMetrics.media['/api/media/poll'], durationMs);
      logStructured('info', 'media.latency', {
        endpoint: '/api/media/poll',
        durationMs,
        ...summarizeLatency(observabilityMetrics.media['/api/media/poll'])
      });
    }
  });

  app.get('/api/admin/observability/metrics', authenticate, isAdmin, (_req, res) => {
    res.json({
      api: summarizeApiMetrics(),
      auth: observabilityMetrics.auth,
      media: {
        '/api/media/animate': summarizeLatency(observabilityMetrics.media['/api/media/animate']),
        '/api/media/poll': summarizeLatency(observabilityMetrics.media['/api/media/poll'])
      },
      socket: observabilityMetrics.socket
    });
  });

  // Error handling for CSRF and other failures
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.code === 'EBADCSRFTOKEN') {
      void captureException(err, { scope: 'csrf' });
      return res.status(403).json({ success: false, error: 'Invalid CSRF token', code: 'CSRF_INVALID_TOKEN' });
    }

    void captureException(err, {
      scope: 'express',
      path: req.path,
      method: req.method,
      userId: req?.user?.id ?? null
    });
    console.error('Unhandled error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error', code: 'INTERNAL_SERVER_ERROR' });
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware initialized.');
  } else {
    console.log('Running in production mode, serving static files...');
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const tryListen = (port: number, maxAttempts: number = 5) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${port}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
        const nextPort = port + 1;
        console.log(`Port ${port} is in use, trying ${nextPort}...`);
        server.close();
        tryListen(nextPort, maxAttempts - 1);
      } else {
        throw err;
      }
    });
  };

  tryListen(PORT);
}

start().catch(err => {
  void captureException(err, { scope: 'startup' });
  console.error('Fatal server error:', err);
});

process.on('unhandledRejection', (reason) => {
  void captureException(reason, { scope: 'process.unhandled_rejection' });
  logStructured('error', 'process.unhandled_rejection', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

process.on('uncaughtException', (err) => {
  void captureException(err, { scope: 'process.uncaught_exception' });
  logStructured('error', 'process.uncaught_exception', { message: err.message });
});
