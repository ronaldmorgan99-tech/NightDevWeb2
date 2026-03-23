import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Users, Zap, Shield, Globe, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.27 4.57c-1.3-.6-2.7-1.04-4.19-1.3-.17.3-.37.63-.5.94-1.58-.24-3.15-.24-4.7 0-.13-.31-.33-.64-.5-.94-1.49.26-2.89.7-4.19 1.3C2.56 8.53 1.64 12.39 2.02 16.23c1.79 1.32 3.53 2.12 5.24 2.65.42-.58.8-1.21 1.12-1.88-.62-.23-1.21-.53-1.77-.88.15-.11.29-.22.43-.34 3.42 1.58 7.13 1.58 10.5 0 .14.12.28.23.43.34-.56.35-1.15.65-1.77.88.32.67.7 1.3 1.12 1.88 1.71-.53 3.45-1.33 5.24-2.65.46-4.4-.7-8.22-3.04-11.66zM8.47 13.42c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03-.02 1.12-.8 2.03-1.81 2.03zm7.06 0c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03 0 1.12-.8 2.03-1.81 2.03z"/>
  </svg>
);

export default function DiscordPage() {
  const discordLink = "https://discord.gg/NZbmQNxX";
  const discordLink = "https://discord.gg/3axtkUBN";
  const { data: communityStats } = useQuery<{ users: number }>({
    queryKey: ['community-stats'],
    queryFn: () => fetch('/api/community/stats').then(res => res.json())
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyber-card p-8 md:p-12 border-neon-purple/20 relative overflow-hidden"
      >
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-neon-purple/10 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-cyan/10 blur-[100px] rounded-full -ml-32 -mb-32" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-cyber-black border-2 border-neon-purple/50 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(145,70,255,0.3)]">
            <DiscordIcon className="w-12 h-12 text-neon-purple" />
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase mb-4 neon-glow-purple">
            NEURAL <span className="text-neon-purple">LINK</span> ESTABLISHED
          </h1>
          
          <p className="text-zinc-400 text-lg max-w-2xl mb-12 font-medium leading-relaxed">
            Join the digital underground. Connect with thousands of operatives, coordinate raids, and stay updated on the latest network transmissions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-12">
            {[
              { icon: Users, title: "COMMUNITY", desc: `${(communityStats?.users ?? 0).toLocaleString('en-US')} Active Operatives` },
              { icon: Zap, title: "REAL-TIME", desc: "Instant Mission Briefs" },
              { icon: Shield, title: "SECURE", desc: "Encrypted Comms" }
            ].map((feature, i) => (
              <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-neon-purple/30 transition-all group">
                <feature.icon className="w-8 h-8 text-neon-purple mb-4 mx-auto group-hover:scale-110 transition-transform" />
                <h3 className="text-xs font-black tracking-widest text-white uppercase mb-2">{feature.title}</h3>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{feature.desc}</p>
              </div>
            ))}
          </div>

          <a 
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon-purple px-12 py-5 text-xl group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 flex items-center gap-3">
              <DiscordIcon className="w-6 h-6" />
              JOIN DISCORD SERVER
              <ExternalLink className="w-5 h-5 opacity-50" />
            </span>
          </a>

          <div className="mt-12 flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-neon-purple/50" />
              GLOBAL ACCESS
            </div>
            <div className="w-1 h-1 bg-zinc-800 rounded-full" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-neon-purple/50" />
              OPEN ENROLLMENT
            </div>
          </div>
        </div>

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </motion.div>

      {/* Rules/Info Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="cyber-card p-8 border-white/5 bg-white/[0.02]">
          <h2 className="text-sm font-black text-neon-purple uppercase tracking-widest mb-6 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            NETWORK PROTOCOLS
          </h2>
          <ul className="space-y-4">
            {[
              "Maintain operational security at all times.",
              "Respect the chain of command and moderators.",
              "No unauthorized data mining or spamming.",
              "Keep transmissions relevant to the sector."
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-zinc-500 font-medium">
                <span className="text-neon-purple font-mono">0{i+1}</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>

        <div className="cyber-card p-8 border-white/5 bg-white/[0.02]">
          <h2 className="text-sm font-black text-neon-cyan uppercase tracking-widest mb-6 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            LIVE FEED
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                "The community here is insane. Best modding support I've found in the underground."
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-neon-purple/20" />
                <span className="text-[8px] font-black text-neon-purple uppercase tracking-widest">@Cipher_X</span>
              </div>
            </div>
            <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                "Coordinate your raids in the #tactical channel. We never miss a wipe."
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-neon-cyan/20" />
                <span className="text-[8px] font-black text-neon-cyan uppercase tracking-widest">@Neon_Ghost</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
