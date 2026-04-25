import React, { useState } from 'react';
import { apiJson } from '../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, ShieldCheck, Award, MoreVertical, Search, Filter, User as UserIcon, ShieldAlert, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
  last_active: string;
}

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const AdminUsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => apiJson<User[]>('/api/admin/users')
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      apiJson(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        json: { role }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActiveMenu(null);
    }
  });

  const filteredUsers = asArray(users).filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) return <div className="animate-pulse space-y-4">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}</div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Operative <span className="text-neon-cyan neon-glow-cyan">Database</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Network Clearance // Personnel Management</p>
        </div>

        <div className="flex gap-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan/50" />
            <input
              type="text"
              placeholder="SCAN OPERATIVE_ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-cyber-black border border-white/10 rounded-xl py-3 pl-12 pr-6 text-xs text-zinc-300 focus:outline-none focus:border-neon-cyan/50 font-mono transition-all"
            />
          </div>
          <button className="p-3 bg-cyber-black border border-white/10 rounded-xl text-zinc-500 hover:text-neon-cyan hover:border-neon-cyan/30 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="cyber-card border-white/5 overflow-visible">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.02] text-[9px] uppercase tracking-[0.3em] font-black text-zinc-600 border-b border-white/5">
              <th className="px-8 py-6">Operative</th>
              <th className="px-8 py-6">Clearance</th>
              <th className="px-8 py-6">Link_Status</th>
              <th className="px-8 py-6">Uplink_Date</th>
              <th className="px-8 py-6 text-right">Protocols</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-neon-cyan/[0.02] transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center text-xs font-black text-white group-hover:border-neon-cyan/30 transition-colors">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-black text-white uppercase italic tracking-tight">{user.username}</div>
                      <div className="text-[10px] text-zinc-600 font-mono">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center gap-2 text-[8px] uppercase tracking-[0.2em] font-black px-3 py-1 rounded-lg border ${
                    user.role === 'admin' ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/30' :
                    user.role === 'moderator' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' :
                    user.role === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                    'bg-white/5 text-zinc-500 border-white/10'
                  }`}>
                    {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                    {user.role === 'moderator' && <Award className="w-3 h-3" />}
                    {user.role === 'suspended' && <ShieldAlert className="w-3 h-3" />}
                    {user.role}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${user.role === 'suspended' ? 'text-red-500' : 'text-neon-green'}`}>
                    <div className={`w-2 h-2 rounded-full ${user.role === 'suspended' ? 'bg-red-500' : 'bg-neon-green animate-pulse neon-glow-green'}`} />
                    {user.role === 'suspended' ? 'Severed' : 'Linked'}
                  </div>
                </td>
                <td className="px-8 py-6 text-[10px] font-mono text-zinc-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-8 py-6 text-right relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                    className="p-2 text-zinc-700 hover:text-neon-cyan transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {activeMenu === user.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, x: 10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95, x: 10 }}
                          className="absolute right-full mr-2 top-0 w-48 bg-cyber-dark border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden"
                        >
                          <div className="p-2 space-y-1">
                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest px-3 py-2">Update Clearance</p>
                            <button 
                              onClick={() => roleMutation.mutate({ userId: user.id, role: 'member' })}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            >
                              <UserIcon className="w-3 h-3" /> Member
                            </button>
                            <button 
                              onClick={() => roleMutation.mutate({ userId: user.id, role: 'moderator' })}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-neon-green hover:bg-neon-green/5 rounded-lg transition-all"
                            >
                              <Award className="w-3 h-3" /> Moderator
                            </button>
                            <button 
                              onClick={() => roleMutation.mutate({ userId: user.id, role: 'admin' })}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-neon-pink hover:bg-neon-pink/5 rounded-lg transition-all"
                            >
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                            <button 
                              onClick={() => roleMutation.mutate({ userId: user.id, role: 'suspended' })}
                              className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                            >
                              <XCircle className="w-3 h-3" /> Suspend
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-14 text-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  No operatives matched current filters or API returned no users
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
