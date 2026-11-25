import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Request, Response } from 'express';
import type { IDatabase } from './db';

export const STEAM_OPENID_NS = 'http://specs.openid.net/auth/2.0';
export const STEAM_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';
export const STEAM_CLAIMED_ID_PATTERN = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
export const STEAM_STATE_COOKIE = 'steam_openid_state';
export const STEAM_AUTH_ERROR_REDIRECT = '/#/login?error=steam_auth_failed';
export const STEAM_AUTH_SUCCESS_REDIRECT = '/#/';

const DEFAULT_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const DEFAULT_API_BASE = 'https://api.steampowered.com';

export type SteamAuthDeps = {
  db: IDatabase;
  jwtSecret: string;
  cookieName: string;
  cookieOptions: CookieOptions;
  fetchImpl?: typeof fetch;
};

export function getSteamOpenIdEndpoint(): string {
  const configured = process.env.STEAM_OPENID_ENDPOINT?.trim();
  return configured || DEFAULT_OPENID_ENDPOINT;
}

export function getSteamApiBase(): string {
  const configured = process.env.STEAM_API_BASE?.trim();
  return configured?.replace(/\/$/, '') || DEFAULT_API_BASE;
}

export function isValidHttpOrigin(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.host) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function getPublicOrigin(req: Pick<Request, 'headers' | 'protocol'>): string {
  const configured = [process.env.SITE_ORIGIN, process.env.APP_URL, process.env.PUBLIC_SITE_URL]
    .map((value) => value?.trim())
    .find((value) => value && value !== 'MY_APP_URL' && isValidHttpOrigin(value));

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = forwardedProto || req.protocol || 'https';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const host = forwardedHost || String(req.headers.host || '').trim();
  if (!host) {
    throw new Error('Unable to determine public site origin');
  }
  return `${proto}://${host}`.replace(/\/$/, '');
}

export function getSteamCallbackUrl(origin: string, state?: string): string {
  const url = new URL('/api/auth/steam/callback', origin);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

export function parseSteamIdFromClaimedId(claimedId: string | undefined | null): string | null {
  if (!claimedId) return null;
  const match = STEAM_CLAIMED_ID_PATTERN.exec(claimedId.trim());
  return match?.[1] ?? null;
}

export function sanitizeSteamUsername(personaName: string | undefined | null, steamId: string): string {
  const cleaned = String(personaName || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 32)
    .replace(/^_+|_+$/g, '');

  if (cleaned.length >= 3) return cleaned;
  return `steam_${steamId}`.slice(0, 32);
}

export function buildSteamRedirectUrl(origin: string, state: string, endpoint = getSteamOpenIdEndpoint()): string {
  const url = new URL(endpoint);
  url.searchParams.set('openid.ns', STEAM_OPENID_NS);
  url.searchParams.set('openid.mode', 'checkid_setup');
  url.searchParams.set('openid.identity', STEAM_IDENTIFIER_SELECT);
  url.searchParams.set('openid.claimed_id', STEAM_IDENTIFIER_SELECT);
  url.searchParams.set('openid.return_to', getSteamCallbackUrl(origin, state));
  url.searchParams.set('openid.realm', origin);
  return url.toString();
}

export function collectOpenIdParams(query: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query || {})) {
    if (!key.startsWith('openid.') || value == null) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'string') params[key] = raw;
  }
  return params;
}

// Express/qs and URLSearchParams treat "+" as space (form-urlencoded). Steam's
// openid.sig is base64 and often contains literal "+" in the callback query
// string. decodeURIComponent preserves "+", so parse the raw URL search.
export function parseRawQueryString(search: string): Record<string, string> {
  const input = search.startsWith('?') ? search.slice(1) : search;
  const params: Record<string, string> = {};
  if (!input) return params;
  for (const part of input.split('&')) {
    if (!part) continue;
    const separator = part.indexOf('=');
    const rawKey = separator === -1 ? part : part.slice(0, separator);
    const rawValue = separator === -1 ? '' : part.slice(separator + 1);
    try {
      const key = decodeURIComponent(rawKey);
      const value = decodeURIComponent(rawValue);
      if (key) params[key] = value;
    } catch {
      if (rawKey) params[rawKey] = rawValue;
    }
  }
  return params;
}

export function collectOpenIdParamsFromUrl(urlOrSearch: string | undefined): Record<string, string> {
  if (!urlOrSearch) return {};
  const search = urlOrSearch.includes('?') ? urlOrSearch.slice(urlOrSearch.indexOf('?')) : urlOrSearch;
  return collectOpenIdParams(parseRawQueryString(search));
}

export function getRequestSearch(req: Pick<Request, 'originalUrl' | 'url'>): string {
  const candidate = req.originalUrl || req.url || '';
  const index = candidate.indexOf('?');
  return index === -1 ? '' : candidate.slice(index);
}

function applyAuthNoStoreHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

function logSteamAuth(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...details }));
}

export function parseOpenIdKeyValues(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of String(body || '').split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function isAllowedReturnTo(returnTo: string | undefined, origin: string, state: string): boolean {
  if (!returnTo) return false;
  try {
    const actual = new URL(returnTo);
    const expected = new URL('/api/auth/steam/callback', origin);
    if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) return false;
    if (actual.searchParams.get('state') !== state) return false;
    return [...actual.searchParams.keys()].every((key) => key === 'state');
  } catch {
    return false;
  }
}

export function assertSteamCallbackShape(params: Record<string, string>, origin: string, state: string): string {
  if (params['openid.ns'] !== STEAM_OPENID_NS) {
    throw new Error('Invalid OpenID namespace');
  }
  if (params['openid.mode'] !== 'id_res') {
    throw new Error('Invalid OpenID mode');
  }
  if (params['openid.op_endpoint'] !== getSteamOpenIdEndpoint()) {
    throw new Error('Invalid OpenID provider endpoint');
  }
  if (!isAllowedReturnTo(params['openid.return_to'], origin, state)) {
    throw new Error('Invalid OpenID return_to');
  }

  const claimedId = params['openid.claimed_id'] || '';
  const identity = params['openid.identity'] || '';
  const steamId = parseSteamIdFromClaimedId(claimedId);
  if (!steamId || claimedId !== identity) {
    throw new Error('Invalid Steam claimed_id');
  }

  const signed = String(params['openid.signed'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  for (const required of ['claimed_id', 'identity', 'return_to', 'op_endpoint', 'sig']) {
    const hasSigned = required === 'sig' ? Boolean(params['openid.sig']) : signed.includes(required);
    if (!hasSigned) {
      throw new Error(`OpenID assertion is missing ${required}`);
    }
  }

  return steamId;
}

export type SteamAssertionResult = {
  ok: boolean;
  reason?: string;
  status?: number;
};

export async function verifySteamAssertion(
  params: Record<string, string>,
  fetchImpl: typeof fetch = fetch
): Promise<SteamAssertionResult> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.set(key, key === 'openid.mode' ? 'check_authentication' : value);
  }
  body.set('openid.mode', 'check_authentication');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(getSteamOpenIdEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/plain' },
      body: body.toString(),
      redirect: 'manual',
      signal: controller.signal
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, reason: 'steam_verification_redirected', status: response.status };
    }
    if (!response.ok) {
      return { ok: false, reason: 'steam_verification_http_error', status: response.status };
    }
    const parsed = parseOpenIdKeyValues(await response.text());
    if (parsed.is_valid !== 'true') {
      return { ok: false, reason: 'steam_assertion_not_valid', status: response.status };
    }
    return { ok: true, status: response.status };
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? 'steam_verification_timeout' : 'steam_verification_fetch_failed';
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}

export type SteamProfile = {
  steamId: string;
  personaName?: string;
  avatarUrl?: string;
};

