import express from 'express';
import type { CookieOptions, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, type GenerateVideosOperation } from '@google/genai';
import { z } from 'zod';
import db, { initDb } from '../src/lib/db.js';
import { seedDb } from '../src/lib/seed.js';
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
} from '../src/lib/payments.js';
import { isPublicSetting } from '../src/lib/settingsAllowlist.js';
import { sanitizeUserText } from '../src/lib/sanitize.js';

const app = express();
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    (req as any).rawBody = buffer.toString('utf8');
  }
}));
app.use(cookieParser());

const csrfProtection = csurf({ cookie: true });
app.use((req, res, next) => {
  const path = req.path || '';
  if (
    path === '/api/payments/stripe/webhook' ||
    path === '/payments/stripe/webhook' ||
    path === '/api/payments/paypal/webhook' ||
    path === '/payments/paypal/webhook'
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
});

app.use((err: any, _req: Request, res: Response, next: express.NextFunction) => {
  if (err?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next(err);
});

// Vercel can invoke this catch-all function with either:
// - /api/<path> (direct hit), or
// - /<path> (already mounted at /api by the platform adapter).
// Normalize to /api/* so routes are stable in both execution modes.
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || '';
const AUTH_COOKIE_NAME = 'token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ERROR_TRACKING_WEBHOOK = process.env.ERROR_TRACKING_WEBHOOK || '';
const ERROR_TRACKING_WEBHOOK_CACHE_MS = 60_000;
const MEDIA_OPERATION_TTL_MS = 30 * 60 * 1000;
const MEDIA_MODEL = 'veo-2.0-generate-001';
const MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR = 5;
const MEDIA_MIN_POLL_INTERVAL_MS = 5_000;
const MEDIA_MAX_POLLS_PER_OPERATION = 120;
const dataUriRegex = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/;
const CLIENT_ORIGINS = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const HAS_SPLIT_ORIGIN_DEPLOYMENT = CLIENT_ORIGINS.length > 0;

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION && HAS_SPLIT_ORIGIN_DEPLOYMENT ? 'none' : 'lax',
  path: '/'
};
const parseEnvNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS = parseEnvNumber(process.env.AUTH_RATE_LIMIT_CREDENTIAL_WINDOW_MS, 10 * 60 * 1000);
const AUTH_RATE_LIMIT_CREDENTIAL_MAX = parseEnvNumber(process.env.AUTH_RATE_LIMIT_CREDENTIAL_MAX, 8);
const AUTH_RATE_LIMIT_SESSION_WINDOW_MS = parseEnvNumber(process.env.AUTH_RATE_LIMIT_SESSION_WINDOW_MS, 5 * 60 * 1000);
const AUTH_RATE_LIMIT_SESSION_MAX = parseEnvNumber(process.env.AUTH_RATE_LIMIT_SESSION_MAX, 30);
const ROLE_WEIGHT: Record<string, number> = {
  admin: 3,
  moderator: 2,
  member: 1
};

const authLoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128)
});
const authRegisterSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128)
});
const threadCreateSchema = z.object({
  forum_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1)
});
const postCreateSchema = z.object({
  thread_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1)
});
const supportTicketCreateSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  message: z.string().trim().min(1),
  ticket_type: z.enum(['user', 'admin']).optional().default('user')
});
const ticketMessageSchema = z.object({
  message: z.string().trim().min(1)
});
const directMessageSchema = z.object({
  receiver_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1)
});
const reportCreateSchema = z.object({
  target_type: z.enum(['post', 'thread', 'user']),
  target_id: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1)
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
const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive()
});
const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive()
});
const adminRoleUpdateSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member', 'suspended'])
});
const adminReportActionSchema = z.object({
  action: z.enum(['hide', 'remove', 'suspend', 'dismiss']),
  reason: z.string().trim().max(1000).optional()
});
const adminTicketStatusSchema = z.object({
  status: z.enum(['open', 'pending', 'closed'])
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

let bootPromise: Promise<void> | null = null;
let cachedErrorTrackingWebhook: { value: string; fetchedAt: number } | null = null;
const mediaClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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

type MediaOperationStatus = 'in_progress' | 'done' | 'error';
type MediaOperationRecord = {
  ownerId: number;
  createdAt: number;
  expiresAt: number;
  status: MediaOperationStatus;
  providerOperation: GenerateVideosOperation;
  uri?: string;
  error?: string;
  lastPolledAt?: number;
  pollCount: number;
};

type MediaQuotaRecord = {
  windowStartedAt: number;
  requestCount: number;
};

type LatencyMetrics = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
};

const observabilityMetrics = {
  media: {
    '/api/media/animate': { count: 0, totalMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0 } as LatencyMetrics,
    '/api/media/poll': { count: 0, totalMs: 0, minMs: Number.POSITIVE_INFINITY, maxMs: 0 } as LatencyMetrics
  },
  mediaOutages: {
    providerUnavailable: 0,
    providerFailures: 0,
    quotaRejected: 0,
    pollRateLimited: 0
  }
};

const mediaOperations = new Map<string, MediaOperationRecord>();
const mediaQuotas = new Map<number, MediaQuotaRecord>();

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
  maxMs: metric.count > 0 ? Number(metric.maxMs.toFixed(2)) : 0
});

const pruneExpiredMediaOperations = () => {
  const now = Date.now();
  for (const [operationName, operation] of mediaOperations.entries()) {
    if (operation.expiresAt <= now) {
      mediaOperations.delete(operationName);
    }
  }
};

setInterval(pruneExpiredMediaOperations, 60_000).unref();

async function ensureDefaultAuthUsers() {
  const hashedPassword = bcrypt.hashSync('password', 10);
  const isSQLite = 'pragma' in db;
  const insertUser = isSQLite
    ? 'INSERT OR IGNORE INTO users (username, email, password, role, bio) VALUES (?, ?, ?, ?, ?)'
    : 'INSERT IGNORE INTO users (username, email, password, role, bio) VALUES (?, ?, ?, ?, ?)';

  await db.execute(insertUser, ['admin', 'admin@nightrespawn.com', hashedPassword, 'admin', 'The platform administrator.']);
  await db.execute(insertUser, ['member', 'member@nightrespawn.com', hashedPassword, 'member', 'A regular community member.']);
}

