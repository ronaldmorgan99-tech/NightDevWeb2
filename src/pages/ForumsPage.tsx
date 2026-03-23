import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { MessageSquare, ChevronRight, Users, Hash, Gamepad2, Server, Globe, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface Forum {
  id: number;
  name: string;
  description: string;
  display_order: number;
  thread_count: number;
  post_count: number;
}

interface Category {
  id: number;
  name: string;
  description: string;
  forums: Forum[];
}

interface CommunityStats {
  users: number;
  threads: number;
  posts: number;
  total_servers: number;
  online_servers: number;
  active_players: number;
}

const ForumsPage: React.FC = () => {
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['forum-categories'],
    queryFn: () => fetch('/api/forums/categories').then(res => res.json())
  });
  const { data: communityStats, isLoading: isStatsLoading, isError: isStatsError } = useQuery<CommunityStats>({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const res = await fetch('/api/community/stats');

      if (!res.ok) {
        throw new Error(`Failed to load community stats (${res.status})`);
      }

      return res.json();
    },
    staleTime: 60_000,
    retry: 1
  });

  const formatCompact = (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const statsUnavailable = isStatsLoading || isStatsError;
  const activePlayersLabel = statsUnavailable ? 'Stats unavailable' : `${communityStats?.active_players ?? 0} ONLINE`;
  const totalServersLabel = statsUnavailable ? 'Stats unavailable' : `${communityStats?.total_servers ?? 0} NODES`;
  const usersLabel = statsUnavailable ? 'Stats unavailable' : (communityStats?.users ?? 0).toLocaleString('en-US');
  const postsLabel = statsUnavailable ? 'Stats unavailable' : (communityStats?.posts ?? 0).toLocaleString('en-US');
  const onlineServersLabel = statsUnavailable ? 'Stats unavailable' : (communityStats?.online_servers ?? 0).toLocaleString('en-US');

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-8 w-48 bg-white/5 rounded-lg" />
            <div className="grid gap-4">
              {[1, 2].map(j => (
                <div key={j} className="h-24 bg-white/5 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative min-h-[500px] rounded-[2.5rem] overflow-hidden border border-neon-cyan/20 group shadow-[0_0_50px_rgba(0,243,255,0.1)]">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://i.imgur.com/d4K1jQB.jpeg" 
            alt="Cyberpunk City" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-100"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/80 via-cyber-bg/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-bg/60 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col justify-center p-12 md:p-20 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-neon-magenta/10 border border-neon-magenta/30 rounded-full mb-8 backdrop-blur-md">
            <div className="w-2 h-2 bg-neon-magenta rounded-full animate-pulse shadow-[0_0_8px_#ff00ff]" />
            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-neon-magenta neon-glow-magenta">SYSTEM ONLINE // V2.5.0</span>
          </div>
          
          <h1 className="flex flex-col gap-2 mb-8">
            <span className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic leading-none">
              THE DIGITAL
            </span>
            <span className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-none text-gradient-pink-blue py-2">
              UNDERGROUND
            </span>
          </h1>
          
          <p className="text-zinc-300 text-lg md:text-xl leading-relaxed max-w-2xl font-medium mb-10 drop-shadow-md">
            Welcome to the ultimate digital frontier. Our community fuses high-stakes CS2 tactical ops, brutal Rust survival raids, and sprawling Minecraft empires into one seamless, neon-lit universe. Connect, compete, and conquer.
          </p>
          
          <div className="flex flex-wrap gap-6">
            <Link to="/register" className="btn-neon-cyan px-10 py-4 text-base">
              <span className="glitch-text" data-text="Initialize Access">Initialize Access</span>
            </Link>
            <Link to="/servers" className="btn-neon-magenta px-10 py-4 text-base">
              <span className="glitch-text" data-text="Join Servers">Join Servers</span>
            </Link>
            <Link to="/members" className="btn-holographic px-10 py-4 text-base">
              Scan Network
            </Link>
          </div>
        </div>

        {/* HUD Elements */}
        <div className="absolute bottom-10 right-10 hidden md:flex flex-col items-end gap-4 opacity-40">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-1 h-8 bg-neon-cyan/30" />
            ))}
          </div>
          <div className="text-[10px] font-mono text-neon-cyan uppercase tracking-widest">
            LATENCY: 12MS // UPLINK: STABLE
          </div>
        </div>
      </section>

      {/* Categories */}
      <div className="space-y-12">
        {/* Servers Quick Access */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-8 rounded-3xl bg-gradient-to-r from-neon-cyan/10 via-cyber-black/40 to-neon-magenta/10 border border-white/5 overflow-hidden group"
        >
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px]" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-cyber-black border border-neon-cyan/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.1)] group-hover:shadow-[0_0_30px_rgba(0,243,255,0.2)] transition-all">
                <Server className="w-8 h-8 text-neon-cyan" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">LIVE NETWORK NODES</h2>
                <p className="text-zinc-500 text-sm font-medium mt-1">Direct access to our high-performance game servers.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
                <div className="hidden lg:flex items-center gap-4">
                  <div className="text-right">
                  <p className="text-xs font-black text-neon-green uppercase tracking-widest">{activePlayersLabel}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold">Active Operatives</p>
                </div>
                <div className="w-[1px] h-8 bg-white/10" />
                <div className="text-right">
                  <p className="text-xs font-black text-neon-cyan uppercase tracking-widest">{totalServersLabel}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-bold">Global Network</p>
                </div>
              </div>
              
              <Link to="/servers" className="btn-neon-cyan px-8 py-3 text-xs flex items-center gap-2">
                <Globe className="w-4 h-4" />
                VIEW ALL SERVERS
              </Link>
            </div>
          </div>
        </motion.section>

        {categories?.map((category, idx) => (
          <motion.section 
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="space-y-6"
          >
            <div className="flex items-end justify-between px-4">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3 italic tracking-tighter group-hover:text-neon-cyan transition-colors">
                  <Hash className="w-6 h-6 text-neon-cyan animate-pulse" />
                  {category.name}
                </h2>
                <div className="h-[2px] w-12 bg-neon-cyan mt-2" />
              </div>
            </div>

            <div className="grid gap-4">
              {category.forums.map((forum) => (
                <Link
                  key={forum.id}
                  to={`/forums/${forum.id}`}
                  className="group relative flex items-center gap-6 p-8 bg-cyber-dark/40 backdrop-blur-sm border border-white/5 rounded-2xl hover:border-neon-cyan/30 transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/0 via-neon-cyan/[0.02] to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  
                  <div className="w-14 h-14 bg-cyber-black border border-white/5 rounded-xl flex items-center justify-center group-hover:border-neon-cyan/50 group-hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all duration-500">
                    <MessageSquare className="w-7 h-7 text-zinc-600 group-hover:text-neon-cyan transition-colors" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-zinc-300 group-hover:text-white transition-colors italic tracking-tight">
                      {forum.name}
                    </h3>
                    <p className="text-zinc-500 text-sm mt-1 line-clamp-1 font-medium">
                      {forum.description}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-10 text-sm">
                    <div className="text-center">
                      <p className="text-neon-cyan font-mono font-bold text-lg">{formatCompact(forum.thread_count || 0)}</p>
                      <p className="text-zinc-600 text-[8px] uppercase tracking-[0.2em] font-black">Threads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-neon-pink font-mono font-bold text-lg">{formatCompact(forum.post_count || 0)}</p>
                      <p className="text-zinc-600 text-[8px] uppercase tracking-[0.2em] font-black">Posts</p>
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center group-hover:border-neon-cyan/30 transition-colors">
                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Stats Section */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-20 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/[0.02] to-transparent pointer-events-none" />
        <div className="p-10 bg-cyber-dark/40 backdrop-blur-md border border-white/5 rounded-3xl text-center group hover:border-neon-cyan/30 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-neon-cyan/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8 text-neon-cyan" />
            </div>
            <h4 className="text-4xl font-black text-white italic tracking-tighter">{usersLabel}</h4>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Active Operatives</p>
          </div>
        </div>
        <div className="p-10 bg-cyber-dark/40 backdrop-blur-md border border-white/5 rounded-3xl text-center group hover:border-neon-pink/30 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-pink/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-neon-pink/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-8 h-8 text-neon-pink" />
            </div>
            <h4 className="text-4xl font-black text-white italic tracking-tighter">{postsLabel}</h4>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Data Transmissions</p>
          </div>
        </div>
        <div className="p-10 bg-cyber-dark/40 backdrop-blur-md border border-white/5 rounded-3xl text-center group hover:border-neon-green/30 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-neon-green/10 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-8 h-8 text-neon-green" />
            </div>
            <h4 className="text-4xl font-black text-white italic tracking-tighter">{onlineServersLabel}</h4>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black mt-2">Uplinks Active</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ForumsPage;
