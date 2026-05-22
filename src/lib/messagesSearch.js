export function buildMembersSearchUrl(userSearch) {
  if (typeof userSearch !== 'string' || userSearch.length === 0) {
    return '/api/members';
  }

  return `/api/members?search=${encodeURIComponent(userSearch)}`;
}
