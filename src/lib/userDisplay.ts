export type UserDisplaySource = {
  display_name?: string | null;
  username?: string | null;
};

export function getUserDisplayName(user?: UserDisplaySource | null): string {
  const display = String(user?.display_name || '').trim();
  if (display) return display;
  const username = String(user?.username || '').trim();
  return username || 'Player';
}

export function getUserAvatarInitial(user?: UserDisplaySource | null): string {
  const name = getUserDisplayName(user);
  const match = name.match(/[\p{L}\p{N}]/u);
  return (match?.[0] || name.charAt(0) || '?').toUpperCase();
}

/** SQL expression that prefers a non-empty display_name over username. */
export function userDisplayNameSql(alias = 'u'): string {
  const prefix = alias ? `${alias}.` : '';
  return `COALESCE(NULLIF(TRIM(${prefix}display_name), ''), ${prefix}username)`;
}
