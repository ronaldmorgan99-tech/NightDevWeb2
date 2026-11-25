import React from 'react';
import { motion } from 'motion/react';
import { Globe, Zap, Shield, Users, Copy, Check, ExternalLink, Activity, HelpCircle, Radio } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type ServerNode = {
  id: number | string;
  name: string;
  ip: string;
  players_current: number | null;
  players: number | null;
  max_players?: number | null;
  map: string;
  status: ServerStatus;
  region: string;
  game: string;
  version?: string;
  internal_address?: string;
  server_code?: string;
  verified?: boolean;
  status_source?: string;
  status_detail?: string;
  checked_at?: string | null;
};

type ServerStatus = 'online' | 'offline' | 'unknown';

const STATUS_STYLES: Record<ServerStatus, { dot: string; text: string; label: string }> = {
  online: { dot: 'bg-neon-green shadow-[0_0_10px_#39ff14] animate-pulse', text: 'text-neon-green', label: 'Online' },
  offline: { dot: 'bg-red-500', text: 'text-red-400', label: 'Offline' },
  unknown: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Unknown' }
};

const normalizeStatus = (status: unknown): ServerStatus =>
  status === 'online' || status === 'offline' ? status : 'unknown';

function formatPlayers(server: Pick<ServerNode, 'players' | 'max_players'>): string {
  if (server.players === null || server.players === undefined) return 'Unknown';
  return server.max_players ? `${server.players} / ${server.max_players}` : String(server.players);
}

