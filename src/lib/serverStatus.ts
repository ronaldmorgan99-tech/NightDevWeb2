// Live status for the NightRespawnPilot Unturned server.
//
// The server has no public IP (it is reachable only through Steam's relay by Server Code),
// so a direct A2S query from Vercel is impossible. The only real source that works from a
// serverless function is the Steam master server list, read through the Steam Web API
// method IGameServersService/GetServerList. That method needs a Steam Web API key. The site
// already resolves one for Steam sign-in (STEAM_API_KEY env var, or the steam_api_key admin
// setting), so the same key is reused here and no new configuration is introduced.
//
// Without a key, or if Steam can't be reached, the status is 'unknown' — never 'online'.

export type LiveServerStatus = {
  verified: boolean;
  online: boolean;
  players: number | null;
  maxPlayers: number | null;
  map: string | null;
  version: string | null;
  name: string | null;
  source: 'steam_web_api' | 'none';
  detail: string;
  checkedAt: string;
};

type SteamListedServer = {
  steamid?: string;
  name?: string;
  players?: number;
  max_players?: number;
  map?: string;
  version?: string;
  appid?: number;
};

const STEAM_SERVER_LIST_URL = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';
const CACHE_TTL_MS = 30_000;
const TIMEOUT_MS = 4_000;

let cache: { key: string; at: number; value: LiveServerStatus } | null = null;

export const resetServerStatusCache = () => {
  cache = null;
};

const unknown = (detail: string, now: Date): LiveServerStatus => ({
  verified: false,
  online: false,
  players: null,
  maxPlayers: null,
  map: null,
  version: null,
  name: null,
  source: 'none',
  detail,
  checkedAt: now.toISOString()
});

export async function checkSteamServerStatus(options: {
  serverCode: string;
  serverName: string;
  appId: number;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  useCache?: boolean;
}): Promise<LiveServerStatus> {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now ? options.now() : new Date();
  const apiKey = String(options.apiKey || '').trim();

  if (!/^\d{17}$/.test(options.serverCode)) {
    return unknown('No valid Steam Server Code is configured.', now);
  }
  if (!apiKey) {
    return unknown('Live status is not verified: no Steam Web API key is configured for this site.', now);
  }

  const cacheKey = `${options.appId}:${options.serverCode}:${options.serverName}`;
  if (options.useCache !== false && cache && cache.key === cacheKey && now.getTime() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const url = new URL(STEAM_SERVER_LIST_URL);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', '50');
  url.searchParams.set('filter', `\\appid\\${options.appId}\\name_match\\${options.serverName}*`);

  let result: LiveServerStatus;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      result = unknown(`Live status is not verified: Steam returned HTTP ${response.status}.`, now);
    } else {
      const body: any = await response.json();
      const servers: SteamListedServer[] = Array.isArray(body?.response?.servers) ? body.response.servers : [];
      const match = servers.find((server) => String(server.steamid || '') === options.serverCode);
      if (match) {
        result = {
          verified: true,
          online: true,
          players: Number.isFinite(Number(match.players)) ? Number(match.players) : 0,
          maxPlayers: Number.isFinite(Number(match.max_players)) ? Number(match.max_players) : null,
          map: match.map ? String(match.map) : null,
          version: match.version ? String(match.version) : null,
          name: match.name ? String(match.name) : null,
          source: 'steam_web_api',
          detail: 'Listed on the Steam master server.',
          checkedAt: now.toISOString()
        };
      } else {
        result = {
          verified: true,
          online: false,
          players: 0,
          maxPlayers: null,
          map: null,
          version: null,
          name: null,
          source: 'steam_web_api',
          detail: 'Not listed on the Steam master server.',
          checkedAt: now.toISOString()
        };
      }
    }
  } catch (err: any) {
    const reason = err?.name === 'AbortError' ? 'Steam did not respond in time' : 'Steam could not be reached';
    result = unknown(`Live status is not verified: ${reason}.`, now);
  } finally {
    clearTimeout(timer);
  }

  if (result.verified) {
    cache = { key: cacheKey, at: now.getTime(), value: result };
  }
  return result;
}
