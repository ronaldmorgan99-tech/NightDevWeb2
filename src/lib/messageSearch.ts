export interface SearchUserResult {
  id: number;
  username: string;
  display_name?: string | null;
  avatar_url: string | null;
}

const FALLBACK_USERNAME = 'Unknown User';

const normalizeSearchUserResult = (value: unknown): SearchUserResult | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as {
    id?: unknown;
    username?: unknown;
    display_name?: unknown;
    avatar_url?: unknown;
  };

  const parsedId = Number(candidate.id);
  const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : 0;

  const username = typeof candidate.username === 'string' && candidate.username.trim().length > 0
    ? candidate.username.trim()
    : FALLBACK_USERNAME;

  const avatar_url = typeof candidate.avatar_url === 'string' && candidate.avatar_url.trim().length > 0
    ? candidate.avatar_url
    : null;

  const display_name = typeof candidate.display_name === 'string' && candidate.display_name.trim().length > 0
    ? candidate.display_name.trim()
    : undefined;

  return display_name ? { id, username, display_name, avatar_url } : { id, username, avatar_url };
};

export const normalizeSearchUserResults = (payload: unknown, currentUserId?: number): SearchUserResult[] => {
  const members = Array.isArray(payload) ? payload : [];

  return members
    .map(normalizeSearchUserResult)
    .filter((user): user is SearchUserResult => {
      if (!user) return false;
      if (currentUserId !== undefined && user.id === currentUserId) return false;
      return user.id !== 0;
    });
};
