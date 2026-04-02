import express from 'express';
import type { CookieOptions, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { initDb } from '../src/lib/db';
import { isPublicSetting } from '../src/lib/settingsAllowlist';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

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
async function ensureDb() {
  if (!bootPromise) {
    bootPromise = initDb().catch((err) => {
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

app.use('/api', async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Database initialization failed.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
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
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const payload = getTokenPayload(req);
  if (!payload?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const user = await db.queryOne<any>(
      'SELECT id, username, email, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({ user, csrfToken: null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load user' });
  }
});

app.get('/api/forums/categories', async (_req: Request, res: Response) => {
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
});

app.get('/api/community/stats', async (_req: Request, res: Response) => {
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
});

app.get('/api/settings', async (req: Request, res: Response) => {
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
});

app.get('/api/servers', async (_req: Request, res: Response) => {
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
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

export default app;
