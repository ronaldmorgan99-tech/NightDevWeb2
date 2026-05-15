import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { createClient, type Client as LibsqlClient } from '@libsql/client';
import path from 'path';

// Database Interface to abstract differences
export interface IDatabase {
  execute(sql: string, params?: any[]): Promise<any>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  pragma?(sql: string): void;
}

class SQLiteWrapper implements IDatabase {
  private db: any;
  constructor() {
    const dbPath = resolveSqlitePath();
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
  }
  async execute(sql: string, params: any[] = []) {
    return this.db.prepare(sql).run(...params);
  }
  async query<T>(sql: string, params: any[] = []) {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async queryOne<T>(sql: string, params: any[] = []) {
    return this.db.prepare(sql).get(...params) as T;
  }
  pragma(sql: string) {
    this.db.pragma(sql);
  }
}

class MySQLWrapper implements IDatabase {
  private pool: mysql.Pool;
  constructor(url: string) {
    this.pool = mysql.createPool(url);
  }
  async execute(sql: string, params: any[] = []) {
    const [result] = await this.pool.query(sql, params);
    return result;
  }
  async query<T>(sql: string, params: any[] = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }
  async queryOne<T>(sql: string, params: any[] = []) {
    const [rows]: any = await this.pool.query(sql, params);
    return rows[0] || null;
  }
}


class TursoWrapper implements IDatabase {
  private client: LibsqlClient;

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken });
  }

  async execute(sql: string, params: any[] = []) {
    return this.client.execute({ sql, args: params });
  }

  async query<T>(sql: string, params: any[] = []) {
    const result = await this.client.execute({ sql, args: params });
    return result.rows as unknown as T[];
  }

  async queryOne<T>(sql: string, params: any[] = []) {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }
}

// Initialize the correct database
let db: IDatabase;

function resolveSqlitePath() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Vercel serverless filesystem is read-only except /tmp.
  if (process.env.VERCEL === '1') {
    return path.join('/tmp', 'nightrespawn.db');
  }

  return 'nightrespawn.db';
}

const databaseUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const isTurso = Boolean(databaseUrl && databaseUrl.startsWith('libsql://'));
const isMySQL = Boolean(databaseUrl && databaseUrl.startsWith('mysql'));

if (isTurso && databaseUrl) {
  console.log('Connecting to Turso (LibSQL) Database...');
  db = new TursoWrapper(databaseUrl, process.env.TURSO_AUTH_TOKEN);
} else if (isMySQL && databaseUrl) {
  console.log('Connecting to MySQL Database...');
  db = new MySQLWrapper(databaseUrl);
} else {
  const dbPath = resolveSqlitePath();
  console.log(`Using Local SQLite Database at ${dbPath}...`);
  db = new SQLiteWrapper();
}