export async function fetchSteamProfile(
  steamId: string,
  fetchImpl: typeof fetch = fetch
): Promise<SteamProfile> {
  const apiKey = process.env.STEAM_API_KEY?.trim();
  if (!apiKey) {
    return { steamId };
  }

  try {
    const url = new URL('/ISteamUser/GetPlayerSummaries/v2/', getSteamApiBase());
    url.searchParams.set('key', apiKey);
    url.searchParams.set('steamids', steamId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(url.toString(), { method: 'GET', signal: controller.signal, redirect: 'error' });
      if (!response.ok) return { steamId };
      const payload = await response.json() as {
        response?: { players?: Array<{ steamid?: string; personaname?: string; avatarfull?: string; avatarmedium?: string; avatar?: string }> };
      };
      const player = payload.response?.players?.find((item) => item.steamid === steamId) || payload.response?.players?.[0];
      return {
        steamId,
        personaName: player?.personaname,
        avatarUrl: player?.avatarfull || player?.avatarmedium || player?.avatar
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { steamId };
  }
}

async function allocateUsername(db: IDatabase, personaName: string | undefined, steamId: string): Promise<string> {
  const candidates = [
    sanitizeSteamUsername(personaName, steamId),
    sanitizeSteamUsername(`${personaName || 'steam'}_${steamId.slice(-4)}`, steamId),
    `steam_${steamId}`.slice(0, 32)
  ];
  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    const existing = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = ?', [candidate]);
    if (!existing) return candidate;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = crypto.randomBytes(2).toString('hex');
    const candidate = `steam_${steamId.slice(-8)}_${suffix}`.slice(0, 32);
    const existing = await db.queryOne<{ id: number }>('SELECT id FROM users WHERE username = ?', [candidate]);
    if (!existing) return candidate;
  }

  throw new Error('Unable to allocate a unique username for Steam login');
}

export async function upsertSteamUser(db: IDatabase, profile: SteamProfile): Promise<{
  id: number;
  username: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}> {
  const steamUrl = `https://steamcommunity.com/profiles/${profile.steamId}`;
  const existing = await db.queryOne<any>('SELECT * FROM users WHERE steam_id = ?', [profile.steamId]);

  if (existing) {
    const updates: string[] = ['steam_url = ?', 'last_active = CURRENT_TIMESTAMP'];
    const params: any[] = [steamUrl];
    if (profile.avatarUrl) {
      updates.push('avatar_url = ?');
      params.push(profile.avatarUrl);
    }
    params.push(existing.id);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    return {
      id: existing.id,
      username: existing.username,
      email: existing.email,
      role: existing.role,
      avatar_url: profile.avatarUrl || existing.avatar_url
    };
  }

  const username = await allocateUsername(db, profile.personaName, profile.steamId);
  const email = `steam-${profile.steamId}@users.noreply.nightrespawn.app`;
  const passwordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

  await db.execute(
    'INSERT INTO users (username, email, password, role, avatar_url, steam_url, steam_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, email, passwordHash, 'member', profile.avatarUrl || null, steamUrl, profile.steamId]
  );

  const created = await db.queryOne<any>('SELECT id, username, email, role, avatar_url FROM users WHERE steam_id = ?', [profile.steamId]);
  if (!created) {
    throw new Error('Failed to load Steam user after insert');
  }
  return created;
}

function stateCookieOptions(base: CookieOptions): CookieOptions {
  return {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: 10 * 60 * 1000,
    // Lax is required so the cookie is sent on the top-level GET back from Steam.
    sameSite: 'lax'
  };
}

export function createSteamAuthHandlers(deps: SteamAuthDeps) {
  const fetchImpl = deps.fetchImpl || fetch;

  const start = (req: Request, res: Response) => {
    applyAuthNoStoreHeaders(res);
    try {
      const origin = getPublicOrigin(req);
      const state = crypto.randomBytes(24).toString('hex');
      res.cookie(STEAM_STATE_COOKIE, state, stateCookieOptions(deps.cookieOptions));
      logSteamAuth('steam.auth.start', { origin });
      return res.redirect(302, buildSteamRedirectUrl(origin, state));
    } catch (error: any) {
      logSteamAuth('steam.auth.start_failed', { reason: error?.message || 'Failed to start Steam login' });
      return res.status(500).json({ error: error?.message || 'Failed to start Steam login' });
    }
  };

  const callback = async (req: Request, res: Response) => {
    applyAuthNoStoreHeaders(res);
    const fail = (origin: string | undefined, reason: string, extra: Record<string, unknown> = {}) => {
      logSteamAuth('steam.auth.callback_failed', { reason, origin: origin || null, ...extra });
      const safeOrigin = origin && isValidHttpOrigin(origin) ? origin.replace(/\/$/, '') : '';
      res.clearCookie(STEAM_STATE_COOKIE, { ...deps.cookieOptions, maxAge: 0 });
      return res.redirect(302, `${safeOrigin}${STEAM_AUTH_ERROR_REDIRECT}`);
    };

    let origin = '';
    try {
      origin = getPublicOrigin(req);
      const state = String(req.cookies?.[STEAM_STATE_COOKIE] || '');
      const params = collectOpenIdParamsFromUrl(getRequestSearch(req));
      if (!state) {
        return fail(origin, 'missing_state_cookie', {
          hasReturnTo: Boolean(params['openid.return_to']),
          mode: params['openid.mode'] || null
        });
      }
      const steamId = assertSteamCallbackShape(params, origin, state);
      const verification = await verifySteamAssertion(params, fetchImpl);
      if (!verification.ok) {
        return fail(origin, verification.reason || 'steam_assertion_not_valid', { status: verification.status || null });
      }

      if (!deps.jwtSecret || deps.jwtSecret.length < 32) {
        logSteamAuth('steam.auth.callback_failed', { reason: 'jwt_secret_missing_or_too_short' });
        return res.status(500).json({ error: 'JWT_SECRET is required and must be at least 32 characters.' });
      }

      const profile = await fetchSteamProfile(steamId, fetchImpl);
      const user = await upsertSteamUser(deps.db, profile);
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        deps.jwtSecret,
        { expiresIn: '24h' }
      );
      res.clearCookie(STEAM_STATE_COOKIE, { ...deps.cookieOptions, maxAge: 0 });
      res.cookie(deps.cookieName, token, deps.cookieOptions);
      logSteamAuth('steam.auth.callback_success', { userId: user.id, usedSteamProfile: Boolean(profile.personaName || profile.avatarUrl) });
      return res.redirect(302, `${origin}${STEAM_AUTH_SUCCESS_REDIRECT}`);
    } catch (error: any) {
      return fail(origin, error?.message || 'steam_callback_exception');
    }
  };

  return { start, callback };
}