async function ensureDb() {
  if (!bootPromise) {
    bootPromise = initDb()
      .then(() => ensureDefaultAuthUsers())
      .then(() => seedDb())
      .catch((err) => {
        bootPromise = null;
        throw err;
      });
  }
  await bootPromise;
}

const captureException = async (error: unknown, context: Record<string, unknown> = {}) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: 'serverless.exception', message, context }));

  const errorTrackingWebhook = await resolveErrorTrackingWebhook();
  if (!errorTrackingWebhook) {
    return;
  }

  try {
    const payload = {
      environment: process.env.NODE_ENV,
      message,
      stack: error instanceof Error ? error.stack : undefined,
      context
    };
    const response = await fetch(errorTrackingWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `[${process.env.NODE_ENV || 'unknown'}] ${message}`.slice(0, 1900),
        ...payload
      })
    });
    if (!response.ok) {
      const failureBody = await response.text().catch(() => '');
      console.warn(
        JSON.stringify({
          event: 'serverless.exception.webhook_rejected',
          status: response.status,
          statusText: response.statusText || '',
          body: failureBody.slice(0, 500)
        })
      );
    }
  } catch (webhookError) {
    console.warn('Failed to send exception webhook:', webhookError);
  }
};

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const statusCode = res.statusCode;
    const routePath = typeof req.route?.path === 'string' ? req.route.path : req.path;

    console.log(JSON.stringify({
      event: 'serverless.http.request',
      method: req.method,
      path: req.path,
      route: routePath,
      statusCode,
      durationMs: Number(durationMs.toFixed(2))
    }));

    if (statusCode >= 500) {
      void captureException(new Error(`HTTP ${statusCode} response`), {
        scope: 'serverless_api',
        method: req.method,
        path: req.path,
        route: routePath,
        statusCode
      });
    }
  });

  next();
});

function getTokenPayload(req: Request) {
  const token = req.cookies[AUTH_COOKIE_NAME];
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

async function requireAuthUser(req: Request, res: Response) {
  const payload = getTokenPayload(req);
  if (!payload?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  const user = await db.queryOne<any>('SELECT id, username, role FROM users WHERE id = ?', [payload.id]);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return user;
}

async function requireStaffUser(req: Request, res: Response) {
  const user = await requireAuthUser(req, res);
  if (!user) return null;
  if (!isStaffRole(user.role)) {
    res.status(403).json({ error: 'Staff access required' });
    return null;
  }
  return user;
}

async function requireAdminUser(req: Request, res: Response) {
  const user = await requireAuthUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

const validateBody = <T>(schema: z.ZodSchema<T>) => (req: Request, res: Response, next: express.NextFunction) => {
  const parsedPayload = schema.safeParse(req.body);
  if (!parsedPayload.success) {
    return res.status(400).json({ error: parsedPayload.error.issues[0]?.message || 'Invalid request payload' });
  }
  req.body = parsedPayload.data;
  next();
};
const validateParams = <T>(schema: z.ZodSchema<T>) => (req: Request, res: Response, next: express.NextFunction) => {
  const parsedParams = schema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: parsedParams.error.issues[0]?.message || 'Invalid route parameters' });
  }
  req.params = parsedParams.data as any;
  next();
};

const meetsMinRole = (userRole: string, minRole: string) => {
  const userWeight = ROLE_WEIGHT[userRole] ?? 0;
  const minWeight = ROLE_WEIGHT[minRole] ?? 0;
  return userWeight >= minWeight;
};

const isStaffRole = (role: string) => role === 'admin' || role === 'moderator';

const createRateLimit = (windowMs: number, maxRequests: number, errorMessage: string) => {
  const requests = new Map<string, number[]>();
  return (req: Request, res: Response, next: express.NextFunction) => {
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

app.use(async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Database initialization failed.' });
  }
});

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
app.use(['/api/auth/login', '/auth/login', '/api/auth/register', '/auth/register'], strictCredentialRateLimit);
app.use(['/api/auth/me', '/auth/me', '/api/auth/logout', '/auth/logout'], authSessionRateLimit);

const registerHandler = async (req: Request, res: Response) => {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    return res.status(500).json({ error: 'JWT_SECRET is required and must be at least 32 characters.' });
  }

  const { username, email, password } = req.body as z.infer<typeof authRegisterSchema>;
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    const user = await db.queryOne<any>('SELECT id, username, email, role FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(500).json({ error: 'Failed to load registered user' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    return res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Registration failed' });
  }
};
app.post(['/api/auth/register', '/auth/register'], validateBody(authRegisterSchema), registerHandler);

const loginHandler = async (req: Request, res: Response) => {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    return res.status(500).json({ error: 'JWT_SECRET is required and must be at least 32 characters.' });
  }

  const { username, password } = req.body || {};
  try {
    const user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(String(password || ''), user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
    return res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err: any) {
    await captureException(err, { scope: 'auth', flow: 'login' });
    return res.status(500).json({ error: err?.message || 'Login failed' });
  }
};
app.post(['/api/auth/login', '/auth/login'], validateBody(authLoginSchema), loginHandler);

const logoutHandler = (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
  return res.json({ message: 'Logged out' });
};
app.post(['/api/auth/logout', '/auth/logout'], logoutHandler);

const csrfTokenHandler = (_req: Request, res: Response) => {
  // Serverless API shim currently does not enforce CSRF middleware.
  // Return a stable shape expected by the frontend to avoid 404s.
  return res.json({ csrfToken: null });
};
app.get(['/api/csrf-token', '/csrf-token'], csrfTokenHandler);

app.post(['/api/telemetry/client-error', '/telemetry/client-error'], async (req: Request, res: Response) => {
  await captureException(req.body?.message || 'Unknown client error', {
    scope: 'frontend',
    payload: req.body || {}
  });

  return res.status(202).json({ accepted: true });
});

