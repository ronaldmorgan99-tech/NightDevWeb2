import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  MessageSquare, 
  ShieldAlert, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Clock,
  User,
  Settings,
  BarChart3,
  Share2,
  Ticket
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';

import { Link } from 'react-router';

interface Metrics {
  totalUsers: number;
  totalThreads: number;
  totalPosts: number;
  pendingReports: number;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ['admin-metrics'],
    queryFn: () => fetch('/api/admin/metrics').then(res => res.json())
  });

  const stats = [
    { label: 'Total Operatives', value: metrics?.totalUsers || 0, icon: Users, color: 'text-neon-cyan', trend: '+12%' },
    { label: 'Active Transmissions', value: metrics?.totalThreads || 0, icon: MessageSquare, color: 'text-neon-pink', trend: '+5%' },
    { label: 'Data Packets', value: metrics?.totalPosts || 0, icon: Activity, color: 'text-neon-green', trend: '+18%' },
    { label: 'Security Alerts', value: metrics?.pendingReports || 0, icon: ShieldAlert, color: 'text-neon-pink', trend: '-2%' },
  ];

  if (isLoading) return <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">{[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-white/5 rounded-3xl" />)}</div>;

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Command <span className="text-neon-cyan neon-glow-cyan">Overview</span></h1>
        <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">System Status // Real-time Network Monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="p-8 cyber-card border-white/5 hover:border-neon-cyan/20 transition-all duration-500"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-xl bg-cyber-black border border-white/10 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${stat.trend.startsWith('+') ? 'text-neon-green' : 'text-neon-pink'}`}>
                {stat.trend}
                {stat.trend.startsWith('+') ? <TrendingUp className="w-4 h-4" /> : <TrendingUp className="w-4 h-4 rotate-180" />}
              </div>
            </div>
            <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-1">{stat.value.toLocaleString()}</h3>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Network Activity</h2>
            <button className="text-[10px] font-black text-neon-cyan hover:text-white uppercase tracking-[0.3em] transition-colors">Full Log</button>
          </div>
          <div className="cyber-card border-white/5 overflow-hidden">
            <div className="divide-y divide-white/5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-6 flex items-center gap-6 hover:bg-neon-cyan/[0.02] transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center group-hover:border-neon-cyan/30 transition-colors">
                    <User className="w-6 h-6 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-400 font-medium">
                      <span className="font-black text-white uppercase italic tracking-tight">Operative_{i}29</span> initialized transmission in <span className="text-neon-cyan">Sector_Alpha</span>
                    </p>
                    <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-black mt-2 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-neon-pink/50" /> {i * 5}M_AGO // UPLINK_STABLE
                    </p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-zinc-800 group-hover:text-neon-cyan transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase px-2">Quick Access</h2>
          <div className="grid gap-5">
            <Link 
              to="/admin/moderation"
              className="cyber-button cyber-button-primary p-6 flex items-center gap-4 group"
            >
              <ShieldAlert className="w-6 h-6" />
              <span className="text-xs">Review Security Reports</span>
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link 
                  to="/admin/users"
                  className="p-6 bg-cyber-black border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all flex items-center gap-4"
                >
                  <Users className="w-6 h-6 text-zinc-500" />
                  Manage Operatives
                </Link>
                <Link 
                  to="/admin/analytics"
                  className="p-6 bg-cyber-black border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all flex items-center gap-4"
                >
                  <BarChart3 className="w-6 h-6 text-zinc-500" />
                  Network Analytics
                </Link>
                <Link 
                  to="/admin/integrations"
                  className="p-6 bg-cyber-black border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:border-neon-purple/50 hover:bg-neon-purple/5 transition-all flex items-center gap-4"
                >
                  <Share2 className="w-6 h-6 text-zinc-500" />
                  System Uplinks
                </Link>
              </>
            )}
            <Link 
              to="/admin/support"
              className="p-6 bg-cyber-black border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:border-neon-yellow/50 hover:bg-neon-yellow/5 transition-all flex items-center gap-4"
            >
              <Ticket className={`w-6 h-6 text-zinc-500`} />
              Support Terminal
            </Link>
            {user?.role === 'admin' && (
              <Link 
                to="/admin/settings"
                className="p-6 bg-cyber-black border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:border-neon-pink/50 hover:bg-neon-pink/5 transition-all flex items-center gap-4"
              >
                <Settings className="w-6 h-6 text-zinc-500" />
                System Protocols
              </Link>
            )}
          </div>

          <div className="p-8 bg-cyber-black border border-neon-cyan/20 rounded-3xl relative overflow-hidden group">
            <h4 className="font-black text-white uppercase italic tracking-tight text-lg mb-4">Core Status</h4>
            <div className="flex items-center gap-3 text-neon-green text-[10px] font-black uppercase tracking-widest">
              <div className="w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse neon-glow-green" />
              Network Operational
            </div>
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-6 leading-relaxed">
              Last backup: 02:00_UTC // DB_LATENCY: 12MS // SECURITY_LEVEL: HIGH
            </p>
            
            {/* Decorative element */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-neon-cyan/5 rounded-full blur-2xl group-hover:bg-neon-cyan/10 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
