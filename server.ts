import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './src/lib/db';
import { seedDb } from './src/lib/seed';

const JWT_SECRET = process.env.JWT_SECRET || 'cyber-secret-key';

async function start() {
  console.log('--- STARTING NIGHTRESPAWN SERVER ---');
  
  // Initialize Database
  try {
    await initDb();
    await seedDb();
    console.log('Database initialized and seeded.');
  } catch (err) {
    console.error('Database initialization failed:', err);
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
    
    const token = cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
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
    const token = req.cookies.token;
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

      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
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
      res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
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
    res.clearCookie('token');
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
        SELECT t.*, u.username as author_name 
        FROM threads t 
        JOIN users u ON t.author_id = u.id 
        WHERE t.forum_id = ? 
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
      res.json({ threadId });
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

  // Members
  app.get('/api/members', async (req, res) => {
    try {
      const members = await db.query<any>('SELECT id, username, role, avatar_url, created_at FROM users ORDER BY created_at DESC');
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
    const { subject, priority, message } = req.body;
    try {
      const result = await db.execute('INSERT INTO tickets (user_id, subject, priority) VALUES (?, ?, ?)', [req.user.id, subject, priority]);
      const ticketId = result.lastInsertRowid || result.insertId;
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticketId, req.user.id, message]);
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
    const settings = req.body; // Array of { key, value }
    try {
      for (const setting of settings) {
        await db.execute('UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [setting.value, setting.key]);
      }
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
    // In production, you would serve from dist
    app.use(express.static('dist'));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch(err => {
  console.error('Fatal server error:', err);
});