const meHandler = async (req: Request, res: Response) => {
  const payload = getTokenPayload(req);
  if (!payload?.id) {
    return res.json({ user: null, csrfToken: null });
  }
  try {
    const user = await db.queryOne<any>(
      'SELECT id, username, email, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!user) {
      return res.json({ user: null, csrfToken: null });
    }
    return res.json({ user, csrfToken: null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load user' });
  }
};
app.get(['/api/auth/me', '/auth/me'], meHandler);

const userProfileHandler = async (req: Request, res: Response) => {
  try {
    const user = await db.queryOne<any>(
      'SELECT id, username, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?',
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load user profile' });
  }
};
app.get(['/api/users/:id', '/users/:id'], userProfileHandler);

const membersHandler = async (req: Request, res: Response) => {
  const rawSearch = typeof req.query.search === 'string' ? req.query.search : '';
  const search = rawSearch.trim();

  try {
    const members = search
      ? await db.query<any>(
          `SELECT id, username, role, avatar_url, last_active, created_at
           FROM users
           WHERE username LIKE ?
           ORDER BY last_active DESC, created_at DESC`,
          [`%${search}%`]
        )
      : await db.query<any>(
          `SELECT id, username, role, avatar_url, last_active, created_at
           FROM users
           ORDER BY last_active DESC, created_at DESC`
        );

    return res.json(members);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load members' });
  }
};
app.get(['/api/members', '/members'], membersHandler);

const userGameStatsHandler = async (req: Request, res: Response) => {
  try {
    const stats = await db.query<any>('SELECT * FROM game_stats WHERE user_id = ?', [req.params.id]);
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load game stats' });
  }
};
app.get(['/api/users/:id/game-stats', '/users/:id/game-stats'], userGameStatsHandler);

const userGameTransactionsHandler = async (req: Request, res: Response) => {
  try {
    const transactions = await db.query<any>(
      'SELECT * FROM game_transactions WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    return res.json(transactions);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load game transactions' });
  }
};
app.get(['/api/users/:id/game-transactions', '/users/:id/game-transactions'], userGameTransactionsHandler);

const userGameMatchesHandler = async (req: Request, res: Response) => {
  try {
    const matches = await db.query<any>('SELECT * FROM game_matches WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
    return res.json(matches);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load game matches' });
  }
};
app.get(['/api/users/:id/game-matches', '/users/:id/game-matches'], userGameMatchesHandler);

const wealthLeaderboardHandler = async (_req: Request, res: Response) => {
  try {
    const leaderboard = await db.query<any>(`
      SELECT u.username, u.avatar_url, SUM(gs.total_wealth) as total_wealth
      FROM users u
      JOIN game_stats gs ON u.id = gs.user_id
      GROUP BY u.id
      ORDER BY total_wealth DESC
      LIMIT 10
    `);
    return res.json(leaderboard);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load wealth leaderboard' });
  }
};
app.get(['/api/leaderboards/wealth', '/leaderboards/wealth'], wealthLeaderboardHandler);

const storeProductsHandler = async (_req: Request, res: Response) => {
  try {
    const products = await db.query<any>('SELECT * FROM products');
    return res.json(products);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load products' });
  }
};
app.get(['/api/store/products', '/store/products'], storeProductsHandler);

const cartListHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [user.id]);
    if (!cart) {
      return res.json({ items: [], total: 0, count: 0 });
    }

    const items = await db.query<any>(
      `
      SELECT ci.product_id as productId, ci.quantity, ci.price, p.name
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
      `,
      [cart.id]
    );
    const total = items.reduce((sum: number, item: any) => sum + Number(item.price) * Number(item.quantity), 0);
    return res.json({ items, total, count: items.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load cart' });
  }
};
app.get(['/api/cart', '/cart'], cartListHandler);

const cartAddHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const { productId, quantity } = req.body || {};
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid product ID or quantity' });
    }

    const product = await db.queryOne<any>('SELECT id, name, price FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [user.id]);
    if (!cart) {
      const cartResult = await db.execute('INSERT INTO carts (user_id) VALUES (?)', [user.id]);
      cart = { id: cartResult.lastInsertRowid || cartResult.insertId };
    }

    const existingItem = await db.queryOne<any>(
      'SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cart.id, productId]
    );

    if (existingItem) {
      await db.execute('UPDATE cart_items SET quantity = quantity + ?, price = ? WHERE id = ?', [quantity, product.price, existingItem.id]);
    } else {
      await db.execute('INSERT INTO cart_items (cart_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [cart.id, productId, quantity, product.price]);
    }

    await db.execute('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cart.id]);
    const cartSize = await db.queryOne<any>('SELECT COUNT(*) as count FROM cart_items WHERE cart_id = ?', [cart.id]);
    return res.json({ success: true, cartSize: Number(cartSize?.count || 0) });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update cart' });
  }
};
app.post(['/api/cart', '/cart'], cartAddHandler);

const cartDeleteHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const productId = Number(req.params.productId);
    if (!productId) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [user.id]);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const item = await db.queryOne<any>('SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, productId]);
    if (!item) {
      return res.status(404).json({ error: 'Item not in cart' });
    }

    await db.execute('DELETE FROM cart_items WHERE id = ?', [item.id]);
    await db.execute('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [cart.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to remove cart item' });
  }
};
app.delete(['/api/cart/:productId', '/cart/:productId'], validateParams(productIdParamSchema), cartDeleteHandler);

const paymentProvidersHandler = (_req: Request, res: Response) => {
  return res.json({ providers: paymentProviders });
};
app.get(['/api/payments/providers', '/payments/providers'], paymentProvidersHandler);

const stripeCreateIntentHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const { amount, currency = 'usd' } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const paymentIntent = await createStripePaymentIntent(Number(amount), String(currency));
    return res.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create Stripe payment intent' });
  }
};
app.post(['/api/payments/stripe/create-intent', '/payments/stripe/create-intent'], stripeCreateIntentHandler);

const stripeConfirmHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const orderId = Number.parseInt(String(req.params.orderId), 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Valid order ID is required' });
    }

    const order = await db.queryOne<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['pending', 'payment_pending'].includes(String(order.status || ''))) {
      return res.status(400).json({ error: 'Order is not in pending status' });
    }

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const pending = await markOrderPaymentPending({
      db,
      orderId,
      userId: user.id,
      provider: 'stripe',
      providerPaymentId: String(paymentIntentId)
    });
    if (!pending.updated) {
      return res.status(400).json({ error: 'Order is not in a payable status' });
    }

    return res.json({ success: true, status: 'payment_pending', message: 'Awaiting Stripe webhook confirmation' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to confirm Stripe payment' });
  }
};
app.post(['/api/payments/stripe/confirm/:orderId', '/payments/stripe/confirm/:orderId'], validateParams(orderIdParamSchema), stripeConfirmHandler);

const paypalCreateOrderHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const { amount, currency = 'USD' } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const order = await createPayPalOrder(Number(amount), String(currency));
    const approvalUrl = order.links.find((link) => link.rel === 'approve')?.href;
    return res.json({ orderId: order.id, status: order.status, approvalUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create PayPal order' });
  }
};
app.post(['/api/payments/paypal/create-order', '/payments/paypal/create-order'], paypalCreateOrderHandler);

const paypalCaptureHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const orderId = Number.parseInt(String(req.params.orderId), 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Valid order ID is required' });
    }

    const order = await db.queryOne<any>('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['pending', 'payment_pending'].includes(String(order.status || ''))) {
      return res.status(400).json({ error: 'Order is not in pending status' });
    }

    const { paypalOrderId } = req.body || {};
    if (!paypalOrderId) {
      return res.status(400).json({ error: 'PayPal order ID is required' });
    }

    const success = await capturePayPalOrder(String(paypalOrderId));
    if (!success) {
      return res.status(400).json({ error: 'Payment capture failed' });
    }

    const pending = await markOrderPaymentPending({
      db,
      orderId,
      userId: user.id,
      provider: 'paypal',
      providerPaymentId: String(paypalOrderId)
    });
    if (!pending.updated) {
      return res.status(400).json({ error: 'Order is not in a payable status' });
    }

    return res.json({ success: true, status: 'payment_pending', message: 'Awaiting PayPal webhook confirmation' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to capture PayPal order' });
  }
};
app.post(['/api/payments/paypal/capture/:orderId', '/payments/paypal/capture/:orderId'], validateParams(orderIdParamSchema), paypalCaptureHandler);

const stripeWebhookHandler = async (req: Request, res: Response) => {
  try {
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body || {});
    const signature = req.header('stripe-signature') || undefined;
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
    return res.status(500).json({ error: err?.message || 'Failed to process Stripe webhook' });
  }
};
app.post(['/api/payments/stripe/webhook', '/payments/stripe/webhook'], stripeWebhookHandler);

