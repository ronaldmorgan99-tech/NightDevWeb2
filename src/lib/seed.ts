import db from './db';
import bcrypt from 'bcryptjs';

export async function seedDb() {
  // Schema setup is owned by server startup (`start()` in server.ts).
  // This function only performs deterministic seed/reset checks and writes.

  // Check if already seeded
  const userCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const catCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM forum_categories');
  const statsCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM game_stats');
  const duplicateCats = await db.query('SELECT name, COUNT(*) as count FROM forum_categories GROUP BY name HAVING count > 1');

  const resetDbEnabled = String(process.env.RESET_DB || '').toLowerCase() === 'true';

  if (resetDbEnabled && process.env.NODE_ENV === 'production') {
    throw new Error('RESET_DB is forbidden in production.');
  }

  if (!resetDbEnabled && userCount && userCount.count > 0 && catCount && catCount.count > 0 && statsCount && statsCount.count > 0 && duplicateCats.length === 0) {
    return;
  }

  console.log(`Running seed/reset logic (schema already initialized, RESET_DB=${resetDbEnabled})...`);

  if (resetDbEnabled) {
    await db.execute('DELETE FROM thread_tags');
    await db.execute('DELETE FROM posts');
    await db.execute('DELETE FROM threads');
    await db.execute('DELETE FROM forums');
    await db.execute('DELETE FROM forum_categories');
    await db.execute('DELETE FROM tags');
    await db.execute('DELETE FROM products');
    await db.execute('DELETE FROM game_stats');
    await db.execute('DELETE FROM game_transactions');
    await db.execute('DELETE FROM game_matches');
    await db.execute('DELETE FROM tickets');
    await db.execute('DELETE FROM ticket_messages');
    await db.execute('DELETE FROM moderation_actions');
    await db.execute('DELETE FROM notifications');
    await db.execute('DELETE FROM messages');
    await db.execute('DELETE FROM orders');
    await db.execute('DELETE FROM order_items');
    await db.execute('DELETE FROM reports');
    await db.execute('DELETE FROM users');
  }

  const hashedPassword = bcrypt.hashSync('password', 10);

  // Users
  const insertUser = process.env.DATABASE_URL ? 'INSERT IGNORE INTO users (username, email, password, role, bio) VALUES (?, ?, ?, ?, ?)' : 'INSERT OR IGNORE INTO users (username, email, password, role, bio) VALUES (?, ?, ?, ?, ?)';
  await db.execute(insertUser, ['admin', 'admin@nightrespawn.com', hashedPassword, 'admin', 'The platform administrator.']);
  await db.execute(insertUser, ['member', 'member@nightrespawn.com', hashedPassword, 'member', 'A regular community member.']);

  // Categories
  const insertCategory = process.env.DATABASE_URL ? 'INSERT IGNORE INTO forum_categories (name, description, display_order) VALUES (?, ?, ?)' : 'INSERT OR IGNORE INTO forum_categories (name, description, display_order) VALUES (?, ?, ?)';
  await db.execute(insertCategory, ['Official', 'Official news and announcements', 1]);
  await db.execute(insertCategory, ['General', 'General community discussion', 2]);
  await db.execute(insertCategory, ['Gaming', 'Talk about your favorite games', 3]);

  // Forums
  const insertForum = 'INSERT INTO forums (category_id, name, description, display_order, min_role_to_thread) VALUES (?, ?, ?, ?, ?)';
  await db.execute(insertForum, [1, 'Announcements', 'Stay up to date with the latest news', 1, 'admin']);
  await db.execute(insertForum, [1, 'Rules & Info', 'Important information about the community', 2, 'admin']);
  await db.execute(insertForum, [2, 'General Discussion', 'Talk about anything', 1, 'member']);
  await db.execute(insertForum, [2, 'Introductions', 'Introduce yourself to the community', 2, 'member']);
  await db.execute(insertForum, [3, 'FPS Games', 'Call of Duty, Battlefield, CS:GO, etc.', 1, 'member']);

  // Threads
  const insertThread = 'INSERT INTO threads (forum_id, author_id, title, is_pinned) VALUES (?, ?, ?, ?)';
  await db.execute(insertThread, [1, 1, 'Welcome to NightRespawn!', 1]);
  await db.execute(insertThread, [3, 2, 'What are you playing this weekend?', 0]);
  await db.execute(insertThread, [5, 2, 'Looking for a squad in Warzone', 0]);

  // Posts
  const insertPost = 'INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)';
  await db.execute(insertPost, [1, 1, 'Welcome everyone to our new community platform! We hope you enjoy your stay.']);
  await db.execute(insertPost, [2, 2, 'I am planning to dive back into Elden Ring. How about you guys?']);
  await db.execute(insertPost, [3, 2, 'Hey, I am looking for some chill people to play Warzone with tonight. Hit me up!']);

  // Tags
  const insertTag = 'INSERT INTO tags (name, color) VALUES (?, ?)';
  await db.execute(insertTag, ['Official', '#ef4444']);
  await db.execute(insertTag, ['Question', '#3b82f6']);
  await db.execute(insertTag, ['Guide', '#10b981']);
  await db.execute(insertTag, ['Discussion', '#8b5cf6']);

  // Thread Tags
  const insertThreadTag = 'INSERT INTO thread_tags (thread_id, tag_id) VALUES (?, ?)';
  await db.execute(insertThreadTag, [1, 1]);
  await db.execute(insertThreadTag, [2, 4]);

  // Products
  const insertProduct = 'INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)';
  await db.execute(insertProduct, ['Elite Member Badge', 'A shiny badge for your profile', 9.99, 'Digital']);
  await db.execute(insertProduct, ['Custom Profile Theme', 'Personalize your profile with custom colors', 4.99, 'Digital']);
  await db.execute(insertProduct, ['NightRespawn T-Shirt', 'High quality cotton t-shirt', 24.99, 'Merch']);

  // Tickets
  const insertTicket = 'INSERT INTO tickets (user_id, subject, priority) VALUES (?, ?, ?)';
  await db.execute(insertTicket, [2, 'Cannot change my avatar', 'medium']);

  const insertTicketMsg = 'INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)';
  await db.execute(insertTicketMsg, [1, 2, 'I tried uploading a PNG but it says invalid format.']);

  // Game Stats
  const insertGameStats = 'INSERT INTO game_stats (user_id, server_name, game_type, playtime, bank_balance, cash_on_hand, total_wealth, kills, deaths, kd_ratio, raids_completed, vehicles_owned, wipe_performance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  await db.execute(insertGameStats, [1, 'US-West Survival', 'Rust', 120.5, 50000, 5000, 55000, 450, 120, 3.75, 42, 5, 0.85]);
  await db.execute(insertGameStats, [1, 'EU-Central Battle Royale', 'cs2', 45.2, 1200, 200, 1400, 89, 45, 1.98, 0, 0, 0.92]);
  await db.execute(insertGameStats, [2, 'US-West Survival', 'Rust', 15.0, 500, 50, 550, 12, 25, 0.48, 2, 1, 0.32]);
  await db.execute(insertGameStats, [1, 'Global Milsim', 'arma3', 320.0, 150000, 25000, 175000, 1200, 150, 8.0, 0, 12, 0.98]);
  await db.execute(insertGameStats, [1, 'Chaos Sandbox', 'gmod', 80.0, 10000, 1000, 11000, 500, 200, 2.5, 0, 5, 0.5]);
  await db.execute(insertGameStats, [1, 'Empire Craft', 'gregtecMC', 500.0, 1000000, 50000, 1050000, 100, 50, 2.0, 0, 0, 1.0]);
  await db.execute(insertGameStats, [1, 'Gritty Survival', 'unturned', 150.0, 25000, 2500, 27500, 300, 100, 3.0, 15, 3, 0.75]);
  await db.execute(insertGameStats, [1, 'Tactical Ops', 'arma3', 45.0, 5000, 500, 5500, 150, 50, 3.0, 0, 2, 0.6]);
  await db.execute(insertGameStats, [1, 'Creative Build', 'gregtecMC', 200.0, 50000, 5000, 55000, 0, 0, 0, 0, 0, 0.9]);
  await db.execute(insertGameStats, [1, 'Deathmatch', 'cs2', 12.0, 500, 100, 600, 200, 150, 1.33, 0, 0, 0.4]);

  // Game Transactions
  const insertTransaction = 'INSERT INTO game_transactions (user_id, server_name, amount, type, description) VALUES (?, ?, ?, ?, ?)';
  await db.execute(insertTransaction, [1, 'US-West Survival', 5000, 'income', 'Sold scrap to outpost']);
  await db.execute(insertTransaction, [1, 'US-West Survival', 1200, 'expense', 'Bought LR-300']);
  await db.execute(insertTransaction, [1, 'Empire Craft', 50000, 'income', 'Sold diamond blocks']);
  await db.execute(insertTransaction, [1, 'Global Milsim', 25000, 'expense', 'Purchased AH-64 Apache']);

  // Game Match History
  const insertMatch = 'INSERT INTO game_matches (user_id, server_name, map_name, result, kills, deaths, score) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await db.execute(insertMatch, [1, 'EU-Central Battle Royale', 'Dust 2', 'victory', 25, 5, 1200]);
  await db.execute(insertMatch, [1, 'EU-Central Battle Royale', 'Mirage', 'defeat', 15, 18, 800]);
  await db.execute(insertMatch, [1, 'US-West Survival', 'Procedural Map', 'survived', 5, 0, 500]);

  console.log('Database seeded successfully.');
}
