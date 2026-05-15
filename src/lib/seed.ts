import db from './db.js';
import bcrypt from 'bcryptjs';

export async function seedDb() {
  // Schema setup is owned by server startup (`start()` in server.ts).
  // This function only performs deterministic seed/reset checks and writes.

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
  const isMySQL = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'));
  const insertOrIgnore = (table: string, cols: string[]) => {
    const placeholders = cols.map(() => '?').join(', ');
    return isMySQL
      ? `INSERT IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      : `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  };

  await db.execute(insertOrIgnore('users', ['username', 'email', 'password', 'role', 'bio']), ['admin', 'admin@nightrespawn.com', hashedPassword, 'admin', 'The platform administrator.']);
  await db.execute(insertOrIgnore('users', ['username', 'email', 'password', 'role', 'bio']), ['member', 'member@nightrespawn.com', hashedPassword, 'member', 'A regular community member.']);

  const admin = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = ?', ['admin']);
  const member = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = ?', ['member']);
  if (!admin?.id || !member?.id) throw new Error('Failed to resolve seeded users');

  await db.execute(insertOrIgnore('forum_categories', ['name', 'description', 'display_order']), ['Official', 'Official news and announcements', 1]);
  await db.execute(insertOrIgnore('forum_categories', ['name', 'description', 'display_order']), ['General', 'General community discussion', 2]);
  await db.execute(insertOrIgnore('forum_categories', ['name', 'description', 'display_order']), ['Gaming', 'Talk about your favorite games', 3]);

  const officialCat = await db.queryOne<{ id: number }>('SELECT id FROM forum_categories WHERE name = ?', ['Official']);
  const generalCat = await db.queryOne<{ id: number }>('SELECT id FROM forum_categories WHERE name = ?', ['General']);
  const gamingCat = await db.queryOne<{ id: number }>('SELECT id FROM forum_categories WHERE name = ?', ['Gaming']);
  if (!officialCat?.id || !generalCat?.id || !gamingCat?.id) throw new Error('Failed to resolve seeded categories');

  await db.execute(insertOrIgnore('forums', ['category_id', 'name', 'description', 'display_order', 'min_role_to_thread']), [officialCat.id, 'Announcements', 'Stay up to date with the latest news', 1, 'admin']);
  await db.execute(insertOrIgnore('forums', ['category_id', 'name', 'description', 'display_order', 'min_role_to_thread']), [officialCat.id, 'Rules & Info', 'Important information about the community', 2, 'admin']);
  await db.execute(insertOrIgnore('forums', ['category_id', 'name', 'description', 'display_order', 'min_role_to_thread']), [generalCat.id, 'General Discussion', 'Talk about anything', 1, 'member']);
  await db.execute(insertOrIgnore('forums', ['category_id', 'name', 'description', 'display_order', 'min_role_to_thread']), [generalCat.id, 'Introductions', 'Introduce yourself to the community', 2, 'member']);
  await db.execute(insertOrIgnore('forums', ['category_id', 'name', 'description', 'display_order', 'min_role_to_thread']), [gamingCat.id, 'FPS Games', 'Call of Duty, Battlefield, CS:GO, etc.', 1, 'member']);

  const threadCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM threads');
  if (!threadCount?.count) {
    const announcements = await db.queryOne<{ id: number }>('SELECT id FROM forums WHERE name = ?', ['Announcements']);
    const general = await db.queryOne<{ id: number }>('SELECT id FROM forums WHERE name = ?', ['General Discussion']);
    const fps = await db.queryOne<{ id: number }>('SELECT id FROM forums WHERE name = ?', ['FPS Games']);
    if (!announcements?.id || !general?.id || !fps?.id) throw new Error('Failed to resolve seeded forums');

    await db.execute('INSERT INTO threads (forum_id, author_id, title, is_pinned) VALUES (?, ?, ?, ?)', [announcements.id, admin.id, 'Welcome to NightRespawn!', 1]);
    await db.execute('INSERT INTO threads (forum_id, author_id, title, is_pinned) VALUES (?, ?, ?, ?)', [general.id, member.id, 'What are you playing this weekend?', 0]);
    await db.execute('INSERT INTO threads (forum_id, author_id, title, is_pinned) VALUES (?, ?, ?, ?)', [fps.id, member.id, 'Looking for a squad in Warzone', 0]);

    const seededThreads = await db.query<{ id: number; title: string }>('SELECT id, title FROM threads ORDER BY id ASC LIMIT 3');
    if (seededThreads.length === 3) {
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [seededThreads[0].id, admin.id, 'Welcome everyone to our new community platform! We hope you enjoy your stay.']);
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [seededThreads[1].id, member.id, 'I am planning to dive back into Elden Ring. How about you guys?']);
      await db.execute('INSERT INTO posts (thread_id, author_id, content) VALUES (?, ?, ?)', [seededThreads[2].id, member.id, 'Hey, I am looking for some chill people to play Warzone with tonight. Hit me up!']);
    }
  }

  await db.execute(insertOrIgnore('tags', ['name', 'color']), ['Official', '#ef4444']);
  await db.execute(insertOrIgnore('tags', ['name', 'color']), ['Question', '#3b82f6']);
  await db.execute(insertOrIgnore('tags', ['name', 'color']), ['Guide', '#10b981']);
  await db.execute(insertOrIgnore('tags', ['name', 'color']), ['Discussion', '#8b5cf6']);

  const ticketCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM tickets');
  if (!ticketCount?.count) {
    await db.execute('INSERT INTO tickets (user_id, subject, priority) VALUES (?, ?, ?)', [member.id, 'Cannot change my avatar', 'medium']);
    const ticket = await db.queryOne<{ id: number }>('SELECT id FROM tickets ORDER BY id DESC LIMIT 1');
    if (ticket?.id) {
      await db.execute('INSERT INTO ticket_messages (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticket.id, member.id, 'I tried uploading a PNG but it says invalid format.']);
    }
  }

  if (!statsCount?.count) {
    const insertGameStats = 'INSERT INTO game_stats (user_id, server_name, game_type, playtime, bank_balance, cash_on_hand, total_wealth, kills, deaths, kd_ratio, raids_completed, vehicles_owned, wipe_performance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await db.execute(insertGameStats, [admin.id, 'US-West Survival', 'Rust', 120.5, 50000, 5000, 55000, 450, 120, 3.75, 42, 5, 0.85]);
    await db.execute(insertGameStats, [admin.id, 'EU-Central Battle Royale', 'cs2', 45.2, 1200, 200, 1400, 89, 45, 1.98, 0, 0, 0.92]);
    await db.execute(insertGameStats, [member.id, 'US-West Survival', 'Rust', 15.0, 500, 50, 550, 12, 25, 0.48, 2, 1, 0.32]);
  }

  console.log('Database seeded successfully.');
}
