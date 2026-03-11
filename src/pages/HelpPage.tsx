import React from 'react';
import { 
  Book, 
  Shield, 
  Terminal, 
  Zap, 
  ChevronRight, 
  Search,
  Lock,
  Cpu,
  Globe,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

const HelpPage: React.FC = () => {
  const categories = [
    {
      title: "Security Protocols",
      icon: <Shield className="w-6 h-6 text-neon-cyan" />,
      description: "Learn how to protect your operative dossier and maintain network anonymity.",
      articles: ["Two-Factor Authentication", "Password Requirements", "Session Management"]
    },
    {
      title: "Network Navigation",
      icon: <Globe className="w-6 h-6 text-neon-purple" />,
      description: "Master the interface and discover hidden sectors within the NightRespawn network.",
      articles: ["Forum Formatting Guide", "Tagging System", "Search Operators"]
    },
    {
      title: "Hardware Uplink",
      icon: <Cpu className="w-6 h-6 text-neon-green" />,
      description: "Technical specifications and troubleshooting for game server connections.",
      articles: ["CS2 Connection Guide", "Rust Server Rules", "Arma 3 Mod Installation"]
    },
    {
      title: "Operative Conduct",
      icon: <Terminal className="w-6 h-6 text-neon-yellow" />,
      description: "The rules of the digital underground. Essential reading for all new recruits.",
      articles: ["Community Guidelines", "Moderation Policy", "Reporting Procedures"]
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
          Knowledge <span className="text-neon-green neon-glow-green">Base</span>
        </h1>
        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-xs">
          Archives // Technical Documentation // Operative Guides
        </p>
        
        <div className="max-w-2xl mx-auto mt-10 relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
          <input 
            type="text" 
            placeholder="SEARCH THE ARCHIVES..." 
            className="w-full bg-cyber-black border border-white/10 rounded-2xl py-5 pl-16 pr-6 text-sm text-white focus:border-neon-green/50 outline-none transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)]"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="cyber-card p-8 border-white/5 hover:border-neon-green/30 transition-all group"
          >
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-neon-green/50 transition-colors">
                {cat.icon}
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic tracking-tight group-hover:text-neon-green transition-colors">
                    {cat.title}
                  </h2>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                    {cat.description}
                  </p>
                </div>
                
                <div className="space-y-2">
                  {cat.articles.map((article) => (
                    <button 
                      key={article}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all"
                    >
                      {article}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 cyber-card border-white/5 bg-white/[0.01] flex items-center gap-4">
          <Zap className="w-5 h-5 text-neon-yellow" />
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Quick Start</h4>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest">New recruit orientation</p>
          </div>
        </div>
        <div className="p-6 cyber-card border-white/5 bg-white/[0.01] flex items-center gap-4">
          <Lock className="w-5 h-5 text-neon-pink" />
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Privacy</h4>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Data encryption protocols</p>
          </div>
        </div>
        <div className="p-6 cyber-card border-white/5 bg-white/[0.01] flex items-center gap-4">
          <MessageSquare className="w-5 h-5 text-neon-cyan" />
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">FAQ</h4>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Common network queries</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
