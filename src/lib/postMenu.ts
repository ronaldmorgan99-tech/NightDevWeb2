/**
 * Pure helpers for the forum post overflow (⋮) menu.
 * Kept free of React so Node tests can cover visibility, permalinks and quotes.
 */

export type PostMenuItemId =
  | 'quote'
  | 'copy-link'
  | 'edit'
  | 'hide'
  | 'unhide'
  | 'report'
  | 'sign-in'
  | 'delete';

export type PostMenuViewer = {
  id: number;
  role?: string | null;
} | null | undefined;

export type PostMenuContext = {
  viewer: PostMenuViewer;
  postAuthorId: number;
  isHidden: boolean;
  isLocked: boolean;
  isHiddenPlaceholder?: boolean;
};

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'moderator';
}

export function postAnchorId(postId: number | string): string {
  return `post-${postId}`;
}

/**
 * Visible ⋮ items for a viewer. Order is Quote, Copy link, Edit, Hide/Unhide,
 * Report or Sign in, then Delete (destructive last).
 */
export function getPostMenuItems(ctx: PostMenuContext): PostMenuItemId[] {
  const signedIn = ctx.viewer != null && ctx.viewer.id != null;
  const isStaff = signedIn && isStaffRole(ctx.viewer!.role);
  const isAuthor = signedIn && ctx.viewer!.id === ctx.postAuthorId;
  const placeholder = Boolean(ctx.isHiddenPlaceholder);
  const items: PostMenuItemId[] = [];

  // Staff may still reply to locked threads (the server allows it), so they keep Quote.
  if (signedIn && (!ctx.isLocked || isStaff) && !placeholder) {
    items.push('quote');
  }

  items.push('copy-link');

  if ((isAuthor || isStaff) && !placeholder) {
    items.push('edit');
  }

  if (isStaff) {
    items.push(ctx.isHidden ? 'unhide' : 'hide');
  }

  if (signedIn && !isAuthor && !placeholder) {
    items.push('report');
  } else if (!signedIn) {
    items.push('sign-in');
  }

  // Authors can delete their own posts (soft delete), except a post a moderator hid.
  if (isStaff || (isAuthor && !placeholder && !ctx.isHidden)) {
    items.push('delete');
  }

  return items;
}

function stripPostLocator(hashOrPath: string): string {
  return hashOrPath
    .replace(/#post-\d+$/i, '')
    .replace(/([?&])post=\d+(?=&|$)/gi, (_match, sep: string) => (sep === '?' ? '?' : ''))
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '')
    .replace(/\?$/, '');
}

/**
 * Build a permalink to a post. HashRouter URLs already use `#/…`, so a second
 * `#post-id` would break routing; those get `?post=id` on the hash route instead.
 * History-style URLs use `#post-id`.
 */
export function buildPostPermalink(pageUrl: string, postId: number | string): string {
  const hashIndex = pageUrl.indexOf('#');
  const beforeHash = hashIndex >= 0 ? pageUrl.slice(0, hashIndex) : pageUrl;
  const rawHash = hashIndex >= 0 ? pageUrl.slice(hashIndex + 1) : '';

  if (rawHash.startsWith('/')) {
    const route = stripPostLocator(rawHash);
    const sep = route.includes('?') ? '&' : '?';
    return `${beforeHash}#${route}${sep}post=${postId}`;
  }

  const base = stripPostLocator(pageUrl);
  return `${base}#${postAnchorId(postId)}`;
}

/** Read a post id from `?post=` or a trailing `#post-id` fragment. */
export function parsePostIdFromUrl(pageUrl: string): number | null {
  const hashAnchor = pageUrl.match(/#post-(\d+)/i);
  if (hashAnchor) return Number(hashAnchor[1]);
  const query = pageUrl.match(/[?&]post=(\d+)/i);
  if (query) return Number(query[1]);
  return null;
}

export function buildQuotedReply(authorName: string, content: string, existing = ''): string {
  const lines = (content ?? '').replace(/\s+$/, '').split(/\r?\n/);
  const quotedBody = lines.map((line) => `> ${line}`).join('\n');
  const name = (authorName || 'Someone').trim() || 'Someone';
  const block = `> ${name} wrote:\n${quotedBody}\n\n`;
  const prior = existing.trimEnd();
  return prior ? `${prior}\n\n${block}` : block;
}
