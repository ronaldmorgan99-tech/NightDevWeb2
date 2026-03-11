import React from 'react';
import { motion } from 'motion/react';
import { Server, Globe, Zap, Shield, Users, Copy, Check, ExternalLink, Activity } from 'lucide-react';
import { useState } from 'react';

const ServerCard: React.FC<{
  name: string;
  ip: string;
  players: string;
  map: string;
  status: 'online' | 'offline';
  color: string;
  game: string;
}> = ({ name, ip, players, map, status, color, game }) => {
  const [copied, setCopied] = useState(false);

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
      {/* Decorative Background */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-${color}/10 transition-all`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${status === 'online' ? 'bg-neon-green shadow-[0_0_10px_#39ff14]' : 'bg-red-500'}`} />
            <div>
              <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{name}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1">{game}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-mono text-neon-cyan block">{players}</span>
            <span className="text-[8px] text-zinc-600 uppercase tracking-widest">{map}</span>
          </div>
        </div>

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
      </div>
    </motion.div>
  );
};

export default function ServersPage() {
  const servers: {
    name: string;
    ip: string;
    players: string;
    map: string;
    status: 'online' | 'offline';
    color: string;
    game: string;
  }[] = [
    { name: "CS2: Global Elite", ip: "45.123.45.67:27015", players: "18/20", map: "de_dust2", status: 'online', color: "neon-cyan", game: "Counter-Strike 2" },
    { name: "Rust: Brutal Survival", ip: "rust.nightrespawn.com:28015", players: "142/200", map: "Procedural", status: 'online', color: "neon-magenta", game: "Rust" },
    { name: "Unturned: Gritty Run", ip: "unturned.nightrespawn.com:25444", players: "24/32", map: "Washington", status: 'online', color: "neon-cyan", game: "Unturned" },
    { name: "Arma 3: Milsim Ops", ip: "arma.nightrespawn.com:2302", players: "45/64", map: "Altis", status: 'online', color: "neon-magenta", game: "Arma 3" },
    { name: "GMod: Chaos Madness", ip: "gmod.nightrespawn.com:27015", players: "12/24", map: "gm_construct", status: 'online', color: "neon-cyan", game: "Garry's Mod" },
    { name: "Minecraft: Empires", ip: "mc.nightrespawn.com", players: "8/50", map: "Survival", status: 'offline', color: "neon-magenta", game: "Minecraft" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      {/* Header Section */}
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
        
        {/* Atmospheric Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-0 left-0 w-64 h-64 bg-neon-cyan/20 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-neon-magenta/20 blur-[100px] rounded-full" />
        </div>
      </section>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Active Players", value: "249", color: "text-neon-cyan" },
          { icon: Zap, label: "Avg Latency", value: "24ms", color: "text-neon-magenta" },
          { icon: Shield, label: "Uptime", value: "99.9%", color: "text-neon-green" },
          { icon: Activity, label: "Total Nodes", value: "12", color: "text-neon-purple" }
        ].map((stat, i) => (
          <div key={i} className="cyber-card p-6 border-white/5 bg-white/[0.02] text-center group hover:border-white/10 transition-all">
            <stat.icon className={`w-5 h-5 mx-auto mb-3 ${stat.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
            <div className="text-2xl font-black text-white italic tracking-tighter mb-1">{stat.value}</div>
            <div className="text-[8px] text-zinc-600 uppercase tracking-[0.3em] font-black">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servers.map((server, i) => (
          <ServerCard 
            key={i} 
            name={server.name}
            ip={server.ip}
            players={server.players}
            map={server.map}
            status={server.status}
            color={server.color}
            game={server.game}
          />
        ))}
      </div>

      {/* Connection Guide */}
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
                  <p className="text-[10px] text-zinc-500 leading-relaxed">Copy the IP address from any server card and use the in-game console or "Direct Connect" menu to join instantly.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-cyber-black border border-neon-magenta/30 flex items-center justify-center text-neon-magenta font-mono text-xs shrink-0">02</div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">Steam Browser</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">Add our IPs to your Steam Favorites (View {'>'} Servers {'>'} Favorites) to see live status directly in your Steam client.</p>
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
            <div className="p-6 bg-cyber-black/40 border border-white/5 rounded-2xl">
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Network Health</h4>
              <div className="space-y-3">
                {['Frankfurt', 'London', 'New York', 'Singapore'].map(loc => (
                  <div key={loc} className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-bold">{loc}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="w-full h-full bg-neon-green" />
                      </div>
                      <span className="text-[8px] font-mono text-neon-green">OK</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
