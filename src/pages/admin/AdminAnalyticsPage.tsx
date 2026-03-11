import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion } from 'motion/react';

const AdminAnalyticsPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => fetch('/api/admin/analytics').then(res => res.json())
  });

  if (isLoading) return <div className="animate-pulse space-y-8">{[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/5 rounded-3xl" />)}</div>;

  const stats = [
    { label: 'Total Operatives', value: data?.stats.users, icon: Users, color: 'text-neon-cyan', glow: 'neon-glow-cyan' },
    { label: 'Network Traffic', value: data?.stats.posts, icon: MessageSquare, color: 'text-neon-purple', glow: 'neon-glow-purple' },
    { label: 'Active Sectors', value: data?.stats.threads, icon: Activity, color: 'text-neon-green', glow: 'neon-glow-green' },
    { label: 'Black Market Revenue', value: `${data?.stats.revenue.toFixed(2)} CR`, icon: DollarSign, color: 'text-neon-yellow', glow: 'neon-glow-yellow' },
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Network <span className="text-neon-cyan neon-glow-cyan">Analytics</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Real-time Data Streams // System Performance Metrics</p>
        </div>
        <div className="flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse shadow-[0_0_10px_#39FF14]" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Uplink Active</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card border-white/5 p-6 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-white/5 border border-white/10 group-hover:border-current transition-colors ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-neon-green uppercase tracking-widest">
                <ArrowUpRight className="w-3 h-3" /> 12%
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.label}</p>
              <p className={`text-3xl font-black italic tracking-tighter ${stat.color} ${stat.glow}`}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registration Trends */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card border-white/5 p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Operative Onboarding</h3>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Last 7 Cycles</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.registrations}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis stroke="#ffffff20" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#00f3ff', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#00f3ff" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Revenue Trends */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card border-white/5 p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Market Liquidity</h3>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Revenue Flow</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.orders}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#ffffff20" 
                  fontSize={10} 
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis stroke="#ffffff20" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#39FF14', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {data?.orders.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#39FF14' : '#39FF1480'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
