// Builds the configured server list with a live status check applied.
// Shared by the local Express server (server.ts) and the Vercel function (api/[...path].ts).

import type { IDatabase } from './db';
import { getConfiguredServers, getPilotServerCode, isPilotEnabled, PILOT_SERVER_NAME, UNTURNED_APP_ID, type ConfiguredServer } from './configuredServers.js';
import { checkSteamServerStatus } from './serverStatus.js';
import { resolveSteamApiKey } from './steamAuth.js';

export async function getLiveConfiguredServers(
  db?: IDatabase,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<ConfiguredServer[]> {
  if (!isPilotEnabled(env)) return [];
  let apiKey: string | undefined;
  try {
    apiKey = await resolveSteamApiKey(db);
  } catch {
    apiKey = undefined;
  }
  const live = await checkSteamServerStatus({
    serverCode: getPilotServerCode(env),
    serverName: PILOT_SERVER_NAME,
    appId: UNTURNED_APP_ID,
    apiKey,
    fetchImpl
  });
  return getConfiguredServers(env, live);
}