const paypalWebhookHandler = async (req: Request, res: Response) => {
  try {
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body || {});
    const valid = verifyPayPalWebhookSignature({
      payload: rawPayload,
      signature: req.header('paypal-transmission-sig') || undefined,
      transmissionId: req.header('paypal-transmission-id') || undefined,
      transmissionTime: req.header('paypal-transmission-time') || undefined,
      webhookId: req.header('paypal-webhook-id') || process.env.PAYPAL_WEBHOOK_ID || undefined
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
    return res.status(500).json({ error: err?.message || 'Failed to process PayPal webhook' });
  }
};
app.post(['/api/payments/paypal/webhook', '/payments/paypal/webhook'], paypalWebhookHandler);

const forumCategoriesHandler = async (_req: Request, res: Response) => {
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

    return res.json(categories.map((cat: any) => ({
      ...cat,
      forums: forums.filter((f: any) => f.category_id === cat.id)
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load forums' });
  }
};
app.get(['/api/forums/categories', '/forums/categories'], forumCategoriesHandler);

const forumDetailHandler = async (req: Request, res: Response) => {
  try {
    const forum = await db.queryOne<any>('SELECT * FROM forums WHERE id = ?', [req.params.id]);
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' });
    }

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

    return res.json({ forum, threads });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load forum' });
  }
};
app.get(['/api/forums/:id', '/forums/:id'], forumDetailHandler);

const threadListHandler = async (req: Request, res: Response) => {
  const { categoryId } = req.query;
  const normalizedCategoryId = typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId.trim() : null;

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
    `, [normalizedCategoryId, normalizedCategoryId]);

    return res.json(threads);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load threads' });
  }
};
app.get(['/api/threads', '/threads'], threadListHandler);

const threadDetailHandler = async (req: Request, res: Response) => {
  try {
    const thread = await db.queryOne<any>(`
      SELECT t.*, u.username as author_name, f.name as forum_name
      FROM threads t
      JOIN users u ON t.author_id = u.id
      JOIN forums f ON t.forum_id = f.id
      WHERE t.id = ?
    `, [req.params.id]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const posts = await db.query<any>(`
      SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.thread_id = ?
      ORDER BY p.created_at ASC
    `, [req.params.id]);

    return res.json({ thread, posts });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load thread' });
  }
};
app.get(['/api/threads/:id', '/threads/:id'], threadDetailHandler);

const threadCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { forum_id, title, content } = req.body as z.infer<typeof threadCreateSchema>;
  try {
    const forum = await db.queryOne<any>('SELECT id, min_role_to_thread FROM forums WHERE id = ?', [forum_id]);
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' });
    }
    if (!meetsMinRole(user.role, forum.min_role_to_thread)) {
      return res.status(403).json({ error: 'You do not have permission to create threads in this forum' });
    }

    const result = await db.execute('INSERT INTO threads (forum_id, author_id, title) VALUES (?, ?, ?)', [forum_id, user.id, sanitizeUserText(title)]);
    const threadId = result.lastInsertRowid || result.insertId;
    await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [threadId, user.id, sanitizeUserText(content)]);
    return res.json({ id: threadId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create thread' });
  }
};
app.post(['/api/threads', '/threads'], validateBody(threadCreateSchema), threadCreateHandler);

const postCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { thread_id, content } = req.body as z.infer<typeof postCreateSchema>;
  try {
    const thread = await db.queryOne<any>(`
      SELECT t.id, f.min_role_to_thread
      FROM threads t
      JOIN forums f ON t.forum_id = f.id
      WHERE t.id = ?
    `, [thread_id]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    if (!meetsMinRole(user.role, thread.min_role_to_thread)) {
      return res.status(403).json({ error: 'You do not have permission to post in this forum' });
    }

    await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [thread_id, user.id, sanitizeUserText(content)]);
    await db.execute('UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [thread_id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create post' });
  }
};
app.post(['/api/posts', '/posts'], validateBody(postCreateSchema), postCreateHandler);

const postUpdateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { content, is_hidden, is_deleted } = req.body || {};
  try {
    const post = await db.queryOne<any>('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isStaff = isStaffRole(user.role);
    const isOwner = post.author_id === user.id;
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if ((is_hidden !== undefined || is_deleted !== undefined) && !isStaff) {
      return res.status(403).json({ error: 'Only moderators can hide/delete posts' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(sanitizeUserText(content));
    }
    if (is_hidden !== undefined) {
      updates.push('is_hidden = ?');
      params.push(is_hidden ? 1 : 0);
    }
    if (is_deleted !== undefined) {
      updates.push('is_deleted = ?');
      params.push(is_deleted ? 1 : 0);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    await db.execute(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update post' });
  }
};
app.patch(['/api/posts/:id', '/posts/:id'], validateParams(idParamSchema), validateBody(postUpdateSchema), postUpdateHandler);

const threadUpdateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { is_pinned, is_locked, is_solved, is_hidden } = req.body || {};
  try {
    const thread = await db.queryOne<any>('SELECT * FROM threads WHERE id = ?', [req.params.id]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const isStaff = isStaffRole(user.role);
    const isOwner = thread.author_id === user.id;
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
    if (is_pinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(is_pinned ? 1 : 0);
    }
    if (is_locked !== undefined) {
      updates.push('is_locked = ?');
      params.push(is_locked ? 1 : 0);
    }
    if (is_solved !== undefined) {
      updates.push('is_solved = ?');
      params.push(is_solved ? 1 : 0);
    }
    if (is_hidden !== undefined) {
      updates.push('is_hidden = ?');
      params.push(is_hidden ? 1 : 0);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    await db.execute(`UPDATE threads SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update thread' });
  }
};
app.patch(['/api/threads/:id', '/threads/:id'], validateParams(idParamSchema), validateBody(threadUpdateSchema), threadUpdateHandler);

const threadDeleteHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  try {
    const thread = await db.queryOne<any>('SELECT * FROM threads WHERE id = ?', [req.params.id]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    const isStaff = isStaffRole(user.role);
    const isOwner = thread.author_id === user.id;
    if (!isStaff && !isOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.execute('DELETE FROM posts WHERE thread_id = ?', [req.params.id]);
    await db.execute('DELETE FROM threads WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete thread' });
  }
};
app.delete(['/api/threads/:id', '/threads/:id'], validateParams(idParamSchema), threadDeleteHandler);

const reportCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { target_type, target_id, reason } = req.body as z.infer<typeof reportCreateSchema>;
  try {
    await db.execute(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
      [user.id, target_type, target_id, reason]
    );
    return res.status(201).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create report' });
  }
};
app.post(['/api/reports', '/reports'], validateBody(reportCreateSchema), reportCreateHandler);

const ordersCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  try {
    const cart = await db.queryOne<any>('SELECT id FROM carts WHERE user_id = ?', [user.id]);
    if (!cart) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
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
    const orderResult = await db.execute(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [user.id, totalPrice, 'pending']
    );
    const orderId = orderResult.lastInsertRowid || orderResult.insertId;
    for (const item of items) {
      await db.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
    }
    await db.execute('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);

    return res.json({ id: orderId, userId: user.id, totalPrice, itemsCount: items.length, status: 'pending' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create order' });
  }
};
app.post(['/api/orders', '/orders'], ordersCreateHandler);

const ticketsListHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  try {
    const tickets = await db.query<any>('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
    return res.json(tickets);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load tickets' });
  }
};
app.get(['/api/tickets', '/tickets'], ticketsListHandler);

const ticketCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { subject, priority, message, ticket_type } = req.body as z.infer<typeof supportTicketCreateSchema>;
  try {
    const result = await db.execute(
      'INSERT INTO tickets (user_id, subject, priority, ticket_type) VALUES (?, ?, ?, ?)',
      [user.id, sanitizeUserText(subject), priority, ticket_type]
    );
    const ticketId = result.lastInsertRowid || result.insertId;
    await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticketId, user.id, sanitizeUserText(message)]);
    return res.status(201).json({ success: true, id: ticketId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create ticket' });
  }
};
app.post(['/api/tickets', '/tickets'], validateBody(supportTicketCreateSchema), ticketCreateHandler);

const ticketDetailHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  try {
    const ticket = await db.queryOne<any>(`
      SELECT t.*, u.username as author_name, u.avatar_url as author_avatar
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ? AND t.user_id = ?
    `, [req.params.id, user.id]);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const messages = await db.query<any>(`
      SELECT tm.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role
      FROM ticket_messages tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC
    `, [req.params.id]);

    return res.json({ ticket, messages });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load ticket' });
  }
};
app.get(['/api/tickets/:id', '/tickets/:id'], validateParams(idParamSchema), ticketDetailHandler);

const ticketMessageCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { message } = req.body as z.infer<typeof ticketMessageSchema>;
  try {
    const ticket = await db.queryOne<any>('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, user.id]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, user.id, sanitizeUserText(message)]);
    await db.execute("UPDATE tickets SET status = 'pending' WHERE id = ?", [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to post ticket message' });
  }
};
app.post(['/api/tickets/:id/messages', '/tickets/:id/messages'], validateParams(idParamSchema), validateBody(ticketMessageSchema), ticketMessageCreateHandler);

const messageConversationsHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

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
    `, [user.id, user.id, user.id, user.id, user.id, user.id]);

    return res.json(conversations);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load conversations' });
  }
};
app.get(['/api/messages/conversations', '/messages/conversations'], messageConversationsHandler);

const messagesByUserHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  try {
    const messages = await db.query<any>(`
      SELECT * FROM messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [user.id, req.params.userId, req.params.userId, user.id]);

    await db.execute('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [req.params.userId, user.id]);
    return res.json(messages);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load messages' });
  }
};
app.get(['/api/messages/:userId', '/messages/:userId'], messagesByUserHandler);

const messageCreateHandler = async (req: Request, res: Response) => {
  const user = await requireAuthUser(req, res);
  if (!user) return;

  const { receiver_id, content } = req.body as z.infer<typeof directMessageSchema>;
  try {
    const result = await db.execute('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [user.id, receiver_id, sanitizeUserText(content)]);
    const messageId = result.lastInsertRowid || result.insertId;
    const message = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!message) {
      return res.status(500).json({ error: 'Failed to retrieve created message' });
    }
    return res.status(201).json(message);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send message' });
  }
};
app.post(['/api/messages', '/messages'], validateBody(directMessageSchema), messageCreateHandler);

const communityStatsHandler = async (_req: Request, res: Response) => {
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

    return res.json({
      users: Number(users?.count || 0),
      threads: Number(threads?.count || 0),
      posts: Number(posts?.count || 0),
      total_servers: Number(servers?.total_servers || 0),
      online_servers: Number(servers?.online_servers || 0),
      active_players: Number(servers?.active_players || 0)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load community stats' });
  }
};
app.get(['/api/community/stats', '/community/stats'], communityStatsHandler);

const discordFeedHandler = async (_req: Request, res: Response) => {
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

    return res.json({ items: normalizedItems });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Discord feed unavailable', items: [] });
  }
};
app.get(['/api/discord/feed', '/discord/feed'], discordFeedHandler);

const settingsHandler = async (req: Request, res: Response) => {
  try {
    const settings = await db.query<any>('SELECT * FROM site_settings');
    const dictionary = settings.reduce((acc: Record<string, unknown>, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const user = getTokenPayload(req);
    if (user?.role === 'admin') {
      return res.json(dictionary);
    }

    const publicSettings: Record<string, unknown> = {};
    for (const key of Object.keys(dictionary)) {
      if (isPublicSetting(key)) publicSettings[key] = dictionary[key];
    }
    return res.json(publicSettings);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load settings' });
  }
};
app.get(['/api/settings', '/settings'], settingsHandler);

const serversHandler = async (_req: Request, res: Response) => {
  try {
    const servers = await db.query<any>(`
      SELECT id, name, ip, region, game, map, players_current, status
      FROM server_nodes
      ORDER BY created_at DESC
    `);
    return res.json(servers.map((server: any) => ({
      ...server,
      players_current: Number(server.players_current) || 0,
      players: Number(server.players_current) || 0,
      status: server.status === 'online' ? 'online' : 'offline'
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load servers' });
  }
};
app.get(['/api/servers', '/servers'], serversHandler);

const mediaAnimateHandler = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    if (!mediaClient) {
      observabilityMetrics.mediaOutages.providerUnavailable += 1;
      return res.status(503).json({
        error: 'Studio media provider is temporarily unavailable.',
        code: 'MEDIA_PROVIDER_UNAVAILABLE',
        retryable: true
      });
    }

    const quotaNow = Date.now();
    const existingQuota = mediaQuotas.get(user.id);
    if (!existingQuota || quotaNow - existingQuota.windowStartedAt >= 60 * 60 * 1000) {
      mediaQuotas.set(user.id, { windowStartedAt: quotaNow, requestCount: 0 });
    }

    const userQuota = mediaQuotas.get(user.id)!;
    if (userQuota.requestCount >= MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR) {
      observabilityMetrics.mediaOutages.quotaRejected += 1;
      return res.status(429).json({
        error: 'Hourly Studio quota reached. Please try again later.',
        code: 'MEDIA_QUOTA_EXCEEDED',
        retryable: true,
        quota: {
          limitPerHour: MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR,
          remaining: 0
        }
      });
    }

    const imageBase64 = String(req.body?.imageBase64 || '');
    const prompt = String(req.body?.prompt || '').trim();
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.', code: 'MEDIA_INVALID_IMAGE' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required for animation.', code: 'MEDIA_INVALID_PROMPT' });
    }

    const imageMatch = dataUriRegex.exec(imageBase64);
    const mimeType = imageMatch?.groups?.mime || '';
    const inlineData = imageMatch?.groups?.data || '';
    if (!mimeType || !inlineData || !/^image\/(png|jpeg|jpg|webp)$/i.test(mimeType)) {
      return res.status(400).json({
        error: 'imageBase64 must be a valid data URI (PNG/JPEG/WEBP).',
        code: 'MEDIA_INVALID_IMAGE'
      });
    }

    const providerOperation = await mediaClient.models.generateVideos({
      model: MEDIA_MODEL,
      source: {
        prompt,
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

    userQuota.requestCount += 1;
    const operationName = providerOperation.name || `op_${Date.now()}_${user.id}`;
    mediaOperations.set(operationName, {
      ownerId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + MEDIA_OPERATION_TTL_MS,
      status: providerOperation.done ? 'done' : 'in_progress',
      providerOperation,
      uri: providerOperation.response?.generatedVideos?.[0]?.video?.uri,
      pollCount: 0
    });

    return res.json({
      operationName,
      quota: {
        limitPerHour: MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR,
        remaining: Math.max(0, MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR - userQuota.requestCount)
      }
    });
  } catch (err: any) {
    observabilityMetrics.mediaOutages.providerFailures += 1;
    return res.status(502).json({
      error: `Media provider failed to start generation: ${err?.message || 'Unknown provider error'}`,
      code: 'MEDIA_PROVIDER_FAILURE',
      retryable: true
    });
  } finally {
    recordLatency(observabilityMetrics.media['/api/media/animate'], Date.now() - startedAt);
  }
};
app.post(['/api/media/animate', '/media/animate'], mediaAnimateHandler);

const mediaPollHandler = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    pruneExpiredMediaOperations();

    const operationName = String(req.query.operationName || '');
    if (!operationName) {
      return res.status(400).json({ error: 'operationName query parameter is required.', code: 'MEDIA_OPERATION_REQUIRED' });
    }

    const operation = mediaOperations.get(operationName);
    if (!operation) {
      return res.status(410).json({ error: 'Operation not found or expired.', code: 'MEDIA_OPERATION_EXPIRED' });
    }
    if (operation.ownerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden.', code: 'MEDIA_OPERATION_FORBIDDEN' });
    }

    if (operation.lastPolledAt && Date.now() - operation.lastPolledAt < MEDIA_MIN_POLL_INTERVAL_MS) {
      observabilityMetrics.mediaOutages.pollRateLimited += 1;
      return res.status(429).json({
        error: `Polling too frequently. Wait at least ${MEDIA_MIN_POLL_INTERVAL_MS / 1000}s between polls.`,
        code: 'MEDIA_POLL_RATE_LIMITED',
        retryable: true
      });
    }

    operation.lastPolledAt = Date.now();
    operation.pollCount += 1;
    if (operation.pollCount > MEDIA_MAX_POLLS_PER_OPERATION) {
      operation.status = 'error';
      operation.error = 'Media operation exceeded maximum polls and was terminated.';
      observabilityMetrics.mediaOutages.pollRateLimited += 1;
      return res.status(429).json({ done: true, error: operation.error, code: 'MEDIA_POLL_BUDGET_EXCEEDED' });
    }

    if (operation.status === 'error') {
      return res.json({ done: true, error: operation.error || 'Generation failed.', code: 'MEDIA_OPERATION_FAILED' });
    }

    if (operation.status === 'done') {
      if (!operation.uri) {
        return res.json({ done: true, error: 'Generation completed without a video URI.', code: 'MEDIA_OPERATION_NO_URI' });
      }
      return res.json({ done: true, uri: operation.uri });
    }

    if (!mediaClient) {
      operation.status = 'error';
      operation.error = 'Studio media provider is temporarily unavailable.';
      observabilityMetrics.mediaOutages.providerUnavailable += 1;
      return res.status(503).json({ done: true, error: operation.error, code: 'MEDIA_PROVIDER_UNAVAILABLE' });
    }

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
      observabilityMetrics.mediaOutages.providerFailures += 1;
      return res.status(502).json({ done: true, error: providerError, code: 'MEDIA_PROVIDER_FAILURE' });
    }

    const uri = latestOperation.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      operation.status = 'error';
      operation.error = 'Provider returned no video URI.';
      return res.status(502).json({ done: true, error: operation.error, code: 'MEDIA_PROVIDER_EMPTY_RESPONSE' });
    }

    operation.status = 'done';
    operation.uri = uri;
    return res.json({ done: true, uri });
  } catch (err: any) {
    observabilityMetrics.mediaOutages.providerFailures += 1;
    return res.status(502).json({
      done: true,
      error: err?.message || 'Failed to poll media provider.',
      code: 'MEDIA_PROVIDER_FAILURE'
    });
  } finally {
    recordLatency(observabilityMetrics.media['/api/media/poll'], Date.now() - startedAt);
  }
};
app.get(['/api/media/poll', '/media/poll'], mediaPollHandler);

const observabilityMetricsHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({
      media: {
        '/api/media/animate': summarizeLatency(observabilityMetrics.media['/api/media/animate']),
        '/api/media/poll': summarizeLatency(observabilityMetrics.media['/api/media/poll'])
      },
      mediaOutages: observabilityMetrics.mediaOutages,
      mediaGuardrails: {
        maxAnimationsPerUserPerHour: MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR,
        minPollIntervalMs: MEDIA_MIN_POLL_INTERVAL_MS,
        maxPollsPerOperation: MEDIA_MAX_POLLS_PER_OPERATION,
        operationTtlMs: MEDIA_OPERATION_TTL_MS
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load observability metrics.' });
  }
};
app.get(['/api/admin/observability/metrics', '/admin/observability/metrics'], observabilityMetricsHandler);

const adminMetricsHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  try {
    const [users, threads, posts, reports] = await Promise.all([
      db.queryOne<any>('SELECT COUNT(*) as count FROM users'),
      db.queryOne<any>('SELECT COUNT(*) as count FROM threads'),
      db.queryOne<any>('SELECT COUNT(*) as count FROM posts'),
      db.queryOne<any>("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'")
    ]);
    return res.json({
      totalUsers: Number(users?.count || 0),
      totalThreads: Number(threads?.count || 0),
      totalPosts: Number(posts?.count || 0),
      pendingReports: Number(reports?.count || 0)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load admin metrics' });
  }
};
app.get(['/api/admin/metrics', '/admin/metrics'], adminMetricsHandler);

const adminUsersListHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const users = await db.query<any>('SELECT id, username, email, role, created_at, last_active FROM users ORDER BY created_at DESC');
    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load admin users' });
  }
};
app.get(['/api/admin/users', '/admin/users'], adminUsersListHandler);

const adminUserRolePatchHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const role = String((req.body as any)?.role || '').trim();
  if (!['admin', 'moderator', 'member', 'suspended'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update role' });
  }
};
app.patch(['/api/admin/users/:id/role', '/admin/users/:id/role'], validateParams(idParamSchema), validateBody(adminRoleUpdateSchema), adminUserRolePatchHandler);

const adminReportsHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  try {
    const reports = await db.query<any>(`
      SELECT r.*, u.username as reporter_name
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      ORDER BY r.created_at DESC
    `);
    return res.json(reports);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load reports' });
  }
};
app.get(['/api/admin/reports', '/admin/reports'], adminReportsHandler);

const adminReportActionHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  const { action, reason } = req.body as { action?: string; reason?: string };
  try {
    const report = await db.queryOne<any>('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

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
      [user.id, action || 'dismiss', report.target_type, report.target_id, reason || null]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to apply report action' });
  }
};
app.post(['/api/admin/reports/:id/action', '/admin/reports/:id/action'], validateParams(idParamSchema), validateBody(adminReportActionSchema), adminReportActionHandler);

const adminAuditLogHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  try {
    const logs = await db.query<any>(`
      SELECT m.*, u.username as moderator_name
      FROM moderation_actions m
      JOIN users u ON m.moderator_id = u.id
      ORDER BY m.created_at DESC
    `);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load moderation audit log' });
  }
};
app.get(['/api/admin/audit-log', '/admin/audit-log'], adminAuditLogHandler);

const adminSettingsGetHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const settings = await db.query<any>('SELECT * FROM site_settings');
    return res.json(settings);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load admin settings' });
  }
};
app.get(['/api/admin/settings', '/admin/settings'], adminSettingsGetHandler);

const adminSettingsUpdateHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const settings = Array.isArray(req.body) ? req.body : (req.body as any)?.settings;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ error: 'settings array is required' });
  }
  try {
    for (const setting of settings) {
      await db.execute(
        'UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [typeof setting.value === 'string' ? setting.value.trim() : JSON.stringify(setting.value), setting.key]
      );
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update settings' });
  }
};
app.post(['/api/admin/settings', '/admin/settings'], adminSettingsUpdateHandler);

const adminAnalyticsHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const [users, posts, threads, revenue] = await Promise.all([
      db.queryOne<any>('SELECT COUNT(*) as count FROM users'),
      db.queryOne<any>('SELECT COUNT(*) as count FROM posts'),
      db.queryOne<any>('SELECT COUNT(*) as count FROM threads'),
      db.queryOne<any>('SELECT COALESCE(SUM(total_amount), 0) as value FROM orders')
    ]);

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

    return res.json({
      stats: { users: Number(users?.count || 0), posts: Number(posts?.count || 0), threads: Number(threads?.count || 0), revenue: Number(revenue?.value || 0) },
      registrations,
      orders
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load analytics' });
  }
};
app.get(['/api/admin/analytics', '/admin/analytics'], adminAnalyticsHandler);

const adminTagsListHandler = async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    const tags = await db.query<any>('SELECT * FROM tags ORDER BY created_at DESC');
    return res.json(tags);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load tags' });
  }
};
app.get(['/api/admin/tags', '/admin/tags'], adminTagsListHandler);

app.post(['/api/admin/tags', '/admin/tags'], async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { name, color } = req.body as { name?: string; color?: string };
  try {
    await db.execute('INSERT INTO tags (name, color) VALUES (?, ?)', [name || '', color || '#00f3ff']);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create tag' });
  }
});

