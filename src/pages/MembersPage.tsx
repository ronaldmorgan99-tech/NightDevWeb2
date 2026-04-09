import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, ShieldCheck, Award, Clock, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

interface Member {
  id: number;
  username: string;
  role: string;
  avatar_url?: string;
  last_active: string;
  created_at: string;
}

const MembersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await fetch('/api/members');
      if (!res.ok) {
        throw new Error('Failed to load members');
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const filteredMembers = members?.filter(m => 
    m.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-white/5 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Network <span className="text-neon-cyan neon-glow-cyan">Operatives</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Community Index // Verified Personnel</p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-cyan/50" />
          <input
            type="text"
            placeholder="SCAN FOR OPERATIVE_ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-cyber-black border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all font-mono text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {filteredMembers?.map((member, idx) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="group cyber-card p-8 border-white/5 hover:border-neon-cyan/30 transition-all duration-500 text-center relative overflow-hidden"
          >
            <div className="w-24 h-24 rounded-2xl bg-cyber-black border-2 border-white/10 flex items-center justify-center text-3xl font-black text-white mx-auto mb-6 shadow-2xl group-hover:border-neon-cyan/50 transition-all duration-500 overflow-hidden relative">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
              ) : (
                member.username.charAt(0).toUpperCase()
              )}
              <div className="absolute inset-0 bg-neon-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <h3 className="text-xl font-black text-white mb-2 italic tracking-tighter uppercase group-hover:text-neon-cyan transition-colors">
              {member.username}
            </h3>

            <div className={`inline-flex items-center gap-2 text-[8px] uppercase tracking-[0.3em] font-black px-3 py-1 rounded-lg mb-8 border ${
              member.role === 'admin' ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/30' :
              member.role === 'moderator' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
              'bg-white/5 text-zinc-500 border-white/10'
            }`}>
              {member.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
              {member.role === 'moderator' && <Award className="w-3 h-3" />}
              {member.role}
            </div>

            <div className="space-y-4 pt-8 border-t border-white/5 text-left">
              <div className="flex items-center justify-between text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">
                <span className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-neon-pink/50" />
                  Last Scan
                </span>
                <span className="text-zinc-400 font-mono">{new Date(member.last_active).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">
                <span className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-neon-cyan/50" />
                  Uplinked
                </span>
                <span className="text-zinc-400 font-mono">{new Date(member.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <Link 
              to={`/profile/${member.id}`}
              className="mt-8 cyber-button text-[10px] w-full block"
            >
              Access Dossier
            </Link>
          </motion.div>
        ))}

        {filteredMembers?.length === 0 && (
          <div className="col-span-full py-32 text-center cyber-card border-dashed border-white/10">
            <User className="w-16 h-16 text-zinc-900 mx-auto mb-6 opacity-20" />
            <p className="text-zinc-600 font-black uppercase tracking-[0.3em]">No operatives detected in this sector.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembersPage;
