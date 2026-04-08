import express from 'express';
import type { CookieOptions, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { initDb } from '../src/lib/db.js';
import { seedDb } from '../src/lib/seed.js';
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

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/'
};

let bootPromise: Promise<void> | null = null;

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