function formatCheckedAt(value?: string | null): string {
  if (!value) return 'never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown time' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

const LiveStatusPanel: React.FC<{ servers: ServerNode[]; isLoading: boolean; isError: boolean }> = ({ servers, isLoading, isError }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const tracked = servers.filter((server) => Boolean(server.server_code));

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <section className="cyber-card p-6 md:p-8 border-white/5 bg-white/[0.02]" data-testid="live-server-status" aria-labelledby="live-server-status-title">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6">
        <div>
          <h2 id="live-server-status-title" className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
            <Radio className="w-5 h-5 text-neon-cyan" />
            Live Server Status
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">Checked against the Steam master server list. Refreshes every 10 seconds.</p>
        </div>
      </div>

      {isError ? (
        <p role="status" className="text-sm text-amber-300">Status unknown: the server list could not be loaded.</p>
      ) : isLoading ? (
        <p role="status" className="text-sm text-zinc-400">Checking server status…</p>
      ) : tracked.length === 0 ? (
        <p role="status" className="text-sm text-zinc-400">No game server is configured for live status.</p>
      ) : (
        <div className="space-y-4">
          {tracked.map((server) => {
            const status = normalizeStatus(server.status);
            const style = STATUS_STYLES[status];
            const code = server.server_code as string;
            return (
              <div key={server.id} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-cyber-black/40 border border-white/5" data-testid="live-status-row">
                <div className="col-span-2 md:col-span-1">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] font-black mb-1">Server</div>
                  <div className="text-base font-black text-white italic tracking-tighter uppercase">{server.name}</div>
                  <div className="text-[10px] text-zinc-500">{server.version ? `${server.game} ${server.version}` : server.game}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] font-black mb-1">Status</div>
                  <div className={`flex items-center gap-2 text-base font-black uppercase ${style.text}`} data-testid="live-status-value">
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    {style.label}
                  </div>
                  <div className="text-[10px] text-zinc-500">{server.verified ? `Verified ${formatCheckedAt(server.checked_at)}` : 'Not verified'}</div>
                </div>
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] font-black mb-1">Players</div>
                  <div className="text-base font-mono text-neon-cyan" data-testid="live-status-players">{formatPlayers(server)}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-[0.25em] font-black mb-1">Server code</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-zinc-300 break-all">{code}</code>
                    <button type="button" onClick={() => copyCode(code)} className="p-1.5 text-zinc-500 hover:text-neon-cyan transition-colors" aria-label={`Copy ${server.name} server code`}>
                      {copiedCode === code ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {server.status_detail && (
                  <p className="col-span-2 md:col-span-4 text-[11px] text-zinc-500 flex items-start gap-2">
                    {status === 'unknown' && <HelpCircle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" />}
                    {server.status_detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

function unturnedJoinUrl(address: string, status: string): string | null {
  if (status !== 'online' || typeof address !== 'string') return null;
  const endpoint = address.trim();
  // A relay server code is a Steam game-server ID. Keep its full precision.
  if (/^\d{17}$/.test(endpoint)) {
    return `steam://run/304930//+connect%20${endpoint}/`;
  }
  const parts = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+):(\d{1,5})$/i.exec(endpoint);
  if (!parts || Number(parts[2]) < 1 || Number(parts[2]) > 65535) return null;
  try {
    const { hostname } = new URL(`http://${endpoint}`);
    return `steam://connect/${hostname}:${Number(parts[2])}`;
  } catch {
    return null;
  }
}

const ServerCard: React.FC<{
  name: string;
  ip: string;
  players: string;
  map: string;
  status: ServerStatus;
  color: string;
  game: string;
  version?: string;
  internalAddress?: string;
}> = ({ name, ip, players, map, status, color, game, version, internalAddress }) => {
  const [copied, setCopied] = useState(false);
  const isUnturned = /\bunturned\b/i.test(game);
  const joinUrl = isUnturned ? unturnedJoinUrl(ip, status) : null;
  // When status can't be verified, still offer the join link, clearly labelled as unverified.
  const tryJoinUrl = isUnturned && status === 'unknown' ? unturnedJoinUrl(ip, 'online') : null;
  const style = STATUS_STYLES[status];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative p-6 bg-cyber-black/40 border border-white/5 rounded-2xl hover:border-neon-cyan/30 transition-all duration-500 overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-${color}/10 transition-all`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${style.dot}`} title={style.label} aria-label={`Status: ${style.label}`} />
            <div>
              <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{name}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">{version ? `${game} ${version}` : game}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-mono text-neon-cyan block">{players}</span>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">{map}</span>
          </div>
        </div>

        {isUnturned && internalAddress && (
          <p className="mb-4 text-[10px] text-zinc-500 uppercase tracking-widest">
            Internal address: <code className="font-mono normal-case text-zinc-400">{internalAddress}</code>
          </p>
        )}

        {isUnturned ? (
          joinUrl ? (
            <a href={joinUrl} className="btn-neon-cyan py-2.5 text-[10px] flex items-center justify-center gap-2">
              <Zap className="w-3 h-3" />
              Join with Steam
            </a>
          ) : tryJoinUrl ? (
            <div className="space-y-2">
              <a href={tryJoinUrl} className="btn-holographic py-2.5 text-[10px] flex items-center justify-center gap-2">
                <Zap className="w-3 h-3" />
                Try joining with Steam
              </a>
              <p role="status" className="text-center text-[10px] text-amber-300">Status not verified; the server may be down.</p>
            </div>
          ) : (
            <p role="status" className="py-2.5 text-center text-xs text-zinc-400">
              {status === 'offline' ? 'Server offline' : 'Waiting for server connection details'}
            </p>
          )
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 bg-cyber-black/60 border border-white/5 rounded-xl mb-6 group/ip">
              <code className="flex-1 text-xs font-mono text-zinc-400 group-hover/ip:text-white transition-colors truncate">
                {ip}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-2 text-zinc-500 hover:text-neon-cyan transition-colors relative"
              >
                {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
                {copied && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neon-green text-black text-[8px] font-black rounded uppercase">Copied</span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                className="btn-neon-cyan py-2.5 text-[10px] flex items-center justify-center gap-2"
                onClick={() => window.open(`steam://connect/${ip}`, '_blank')}
              >
                <Zap className="w-3 h-3" />
                DIRECT CONNECT
              </button>
              <button className="btn-holographic py-2.5 text-[10px] flex items-center justify-center gap-2">
                <Users className="w-3 h-3" />
                VIEW STATS
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default function ServersPage() {
  const { data: servers = [], isLoading, isError } = useQuery<ServerNode[]>({
    queryKey: ['servers'],
    refetchInterval: 10000,
    queryFn: async () => {
      const response = await fetch('/api/servers');
      if (!response.ok) {
        throw new Error('Failed to load servers');
      }
      const body = await response.json();
      return Array.isArray(body) ? body.map((server: ServerNode) => ({ ...server, status: normalizeStatus(server.status) })) : [];
    }
  });

  const verifiedServers = servers.filter((server) => server.status !== 'unknown');
  const unknownNodes = servers.length - verifiedServers.length;
  const activePlayers = verifiedServers.reduce((sum, server) => sum + (server.players || 0), 0);
  const onlineNodes = servers.filter(server => server.status === 'online').length;
  const networkStatus: ServerStatus = onlineNodes > 0 ? 'online' : unknownNodes > 0 ? 'unknown' : 'offline';

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      <section className="relative p-12 cyber-card border-neon-cyan/20 overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-[10px] font-black uppercase tracking-[0.3em] mb-6">
            <Globe className="w-3 h-3" />
            Global Network Infrastructure
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase mb-6 neon-glow-cyan">
            NEURAL <span className="text-neon-cyan">SERVERS</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            Access the NightRespawn network. High-performance, low-latency nodes distributed across the digital underground.
          </p>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-0 left-0 w-64 h-64 bg-neon-cyan/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-neon-magenta/20 blur-[100px] rounded-full" />
        </div>
      </section>

      <LiveStatusPanel servers={servers} isLoading={isLoading} isError={isError} />

      {/* Network stats: one card per distinct metric (the old "Players" and "Active Players"
          cards both showed the same live player total, so they are merged into one). Four cards
          fill 2x2 on small screens and one row of 4 from md up, with no orphan card. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="server-stats">
        {[
          { icon: Users, label: 'Players Online', value: verifiedServers.length > 0 ? String(activePlayers) : servers.length > 0 ? 'Unknown' : '0', sub: unknownNodes > 0 ? 'Verified nodes only' : 'Live total across all nodes', color: 'text-neon-cyan' },
          { icon: Activity, label: 'Nodes Online', value: `${onlineNodes}/${servers.length}`, sub: unknownNodes > 0 ? `${unknownNodes} not verified` : 'Game servers reporting in', color: 'text-neon-purple' },
          { icon: Shield, label: 'Network Status', value: STATUS_STYLES[networkStatus].label, sub: networkStatus === 'online' ? 'At least one node is up' : networkStatus === 'unknown' ? 'Status could not be verified' : 'No nodes reachable', color: STATUS_STYLES[networkStatus].text },
          { icon: Zap, label: 'Telemetry', value: servers.length === 0 ? 'No data' : unknownNodes > 0 ? 'Unverified' : 'Live', sub: 'Refreshes every 10 seconds', color: 'text-neon-magenta' }
        ].map((stat) => (
          <div key={stat.label} className="cyber-card p-6 border-white/5 bg-white/[0.02] text-center group hover:border-white/10 transition-all">
            <stat.icon className={`w-5 h-5 mx-auto mb-3 ${stat.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="text-2xl font-black text-white italic tracking-tighter mb-1">{stat.value}</div>
            <div className="text-[8px] text-zinc-500 uppercase tracking-[0.3em] font-black">{stat.label}</div>
            <div className="mt-2 text-[10px] text-zinc-600 font-medium">{stat.sub}</div>
          </div>
        ))}
      </div>

      {servers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              name={server.name}
              ip={server.ip}
              players={server.players === null || server.players === undefined ? 'UNKNOWN' : `${server.players} PLAYERS`}
              map={server.map || server.region}
              status={server.status}
              color="neon-cyan"
              game={server.game}
              version={server.version}
              internalAddress={server.internal_address}
            />
          ))}
        </div>
      ) : (
        <section className="cyber-card p-12 border-white/5 bg-white/[0.01] text-center">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-3">No active nodes detected</h2>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            Server telemetry is empty right now. Once a node is connected, live player counts and map status will appear here automatically.
          </p>
        </section>
      )}

      <section className="cyber-card p-10 border-white/5 bg-white/[0.01]">
        <div className="flex flex-col md:flex-row gap-12">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-6 flex items-center gap-3">
              <Zap className="w-6 h-6 text-neon-cyan" />
              CONNECTION PROTOCOLS
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-cyber-black border border-neon-cyan/30 flex items-center justify-center text-neon-cyan font-mono text-xs shrink-0">01</div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Direct Connect</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">Choose the join button on an available server to open it in your game client.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-cyber-black border border-neon-magenta/30 flex items-center justify-center text-neon-magenta font-mono text-xs shrink-0">02</div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Live Status</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">The server list refreshes automatically.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-cyber-black border border-neon-green/30 flex items-center justify-center text-neon-green font-mono text-xs shrink-0">03</div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Discord Integration</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">Join our Discord to get real-time status updates, coordinate with teammates, and receive notifications for server wipes.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-80 space-y-4">
            <button className="w-full btn-neon-magenta py-4 text-[10px] flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" />
              DOWNLOAD NETWORK TOOL
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