export async function initDb() {
  const run = async (sql: string) => {
    let finalSql = sql;
    if (db instanceof MySQLWrapper) {
      // Basic translation for MySQL
      finalSql = finalSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY');
      finalSql = finalSql.replace(/REAL/g, 'DECIMAL(10,2)');
      finalSql = finalSql.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      finalSql = finalSql.replace(/TEXT UNIQUE/g, 'VARCHAR(255) UNIQUE');
      finalSql = finalSql.replace(/TEXT PRIMARY KEY/g, 'VARCHAR(255) PRIMARY KEY');
      finalSql = finalSql.replace(/TEXT DEFAULT/g, 'VARCHAR(255) DEFAULT');
      finalSql = finalSql.replace(/TEXT NOT NULL/g, 'VARCHAR(255) NOT NULL');
      finalSql = finalSql.replace(/TEXT,/g, 'VARCHAR(255),');
      // Special case for bio which should stay TEXT but MySQL TEXT can't have defaults (bio doesn't have one)
    }

    if (db instanceof SQLiteWrapper) {
      (db as any).db.exec(finalSql);
    } else {
      await db.execute(finalSql);
    }
  };

  // Users
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      avatar_url TEXT,
      banner_url TEXT,
      bio TEXT,
      steam_url TEXT,
      x_url TEXT,
      facebook_url TEXT,
      github_url TEXT,
      youtube_url TEXT,
      kick_url TEXT,
      twitch_url TEXT,
      discord_url TEXT,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration-safe schema updates for users social links
  const socialColumns = ['steam_url', 'x_url', 'facebook_url', 'github_url', 'youtube_url', 'kick_url', 'twitch_url', 'discord_url'];
  if (!(db instanceof MySQLWrapper)) {
    const userColumns = await db.query<any>('PRAGMA table_info(users)');
    for (const column of socialColumns) {
      const hasColumn = userColumns.some((item) => item.name === column);
      if (!hasColumn) {
        await db.execute(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
      }
    }
  } else {
    for (const column of socialColumns) {
      const existingColumn = await db.queryOne<any>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?
      `, [column]);
      if (!existingColumn) {
        await db.execute(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
      }
    }
  }

  // Forum Categories
  await run(`
    CREATE TABLE IF NOT EXISTS forum_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Forums
  await run(`
    CREATE TABLE IF NOT EXISTS forums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      min_role_to_thread TEXT DEFAULT 'member',
      is_hidden INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE
    )
  `);

  // Migration-safe schema updates for forums
  if (!(db instanceof MySQLWrapper)) {
    const forumColumns = await db.query<any>('PRAGMA table_info(forums)');
    const hasIsHidden = forumColumns.some((column) => column.name === 'is_hidden');
    if (!hasIsHidden) {
      await db.execute('ALTER TABLE forums ADD COLUMN is_hidden INTEGER DEFAULT 0');
    }
  } else {
    const isHiddenColumn = await db.queryOne<any>(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'forums'
        AND COLUMN_NAME = 'is_hidden'
    `);
    if (!isHiddenColumn) {
      await db.execute('ALTER TABLE forums ADD COLUMN is_hidden INT DEFAULT 0');
    }
  }

  // Threads
  await run(`
    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      forum_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_solved INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Posts
  await run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_hidden INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tags
  await run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Thread Tags
  await run(`
    CREATE TABLE IF NOT EXISTS thread_tags (
      thread_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (thread_id, tag_id),
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Reports
  await run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Store Products
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      category TEXT,
      stock INTEGER DEFAULT -1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      stripe_payment_intent_id TEXT,
      paypal_order_id TEXT,
      stripe_last_event_id TEXT,
      stripe_last_event_created_at DATETIME,
      stripe_last_event_processed_at DATETIME,
      paypal_last_event_id TEXT,
      paypal_last_event_created_at DATETIME,
      paypal_last_event_processed_at DATETIME,
      payment_confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration-safe schema updates for orders payment webhook replay protection fields
  if (!(db instanceof MySQLWrapper)) {
    const orderColumns = await db.query<any>('PRAGMA table_info(orders)');
    const ensureOrderColumn = async (name: string, definition: string) => {
      const exists = orderColumns.some((column) => column.name === name);
      if (!exists) {
        await db.execute(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
      }
    };

    await ensureOrderColumn('stripe_payment_intent_id', 'TEXT');
    await ensureOrderColumn('paypal_order_id', 'TEXT');
    await ensureOrderColumn('stripe_last_event_id', 'TEXT');
    await ensureOrderColumn('stripe_last_event_created_at', 'DATETIME');
    await ensureOrderColumn('stripe_last_event_processed_at', 'DATETIME');
    await ensureOrderColumn('paypal_last_event_id', 'TEXT');
    await ensureOrderColumn('paypal_last_event_created_at', 'DATETIME');
    await ensureOrderColumn('paypal_last_event_processed_at', 'DATETIME');
    await ensureOrderColumn('payment_confirmed_at', 'DATETIME');
  } else {
    const hasOrderColumn = async (name: string) => db.queryOne<any>(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = ?
    `, [name]);
    const ensureMySqlOrderColumn = async (name: string, definition: string) => {
      const existing = await hasOrderColumn(name);
      if (!existing) {
        await db.execute(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
      }
    };

    await ensureMySqlOrderColumn('stripe_payment_intent_id', 'VARCHAR(255)');
    await ensureMySqlOrderColumn('paypal_order_id', 'VARCHAR(255)');
    await ensureMySqlOrderColumn('stripe_last_event_id', 'VARCHAR(255)');
    await ensureMySqlOrderColumn('stripe_last_event_created_at', 'TIMESTAMP NULL');
    await ensureMySqlOrderColumn('stripe_last_event_processed_at', 'TIMESTAMP NULL');
    await ensureMySqlOrderColumn('paypal_last_event_id', 'VARCHAR(255)');
    await ensureMySqlOrderColumn('paypal_last_event_created_at', 'TIMESTAMP NULL');
    await ensureMySqlOrderColumn('paypal_last_event_processed_at', 'TIMESTAMP NULL');
    await ensureMySqlOrderColumn('payment_confirmed_at', 'TIMESTAMP NULL');
  }

  // Order Items
  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_purchase REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Shopping Cart
  await run(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);

  // Cart Items
  await run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(cart_id, product_id)
    )
  `);

  // Support Tickets
  await run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      ticket_type TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Ticket Messages
  await run(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Moderation Audit Log
  await run(`
    CREATE TABLE IF NOT EXISTS moderation_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moderator_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Game Server Nodes
  await run(`
    CREATE TABLE IF NOT EXISTS server_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      region TEXT,
      game TEXT DEFAULT 'Rust',
      map TEXT DEFAULT 'Unknown',
      players_current INTEGER DEFAULT 0,
      players INTEGER DEFAULT 0,
      status TEXT DEFAULT 'offline',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration-safe schema updates for server_nodes
  if (!(db instanceof MySQLWrapper)) {
    const serverColumns = await db.query<any>('PRAGMA table_info(server_nodes)');
    const hasPlayersCurrent = serverColumns.some((column) => column.name === 'players_current');
    if (!hasPlayersCurrent) {
      await db.execute('ALTER TABLE server_nodes ADD COLUMN players_current INTEGER DEFAULT 0');
      const hasPlayersLegacy = serverColumns.some((column) => column.name === 'players');
      if (hasPlayersLegacy) {
        await db.execute('UPDATE server_nodes SET players_current = COALESCE(players, 0)');
      }
    }
  } else {
    const playersCurrentColumn = await db.queryOne<any>(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'server_nodes'
        AND COLUMN_NAME = 'players_current'
    `);
    if (!playersCurrentColumn) {
      await db.execute('ALTER TABLE server_nodes ADD COLUMN players_current INT DEFAULT 0');
      const playersLegacyColumn = await db.queryOne<any>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'server_nodes'
          AND COLUMN_NAME = 'players'
      `);
      if (playersLegacyColumn) {
        await db.execute('UPDATE server_nodes SET players_current = COALESCE(players, 0)');
      }
    }
  }

  await db.execute("UPDATE server_nodes SET players_current = COALESCE(players_current, 0), status = COALESCE(NULLIF(status, ''), 'offline')");

  // Site Settings
  await run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      \`key\` TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Game Stats
  await run(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      server_name TEXT NOT NULL,
      game_type TEXT NOT NULL,
      playtime REAL DEFAULT 0,
      bank_balance REAL DEFAULT 0,
      cash_on_hand REAL DEFAULT 0,
      total_wealth REAL DEFAULT 0,
      kills INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0,
      kd_ratio REAL DEFAULT 0,
      raids_completed INTEGER DEFAULT 0,
      vehicles_owned INTEGER DEFAULT 0,
      wipe_performance REAL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);


  // Migration-safe schema updates for game_stats
  const gameStatsColumnsToAdd = [
    { name: 'game_type', sqliteDef: "TEXT NOT NULL DEFAULT 'Rust'", mysqlDef: "VARCHAR(255) NOT NULL DEFAULT 'Rust'" },
    { name: 'playtime', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'bank_balance', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'cash_on_hand', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'total_wealth', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'kills', sqliteDef: 'INTEGER DEFAULT 0', mysqlDef: 'INT DEFAULT 0' },
    { name: 'deaths', sqliteDef: 'INTEGER DEFAULT 0', mysqlDef: 'INT DEFAULT 0' },
    { name: 'kd_ratio', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'raids_completed', sqliteDef: 'INTEGER DEFAULT 0', mysqlDef: 'INT DEFAULT 0' },
    { name: 'vehicles_owned', sqliteDef: 'INTEGER DEFAULT 0', mysqlDef: 'INT DEFAULT 0' },
    { name: 'wipe_performance', sqliteDef: 'REAL DEFAULT 0', mysqlDef: 'DOUBLE DEFAULT 0' },
    { name: 'last_updated', sqliteDef: 'DATETIME DEFAULT CURRENT_TIMESTAMP', mysqlDef: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
  ];

  if (!(db instanceof MySQLWrapper)) {
    const gameStatsColumns = await db.query<any>('PRAGMA table_info(game_stats)');
    const existingGameStatsColumns = new Set(gameStatsColumns.map((column) => column.name));
    for (const column of gameStatsColumnsToAdd) {
      if (!existingGameStatsColumns.has(column.name)) {
        await db.execute(`ALTER TABLE game_stats ADD COLUMN ${column.name} ${column.sqliteDef}`);
      }
    }
  } else {
    for (const column of gameStatsColumnsToAdd) {
      const existingColumn = await db.queryOne<any>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'game_stats'
          AND COLUMN_NAME = ?
      `, [column.name]);
      if (!existingColumn) {
        await db.execute(`ALTER TABLE game_stats ADD COLUMN ${column.name} ${column.mysqlDef}`);
      }
  if (!(db instanceof MySQLWrapper)) {
    const gameStatsColumns = await db.query<any>('PRAGMA table_info(game_stats)');
    const hasGameType = gameStatsColumns.some((column) => column.name === 'game_type');
    if (!hasGameType) {
      await db.execute("ALTER TABLE game_stats ADD COLUMN game_type TEXT NOT NULL DEFAULT 'Rust'");
    }
  } else {
    const gameTypeColumn = await db.queryOne<any>(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'game_stats'
        AND COLUMN_NAME = 'game_type'
    `);
    if (!gameTypeColumn) {
      await db.execute("ALTER TABLE game_stats ADD COLUMN game_type VARCHAR(255) NOT NULL DEFAULT 'Rust'");
    }
  }

  // Game Transactions
  await run(`
    CREATE TABLE IF NOT EXISTS game_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      server_name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL, -- 'income' or 'expense'
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Game Match History
  await run(`
    CREATE TABLE IF NOT EXISTS game_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      server_name TEXT NOT NULL,
      map_name TEXT,
      result TEXT, -- 'victory', 'defeat', 'survived', 'died'
      kills INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Direct Messages
  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Notifications
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Initialize default settings
  const defaultSettings = [
    { key: 'discord_webhook_url', value: '' },
    { key: 'steam_api_key', value: '' },
    { key: 'twitch_client_id', value: '' },
    { key: 'site_name', value: 'NightRespawn' },
    { key: 'site_description', value: 'Digital Underground' },
    { key: 'x_account_url', value: 'https://x.com/NightRespawn' },
    { key: 'network_servers', value: '[]' }
  ];

  for (const setting of defaultSettings) {
    if (db instanceof MySQLWrapper) {
      await db.execute('INSERT IGNORE INTO site_settings (key, value) VALUES (?, ?)', [setting.key, setting.value]);
    } else {
      await db.execute('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)', [setting.key, setting.value]);
    }
  }
}

export default db;
