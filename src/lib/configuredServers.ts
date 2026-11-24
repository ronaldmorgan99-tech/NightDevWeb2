// Servers listed from deployment configuration rather than the server_nodes table.
//
// NightRespawnPilot is the private Unturned playtest server. Players join it with its
// Steam relay Server Code, because its game port is only reachable on an internal network.
// The Server Code changes every time the dedicated server restarts, so override
// NIGHTRESPAWN_PILOT_SERVER_CODE after a restart (or set NIGHTRESPAWN_PILOT_ENABLED=false
// to hide the entry).

export type ConfiguredServer = {
  id: string;
  name: string;
  ip: string;
  region: string;
  game: string;
  map: string;
  version: string;
  internal_address: string;
  players_current: number;
  players: number;
  status: 'online' | 'offline';
};

const DEFAULT_PILOT_SERVER_CODE = '90298158635345928';
const DEFAULT_PILOT_INTERNAL_ADDRESS = '172.30.0.2:27015';

export const getConfiguredServers = (env: NodeJS.ProcessEnv = process.env): ConfiguredServer[] => {
  if (String(env.NIGHTRESPAWN_PILOT_ENABLED ?? 'true').toLowerCase() === 'false') {
    return [];
  }

  const serverCode = String(env.NIGHTRESPAWN_PILOT_SERVER_CODE || DEFAULT_PILOT_SERVER_CODE).trim();

  return [{
    id: 'nightrespawn-pilot',
    name: 'NightRespawnPilot',
    // The connect target is the Server Code, never the internal address.
    ip: serverCode,
    region: 'Private playtest',
    game: 'Unturned',
    map: 'PEI',
    version: '3.26.3.15',
    internal_address: String(env.NIGHTRESPAWN_PILOT_INTERNAL_ADDRESS || DEFAULT_PILOT_INTERNAL_ADDRESS).trim(),
    players_current: 0,
    players: 0,
    status: /^\d{17}$/.test(serverCode) ? 'online' : 'offline'
  }];
};
