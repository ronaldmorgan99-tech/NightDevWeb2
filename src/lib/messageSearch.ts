export interface SearchUserResult {
  id: number;
  username: string;
  avatar_url: string | null;
}

const FALLBACK_USERNAME = 'Unknown User';

const normalizeSearchUserResult = (value: unknown): SearchUserResult | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as {
    id?: unknown;
    username?: unknown;
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

  return { id, username, avatar_url };
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
