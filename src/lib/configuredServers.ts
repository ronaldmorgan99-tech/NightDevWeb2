// Servers listed from deployment configuration rather than the server_nodes table.
//
// NightRespawnPilot is the private Unturned playtest server. Players join it with its
// Steam relay Server Code, because its game port is only reachable on an internal network.
// The Server Code changes every time the dedicated server restarts, so override
// NIGHTRESPAWN_PILOT_SERVER_CODE after a restart (or set NIGHTRESPAWN_PILOT_ENABLED=false
// to hide the entry).
//
// Status is never assumed. A configured Server Code only says where the server *would* be;
// whether it is actually up comes from a live check (see serverStatus.ts). Without a
// successful check the entry is reported as 'unknown', never as 'online'.

import type { LiveServerStatus } from './serverStatus';

export type ServerStatus = 'online' | 'offline' | 'unknown';

export type ConfiguredServer = {
  id: string;
  name: string;
  ip: string;
  server_code: string;
  region: string;
  game: string;
  map: string;
  version: string;
  internal_address: string;
  players_current: number | null;
  players: number | null;
  max_players: number | null;
  status: ServerStatus;
  verified: boolean;
  status_source: string;
  status_detail: string;
  checked_at: string | null;
};

const DEFAULT_PILOT_SERVER_CODE = '90298158635345928';
const DEFAULT_PILOT_INTERNAL_ADDRESS = '172.30.0.2:27015';
export const PILOT_SERVER_NAME = 'NightRespawnPilot';
export const UNTURNED_APP_ID = 304930;

export const getPilotServerCode = (env: NodeJS.ProcessEnv = process.env): string =>
  String(env.NIGHTRESPAWN_PILOT_SERVER_CODE || DEFAULT_PILOT_SERVER_CODE).trim();

export const isPilotEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  String(env.NIGHTRESPAWN_PILOT_ENABLED ?? 'true').toLowerCase() !== 'false';

export const getConfiguredServers = (
  env: NodeJS.ProcessEnv = process.env,
  live?: LiveServerStatus | null
): ConfiguredServer[] => {
  if (!isPilotEnabled(env)) {
    return [];
  }

  const serverCode = getPilotServerCode(env);
  const verified = Boolean(live && live.verified);
  const online = verified && live!.online;

  return [{
    id: 'nightrespawn-pilot',
    name: PILOT_SERVER_NAME,
    // The connect target is the Server Code, never the internal address.
    ip: serverCode,
    server_code: serverCode,
    region: 'Private playtest',
    game: 'Unturned',
    map: (online && live!.map) || 'PEI',
    version: (online && live!.version) || '3.26.3.15',
    internal_address: String(env.NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS || DEFAULT_PILOT_INTERNAL_ADDRESS).trim(),
    // Player counts are only reported when they come from a live check.
    players_current: online ? live!.players : verified ? 0 : null,
    players: online ? live!.players : verified ? 0 : null,
    max_players: online ? live!.maxPlayers : null,
    status: verified ? (online ? 'online' : 'offline') : 'unknown',
    verified,
    status_source: live?.source || 'none',
    status_detail: live?.detail || 'No live status check has run.',
    checked_at: live?.checkedAt || null
  }];
};
