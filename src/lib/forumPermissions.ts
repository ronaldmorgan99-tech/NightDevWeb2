/**
 * Shared permission rules for forum thread and post actions.
 *
 * Imported by both the local Express server (server.ts) and the Vercel serverless API
 * (api/[...path].ts) so the two backends cannot drift apart again. Keep this module free
 * of runtime relative imports: Vercel runs it as Node ESM, where an extensionless relative
 * import crashes every route (see PR #236/#237). Type-only imports are erased and are fine.
 */
import type { IDatabase } from './db';

export type ForumActor = { id: number; role?: string | null };

export type PermissionDenied = { allowed: false; status: 401 | 403; error: string };
export type PermissionResult = { allowed: true } | PermissionDenied;

/** HTTP status and JSON body for a denied result (works without strictNullChecks narrowing). */
export function deniedResponse(result: PermissionResult): { status: number; body: { error: string } } {
  const denied = result as PermissionDenied;
  return { status: denied.status ?? 403, body: { error: denied.error ?? 'Forbidden' } };
}

const ALLOW: PermissionResult = { allowed: true };
const deny = (error: string, status: 401 | 403 = 403): PermissionResult => ({ allowed: false, status, error });

/** Role ranking used for forum min_role_to_thread checks. Unknown roles rank lowest. */
export const ROLE_RANK: Readonly<Record<string, number>> = Object.freeze({
  admin: 4,
  moderator: 3,
  member: 2,
  suspended: 1
});

export function roleRank(role?: string | null): number {
  return (role && ROLE_RANK[role]) || 0;
}

/** True when userRole meets or exceeds minRole. A missing minRole means anyone signed in. */
export function meetsMinRole(userRole?: string | null, minRole?: string | null): boolean {
  return roleRank(userRole) >= roleRank(minRole);
}

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'moderator';
}

const flag = (value: unknown) => Number(value ?? 0) === 1 || value === true;
const sameId = (a: unknown, b: unknown) => a != null && b != null && Number(a) === Number(b);

export const LOCKED_THREAD_ERROR = 'This thread is locked. New replies are disabled.';

/** Reply (create a post) in a thread. Staff may still reply to locked threads. */
export function canReplyToThread(
  actor: ForumActor,
  thread: { is_locked?: unknown; min_role_to_thread?: string | null }
): PermissionResult {
  if (!meetsMinRole(actor.role, thread.min_role_to_thread)) {
    return deny('You do not have permission to post in this forum');
  }
  if (flag(thread.is_locked) && !isStaffRole(actor.role)) {
    return deny(LOCKED_THREAD_ERROR);
  }
  return ALLOW;
}

/** Create a thread in a forum. */
export function canCreateThread(actor: ForumActor, forum: { min_role_to_thread?: string | null }): PermissionResult {
  if (!meetsMinRole(actor.role, forum.min_role_to_thread)) {
    return deny('You do not have permission to create threads in this forum');
  }
  return ALLOW;
}

export type PostChanges = { content?: unknown; is_hidden?: unknown; is_deleted?: unknown };
type PostRow = { author_id: unknown; is_hidden?: unknown; is_deleted?: unknown };

/**
 * PATCH /api/posts/:id.
 * - Edit content: the author or staff.
 * - Hide / unhide: staff only.
 * - Delete (is_deleted: true, a soft delete): the author or staff. Authors cannot delete a
 *   post a moderator has hidden, so hidden content stays under moderator control.
 * - Restore (is_deleted: false): staff only.
 */
export function canUpdatePost(actor: ForumActor, post: PostRow, changes: PostChanges): PermissionResult {
  const isStaff = isStaffRole(actor.role);
  const isOwner = sameId(post.author_id, actor.id);
  if (!isOwner && !isStaff) return deny('Forbidden');
  if (isStaff) return ALLOW;

  if (changes.is_hidden !== undefined) {
    return deny('Only moderators can hide or unhide posts');
  }
  if (changes.is_deleted !== undefined) {
    if (!changes.is_deleted) return deny('Only moderators can restore deleted posts');
    if (flag(post.is_hidden)) return deny('This post was hidden by a moderator and cannot be deleted by its author');
  }
  return ALLOW;
}

export type ThreadChanges = { is_pinned?: unknown; is_locked?: unknown; is_solved?: unknown; is_hidden?: unknown };

/**
 * PATCH /api/threads/:id.
 * - Pin, lock and hide: staff only (lock now blocks replies, so it is a moderation power).
 * - Mark solved / unsolved: the thread author or staff.
 */
export function canUpdateThread(actor: ForumActor, thread: { author_id: unknown }, changes: ThreadChanges): PermissionResult {
  const isStaff = isStaffRole(actor.role);
  if (isStaff) return ALLOW;
  if (changes.is_pinned !== undefined) return deny('Only moderators can pin/unpin threads');
  if (changes.is_locked !== undefined) return deny('Only moderators can lock/unlock threads');
  if (changes.is_hidden !== undefined) return deny('Only moderators can hide/unhide threads');
  if (changes.is_solved !== undefined && !sameId(thread.author_id, actor.id)) return deny('Forbidden');
  return ALLOW;
}

/** DELETE /api/threads/:id: the thread author or staff (unchanged from before). */
export function canDeleteThread(actor: ForumActor, thread: { author_id: unknown }): PermissionResult {
  if (isStaffRole(actor.role) || sameId(thread.author_id, actor.id)) return ALLOW;
  return deny('Forbidden');
}

/** POST /api/reports: any signed-in user. */
export function canReport(actor: ForumActor | null | undefined): PermissionResult {
  if (!actor?.id) return deny('Not authenticated', 401);
  return ALLOW;
}

/**
 * Loads the acting user's current id and role from the database, so permission checks use
 * the live role rather than the (possibly stale) role baked into a 24h JWT.
 */
export async function loadForumActor(db: IDatabase, payload: { id?: unknown } | null | undefined): Promise<ForumActor | null> {
  if (!payload?.id) return null;
  const row = await db.queryOne<any>('SELECT id, role FROM users WHERE id = ?', [payload.id]);
  if (!row) return null;
  return { id: Number(row.id), role: row.role ?? null };
}

/** True when a content edit actually changes the stored text (used for edited_at). */
export function isContentChange(previous: unknown, next: string | undefined): boolean {
  if (next === undefined) return false;
  return String(previous ?? '') !== next;
}