app.patch(['/api/admin/tags/:id', '/admin/tags/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { name, color } = req.body as { name?: string; color?: string };
  try {
    await db.execute('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name || '', color || '#00f3ff', req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update tag' });
  }
});

app.delete(['/api/admin/tags/:id', '/admin/tags/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    await db.execute('DELETE FROM tags WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete tag' });
  }
});

app.post(['/api/admin/categories', '/admin/categories'], async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const name = String((req.body as any)?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  try {
    await db.execute('INSERT INTO forum_categories (name) VALUES (?)', [name]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create category' });
  }
});

app.patch(['/api/admin/categories/:id', '/admin/categories/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const name = String((req.body as any)?.name || '').trim();
  const displayOrder = Number((req.body as any)?.display_order || 0);
  try {
    await db.execute('UPDATE forum_categories SET name = ?, display_order = ? WHERE id = ?', [name, displayOrder, req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update category' });
  }
});

app.delete(['/api/admin/categories/:id', '/admin/categories/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    await db.execute('DELETE FROM forum_categories WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete category' });
  }
});

app.post(['/api/admin/forums', '/admin/forums'], async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { category_id, name, description, min_role_to_thread, display_order } = req.body as any;
  try {
    await db.execute(
      'INSERT INTO forums (category_id, name, description, min_role_to_thread, display_order) VALUES (?, ?, ?, ?, ?)',
      [category_id, name, description || '', min_role_to_thread || 'member', display_order || 0]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create forum' });
  }
});

app.patch(['/api/admin/forums/:id', '/admin/forums/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { category_id, name, description, min_role_to_thread, display_order } = req.body as any;
  try {
    await db.execute(
      'UPDATE forums SET category_id = ?, name = ?, description = ?, min_role_to_thread = ?, display_order = ? WHERE id = ?',
      [category_id, name, description || '', min_role_to_thread || 'member', display_order || 0, req.params.id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update forum' });
  }
});

app.delete(['/api/admin/forums/:id', '/admin/forums/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    await db.execute('DELETE FROM forums WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete forum' });
  }
});

app.post(['/api/admin/products', '/admin/products'], async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { name, description, price, image_url, category, stock } = req.body as any;
  try {
    await db.execute(
      'INSERT INTO products (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, image_url || '', category || 'Digital', stock ?? -1]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to create product' });
  }
});

app.patch(['/api/admin/products/:id', '/admin/products/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  const { name, description, price, image_url, category, stock } = req.body as any;
  try {
    await db.execute(
      'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ? WHERE id = ?',
      [name, description || '', price, image_url || '', category || 'Digital', stock ?? -1, req.params.id]
    );
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update product' });
  }
});

app.delete(['/api/admin/products/:id', '/admin/products/:id'], validateParams(idParamSchema), async (req: Request, res: Response) => {
  const user = await requireAdminUser(req, res);
  if (!user) return;
  try {
    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to delete product' });
  }
});

const adminTicketsListHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
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
    return res.json(tickets);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load admin tickets' });
  }
};
app.get(['/api/admin/tickets', '/admin/tickets'], adminTicketsListHandler);

const adminTicketDetailHandler = async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
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
    return res.json({ ticket, messages });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load ticket detail' });
  }
};
app.get(['/api/admin/tickets/:id', '/admin/tickets/:id'], adminTicketDetailHandler);

app.post(['/api/admin/tickets/:id/messages', '/admin/tickets/:id/messages'], validateParams(idParamSchema), validateBody(ticketMessageSchema), async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  const { message } = req.body as z.infer<typeof ticketMessageSchema>;
  try {
    await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, user.id, sanitizeUserText(message)]);
    await db.execute("UPDATE tickets SET status = 'pending' WHERE id = ?", [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to post ticket message' });
  }
});

app.patch(['/api/admin/tickets/:id', '/admin/tickets/:id'], validateParams(idParamSchema), validateBody(adminTicketStatusSchema), async (req: Request, res: Response) => {
  const user = await requireStaffUser(req, res);
  if (!user) return;
  const status = String((req.body as any)?.status || '').trim();
  if (!['open', 'pending', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    await db.execute('UPDATE tickets SET status = ? WHERE id = ?', [status, req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update ticket' });
  }
});

const notificationsHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;
    const notifications = await db.query<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );
    return res.json(notifications);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load notifications' });
  }
};
app.get(['/api/notifications', '/notifications'], notificationsHandler);

const notificationReadHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;
    await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, user.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update notification' });
  }
};
app.patch(['/api/notifications/:id/read', '/notifications/:id/read'], validateParams(idParamSchema), notificationReadHandler);

const notificationsReadAllHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;
    await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [user.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to update notifications' });
  }
};
app.post(['/api/notifications/read-all', '/notifications/read-all'], notificationsReadAllHandler);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

export default app;
