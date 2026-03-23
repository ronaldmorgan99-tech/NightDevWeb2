import express from 'express';
import type { CookieOptions } from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './src/lib/db';
import { seedDb } from './src/lib/seed';
import { GoogleGenAI, type GenerateVideosOperation } from '@google/genai';
import { z } from 'zod';


const JWT_SECRET = process.env.JWT_SECRET || 'cyber-secret-key';
const AUTH_COOKIE_NAME = 'token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/'
};

async function start() {
  console.log('--- STARTING NIGHTRESPAWN SERVER ---');
  
  // Startup order is deterministic: create/validate schema first, then seed/reset data.
  try {
    console.log('Initializing database schema...');
    await initDb();
    console.log('Database schema is ready. Running seed/reset checks...');
    await seedDb();
    console.log('Database startup tasks completed.');
  } catch (err) {
    console.error('Database startup failed:', err);
  }

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // --- SOCKET.IO AUTH ---
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie;
    if (!cookie) return next(new Error('Authentication error'));
    
    const token = cookie.split('; ').find(row => row.startsWith(`${AUTH_COOKIE_NAME}=`))?.split('=')[1];
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  const userSockets = new Map<number, string>();

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

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    userSockets.set(userId, socket.id);
    console.log(`User ${userId} connected via socket`);

    socket.on('disconnect', () => {
      userSockets.delete(userId);
      console.log(`User ${userId} disconnected from socket`);
    });
  });

  // --- AUTH MIDDLEWARE ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  };

  const isStaffRole = (role?: string) => role === 'admin' || role === 'moderator';

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

  // Auth
  app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

      const user = await db.queryOne<any>(
        'SELECT id, username, email, role FROM users WHERE username = ?',
        [username]
      );

      if (!user) {
        return res.status(500).json({ error: 'Failed to load registered user' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
      res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await db.queryOne<any>('SELECT * FROM users WHERE username = ?', [username]);
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
      res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', authenticate, async (req: any, res) => {
    try {
      const user = await db.queryOne<any>('SELECT id, username, email, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?', [req.user.id]);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/auth/me', authenticate, async (req: any, res) => {
    const { avatar_url, banner_url, bio } = req.body;
    try {
      const updates: string[] = [];
      const params: any[] = [];
      
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
        params.push(bio);
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
  app.get('/api/users/:id', async (req, res) => {
    try {
      const user = await db.queryOne<any>('SELECT id, username, role, avatar_url, banner_url, bio, created_at, last_active FROM users WHERE id = ?', [req.params.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-stats', async (req, res) => {
    try {
      const stats = await db.query<any>('SELECT * FROM game_stats WHERE user_id = ?', [req.params.id]);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-transactions', async (req, res) => {
    try {
      const transactions = await db.query<any>('SELECT * FROM game_transactions WHERE user_id = ? ORDER BY created_at DESC', [req.params.id]);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/users/:id/game-matches', async (req, res) => {
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
      const forums = await db.query<any>('SELECT * FROM forums ORDER BY display_order ASC');
      
      const result = categories.map(cat => ({
        ...cat,
        forums: forums.filter(f => f.category_id === cat.id)
      }));
      
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await db.query<any>('SELECT * FROM site_settings');
      const result = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});
      res.json(result);
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
        'INSERT INTO server_nodes (name, ip, region, game, map, players_current, status) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [payload.name, payload.ip, payload.region, payload.game, payload.map, 'offline']
      );
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/servers/:id/status', authenticate, isAdmin, async (req, res) => {
    const { id } = req.params;
    const status = req.body?.status === 'online' ? 'online' : 'offline';
    const playersCurrent = Number.isFinite(Number(req.body?.players_current ?? req.body?.players)) ? Math.max(0, Number(req.body.players_current ?? req.body.players)) : 0;

    try {
      await db.execute(
        'UPDATE server_nodes SET status = ?, players_current = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, playersCurrent, id]
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
  app.get('/api/forums/:id', async (req, res) => {
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

  app.post('/api/threads', authenticate, async (req: any, res) => {
    const { forum_id, title, content } = req.body;
    try {
      const result = await db.execute('INSERT INTO threads (forum_id, author_id, title) VALUES (?, ?, ?)', [forum_id, req.user.id, title]);
      const threadId = result.lastInsertRowid || result.insertId;
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [threadId, req.user.id, content]);
      res.json({ id: threadId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/threads/:id', async (req, res) => {
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

  app.get('/api/threads', async (req, res) => {
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

  app.post('/api/posts', authenticate, async (req: any, res) => {
    const { thread_id, content } = req.body;
    try {
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [thread_id, req.user.id, content]);
      await db.execute('UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [thread_id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/posts/:id', authenticate, async (req: any, res) => {
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
        params.push(content);
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

  app.patch('/api/threads/:id', authenticate, async (req: any, res) => {
    const { is_pinned, is_locked, is_solved, is_hidden } = req.body;
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
      if (!isStaff && !isOwner) {
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

  app.delete('/api/threads/:id', authenticate, async (req: any, res) => {
    try {
      const thread = await db.queryOne<any>('SELECT * FROM threads WHERE id = ?', [req.params.id]);
      if (!thread) return res.status(404).json({ error: 'Thread not found' });
      const canDelete = thread.author_id === req.user.id || ['admin', 'moderator'].includes(req.user.role);
      if (!canDelete) return res.status(403).json({ error: 'Forbidden' });
      await db.execute('DELETE FROM threads WHERE id = ?', [req.params.id]);

      const isStaff = isStaffRole(req.user.role);
      const isOwner = thread.author_id === req.user.id;
      if (!isStaff && !isOwner) {
        return res.status(403).json({ error: 'Forbidden' });
      }

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

  app.post('/api/reports', authenticate, async (req: any, res) => {
    const { target_type, target_id, reason } = req.body;
    try {
      if (!target_type || !target_id || !reason) {
        return res.status(400).json({ error: 'target_type, target_id, and reason are required' });
      }

      if (!['post', 'thread', 'user'].includes(target_type)) {
        return res.status(400).json({ error: 'Invalid target_type' });
      }

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
  app.get('/api/members', async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

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

  // Support
  app.get('/api/tickets', authenticate, async (req: any, res) => {
    try {
      const tickets = await db.query<any>('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tickets', authenticate, async (req: any, res) => {
    const { subject, priority, message, ticket_type } = req.body;
    try {
      const result = await db.execute('INSERT INTO tickets (user_id, subject, priority, ticket_type) VALUES (?, ?, ?, ?)', [req.user.id, subject, priority, ticket_type || 'user']);
      const ticketId = result.lastInsertRowid || result.insertId;
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticketId, req.user.id, message]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tickets/:id', authenticate, async (req: any, res) => {
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

  app.post('/api/tickets/:id/messages', authenticate, async (req: any, res) => {
    const { message } = req.body;
    try {
      const ticket = await db.queryOne<any>('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, req.user.id, message]);
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

  app.patch('/api/admin/users/:id/role', authenticate, isAdmin, async (req, res) => {
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

  app.post('/api/admin/reports/:id/action', authenticate, isAdmin, async (req: any, res) => {
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

  app.post('/api/admin/settings', authenticate, isAdmin, async (req, res) => {
    const settings = Array.isArray(req.body) ? req.body : req.body?.settings || [];
    try {
      for (const setting of settings) {
        await db.execute('UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [setting.value, setting.key]);
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

  app.patch('/api/admin/tags/:id', authenticate, isAdmin, async (req, res) => {
    const { name, color } = req.body;
    try {
      await db.execute('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/tags/:id', authenticate, isAdmin, async (req, res) => {
    try {
      await db.execute('DELETE FROM tags WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/categories', authenticate, isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      await db.execute('INSERT INTO forum_categories (name) VALUES (?)', [name]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/categories/:id', authenticate, isAdmin, async (req, res) => {
    const { name, display_order } = req.body;
    try {
      await db.execute('UPDATE forum_categories SET name = ?, display_order = ? WHERE id = ?', [name, display_order || 0, req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/categories/:id', authenticate, isAdmin, async (req, res) => {
    try {
      await db.execute('DELETE FROM forum_categories WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/forums', authenticate, isAdmin, async (req, res) => {
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

  app.patch('/api/admin/forums/:id', authenticate, isAdmin, async (req, res) => {
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

  app.delete('/api/admin/forums/:id', authenticate, isAdmin, async (req, res) => {
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

  app.patch('/api/admin/products/:id', authenticate, isAdmin, async (req, res) => {
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

  app.delete('/api/admin/products/:id', authenticate, isAdmin, async (req, res) => {
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

  app.get('/api/admin/tickets/:id', authenticate, isAdmin, async (req, res) => {
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

  app.post('/api/admin/tickets/:id/messages', authenticate, isAdmin, async (req: any, res) => {
    const { message } = req.body;
    try {
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, req.user.id, message]);
      await db.execute("UPDATE tickets SET status = 'pending' WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/tickets/:id', authenticate, isAdmin, async (req, res) => {
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

  app.get('/api/messages/:userId', authenticate, async (req: any, res) => {
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

  app.post('/api/messages', authenticate, async (req: any, res) => {
    const { receiver_id, content } = req.body;
    try {
      const result = await db.execute('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [req.user.id, receiver_id, content]);
      const messageId = result.lastInsertRowid || result.insertId;
      const message = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [messageId]);
      
      if (!message) {
        throw new Error('Failed to retrieve created message');
      }
      
      // Emit via socket
      const receiverSocketId = userSockets.get(Number(receiver_id));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new_message', message);
      }

      // Create notification
      const sender = await db.queryOne<any>('SELECT username FROM users WHERE id = ?', [req.user.id]);
      await db.execute('INSERT INTO notifications (user_id, type, title, content, link) VALUES (?, ?, ?, ?, ?)', 
        [receiver_id, 'message', `New message from ${sender.username}`, content.substring(0, 50), `/messages?user=${req.user.id}`]);
      
      if (receiverSocketId) {
        const notification = await db.queryOne<any>('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1');
        io.to(receiverSocketId).emit('new_notification', notification);
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

  app.patch('/api/notifications/:id/read', authenticate, async (req: any, res) => {
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
      const providerMessage = err?.message || 'Unknown media provider error';
      res.status(502).json({ error: `Media provider failed to start generation: ${providerMessage}` });
    }
  });

  app.get('/api/media/poll', authenticate, async (req: any, res) => {
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
      operation.status = 'error';
      operation.error = err?.message || 'Failed to poll media provider.';
      return res.status(502).json({ done: true, error: operation.error });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Fatal server error:', err);
});
