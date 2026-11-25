import type { IDatabase } from './db';
import { userDisplayNameSql } from './userDisplay';

const AUTHOR_NAME_SQL = userDisplayNameSql('u');

/**
 * Shared forum queries used by both the local Express server (server.ts) and the
 * Vercel serverless API (api/[...path].ts), so both return the same author info.
 *
 * Author names prefer the Steam persona display_name (PR #235) over username; avatars
 * come from avatar_url, which Steam login refreshes with the Steam avatar.
 * Only public user fields are exposed here (id, display name, username, avatar, role, bio,
 * join date, last activity, post count). Never select email or password.
 */

export const HIDDEN_POST_PLACEHOLDER = 'This post has been hidden by a moderator.';

const visiblePostSql = (alias: string) =>
  `COALESCE(${alias}.is_deleted, 0) = 0 AND COALESCE(${alias}.is_hidden, 0) = 0`;

type LastPost = {
  thread_id?: number;
  forum_id?: number;
  last_thread_id?: number;
  last_thread_title?: string;
  last_post_at: string | null;
  last_post_author_id: number | null;
  last_post_author_name: string | null;
  last_post_author_avatar: string | null;
};

/** Adds last_post_* fields (latest visible post, its thread and author) to each forum. */
export async function attachForumLastPosts<T extends { id: number }>(db: IDatabase, forums: T[]): Promise<Array<T & Partial<LastPost>>> {
  if (forums.length === 0) return forums;
  const rows = await db.query<any>(`
    SELECT
      t.forum_id,
      t.id AS last_thread_id,
      t.title AS last_thread_title,
      p.created_at AS last_post_at,
      u.id AS last_post_author_id,
      ${AUTHOR_NAME_SQL} AS last_post_author_name,
      u.avatar_url AS last_post_author_avatar
    FROM posts p
    JOIN threads t ON t.id = p.thread_id
    JOIN users u ON u.id = p.author_id
    WHERE p.id IN (
      SELECT MAX(p2.id)
      FROM posts p2
      JOIN threads t2 ON t2.id = p2.thread_id
      WHERE ${visiblePostSql('p2')} AND COALESCE(t2.is_hidden, 0) = 0
      GROUP BY t2.forum_id
    )
  `);
  const byForum = new Map<number, any>();
  for (const row of rows) byForum.set(Number(row.forum_id), row);
  return forums.map((forum) => {
    const last = byForum.get(Number(forum.id));
    if (!last) return forum;
    const { forum_id: _ignored, ...rest } = last;
    return { ...forum, ...rest };
  });
}

/** Threads in a forum with author avatar and last-reply author. Hidden threads only for staff. */
export async function getForumThreads(db: IDatabase, forumId: number | string, viewerIsStaff: boolean) {
  const threads = await db.query<any>(`
    SELECT
      t.*,
      ${AUTHOR_NAME_SQL} AS author_name,
      u.avatar_url AS author_avatar,
      u.role AS author_role,
      (SELECT COUNT(*) FROM posts p WHERE p.thread_id = t.id AND COALESCE(p.is_deleted, 0) = 0) AS post_count
    FROM threads t
    JOIN users u ON t.author_id = u.id
    WHERE t.forum_id = ? ${viewerIsStaff ? '' : 'AND COALESCE(t.is_hidden, 0) = 0'}
    ORDER BY t.is_pinned DESC, t.created_at DESC
  `, [forumId]);

  if (threads.length === 0) return threads;

  const lastPosts = await db.query<any>(`
    SELECT
      p.thread_id,
      p.created_at AS last_post_at,
      u.id AS last_post_author_id,
      ${AUTHOR_NAME_SQL} AS last_post_author_name,
      u.avatar_url AS last_post_author_avatar
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.id IN (
      SELECT MAX(p2.id)
      FROM posts p2
      JOIN threads t2 ON t2.id = p2.thread_id
      WHERE t2.forum_id = ? AND ${visiblePostSql('p2')}
      GROUP BY p2.thread_id
    )
  `, [forumId]);
  const byThread = new Map<number, any>();
  for (const row of lastPosts) byThread.set(Number(row.thread_id), row);

  return threads.map((thread) => {
    const last = byThread.get(Number(thread.id));
    if (!last) return thread;
    const { thread_id: _ignored, ...rest } = last;
    return { ...thread, ...rest };
  });
}

/**
 * Thread with its posts and public author info. Deleted posts are dropped; hidden posts
 * are replaced with a placeholder for non-staff; hidden threads return null for non-staff.
 */
export async function getThreadWithPosts(db: IDatabase, threadId: number | string, viewerIsStaff: boolean) {
  const thread = await db.queryOne<any>(`
    SELECT t.*, ${AUTHOR_NAME_SQL} AS author_name, u.avatar_url AS author_avatar, u.role AS author_role, f.name AS forum_name
    FROM threads t
    JOIN users u ON t.author_id = u.id
    JOIN forums f ON t.forum_id = f.id
    WHERE t.id = ?
  `, [threadId]);
  if (!thread) return null;
  if (!viewerIsStaff && Number(thread.is_hidden || 0) === 1) return null;

  const posts = await db.query<any>(`
    SELECT
      p.*,
      ${AUTHOR_NAME_SQL} AS author_name,
      u.avatar_url AS author_avatar,
      u.role AS author_role,
      u.bio AS author_bio,
      u.created_at AS author_joined_at,
      u.last_active AS author_last_active,
      (SELECT COUNT(*) FROM posts ap WHERE ap.author_id = u.id AND COALESCE(ap.is_deleted, 0) = 0) AS author_post_count
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.thread_id = ? AND COALESCE(p.is_deleted, 0) = 0
    ORDER BY p.created_at ASC, p.id ASC
  `, [threadId]);

  const visiblePosts = posts.map((post) => {
    if (!viewerIsStaff && Number(post.is_hidden || 0) === 1) {
      return { ...post, content: HIDDEN_POST_PLACEHOLDER, author_bio: null, is_hidden_placeholder: true };
    }
    return post;
  });

  return { thread, posts: visiblePosts };
}

/** Counts a thread view. Failures are ignored so a view counter never breaks the page. */
export async function incrementThreadViews(db: IDatabase, threadId: number | string) {
  try {
    await db.execute('UPDATE threads SET views = COALESCE(views, 0) + 1 WHERE id = ?', [threadId]);
  } catch {
    // ignore
  }
}

/** True when the signed-in viewer (from a verified JWT payload) is currently a moderator or admin. */
export async function isViewerStaff(db: IDatabase, payload: { id?: number | string } | null | undefined): Promise<boolean> {
  if (!payload?.id) return false;
  try {
    const row = await db.queryOne<any>('SELECT role FROM users WHERE id = ?', [payload.id]);
    return row?.role === 'admin' || row?.role === 'moderator';
  } catch {
    return false;
  }
}
