import express from 'express';
import type { CookieOptions, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, type GenerateVideosOperation } from '@google/genai';
import db, { initDb } from '../src/lib/db.js';
import { seedDb } from '../src/lib/seed.js';
import {
  capturePayPalOrder,
  confirmStripePayment,
  createPayPalOrder,
  createStripePaymentIntent,
  paymentProviders
} from '../src/lib/payments.js';
import { isPublicSetting } from '../src/lib/settingsAllowlist.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

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
const MEDIA_OPERATION_TTL_MS = 30 * 60 * 1000;
const MEDIA_MODEL = 'veo-2.0-generate-001';
const MEDIA_MAX_ANIMATIONS_PER_USER_PER_HOUR = 5;
const MEDIA_MIN_POLL_INTERVAL_MS = 5_000;
const MEDIA_MAX_POLLS_PER_OPERATION = 120;
const dataUriRegex = /^data:(?<mime>[^;]+);base64,(?<data>.+)$/;

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/'
};

let bootPromise: Promise<void> | null = null;
const mediaClient = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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

app.use(async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Database initialization failed.' });
  }
});

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
    return res.status(500).json({ error: err?.message || 'Login failed' });
  }
};
app.post(['/api/auth/login', '/auth/login'], loginHandler);

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
app.delete(['/api/cart/:productId', '/cart/:productId'], cartDeleteHandler);

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

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const success = await confirmStripePayment(String(paymentIntentId));
    return res.json({ success, status: success ? 'succeeded' : 'failed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to confirm Stripe payment' });
  }
};
app.post(['/api/payments/stripe/confirm/:orderId', '/payments/stripe/confirm/:orderId'], stripeConfirmHandler);

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

    const { paypalOrderId } = req.body || {};
    if (!paypalOrderId) {
      return res.status(400).json({ error: 'PayPal order ID is required' });
    }

    const success = await capturePayPalOrder(String(paypalOrderId));
    return res.json({ success, status: success ? 'completed' : 'failed' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to capture PayPal order' });
  }
};
app.post(['/api/payments/paypal/capture/:orderId', '/payments/paypal/capture/:orderId'], paypalCaptureHandler);

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
app.patch(['/api/notifications/:id/read', '/notifications/:id/read'], notificationReadHandler);

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
