import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, MessageSquare, Award, ShieldCheck, Clock, MapPin, Camera, Save, X, Settings, Github, Youtube, Twitch, Facebook, Server, TrendingUp, Wallet, Target, Activity, History, ArrowUpRight, ArrowDownLeft, Car, Zap, Trophy, MessageCircle } from 'lucide-react';
import { motion, useMotionValue, useSpring, animate, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const SteamIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 0a12 12 0 0 0-11.979 11.037l6.432 2.619a3.15 3.15 0 0 1 1.544-.491c.13 0 .257.01.381.028l2.847-4.142c-.03-.129-.048-.264-.048-.403 0-1.833 1.488-3.321 3.321-3.321S17.821 7.155 17.821 8.988s-1.488 3.321-3.321 3.321c-.14 0-.274-.017-.403-.048l-4.142 2.847c.018.124.028.251.028.381 0 1.833-1.488 3.321-3.321 3.321-.464 0-.887-.174-1.211-.459l-3.058.801c.08.243.18.472.299.688l1.817 4.461A12 12 0 1 0 12 0zm-1.066 14.896c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797zm4.074-5.464c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797z"/>
  </svg>
);

const KickIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M11 15H9V17H7V7H9V9H11V11H13V9H15V7H17V9H15V11H13V13H15V15H17V17H15V15H13V13H11V15Z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.27 4.57c-1.3-.6-2.7-1.04-4.19-1.3-.17.3-.37.63-.5.94-1.58-.24-3.15-.24-4.7 0-.13-.31-.33-.64-.5-.94-1.49.26-2.89.7-4.19 1.3C2.56 8.53 1.64 12.39 2.02 16.23c1.79 1.32 3.53 2.12 5.24 2.65.42-.58.8-1.21 1.12-1.88-.62-.23-1.21-.53-1.77-.88.15-.11.29-.22.43-.34 3.42 1.58 7.13 1.58 10.5 0 .14.12.28.23.43.34-.56.35-1.15.65-1.77.88.32.67.7 1.3 1.12 1.88 1.71-.53 3.45-1.33 5.24-2.65.46-4.4-.7-8.22-3.04-11.66zM8.47 13.42c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03-.02 1.12-.8 2.03-1.81 2.03zm7.06 0c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03 0 1.12-.8 2.03-1.81 2.03z"/>
  </svg>
);

interface UserProfile {
  id: number;
  username: string;
  role: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  created_at: string;
  last_active: string;
}

const NavArrow = ({ direction, onClick, disabled, className }: { 
  direction: 'left' | 'right', 
  onClick: () => void, 
  disabled?: boolean,
  className?: string 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`relative group w-14 h-24 ${className} ${disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !disabled && onClick()}
    >
      {/* Holographic Glass Base */}
      <motion.div
        animate={isHovered ? {
          backgroundColor: ['rgba(0, 243, 255, 0.05)', 'rgba(0, 243, 255, 0.1)', 'rgba(0, 243, 255, 0.05)'],
          borderColor: ['rgba(0, 243, 255, 0.8)', 'rgba(0, 243, 255, 1)', 'rgba(0, 243, 255, 0.8)'],
          boxShadow: [
            '0 0 15px rgba(0, 243, 255, 0.4), inset 0 0 15px rgba(0, 243, 255, 0.2)',
            '0 0 25px rgba(0, 243, 255, 0.6), inset 0 0 20px rgba(0, 243, 255, 0.3)',
            '0 0 15px rgba(0, 243, 255, 0.4), inset 0 0 15px rgba(0, 243, 255, 0.2)'
          ]
        } : {}}
        transition={{ duration: 0.15, repeat: Infinity }}
        style={{ clipPath: 'polygon(0% 15%, 15% 0%, 100% 0%, 100% 85%, 85% 100%, 0% 100%)' }}
        className={`absolute inset-0 bg-white/5 border-2 border-white/20 backdrop-blur-xl transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}
      >
        {/* Inner Reflection / Shine */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
        
        {/* Scanning Line Effect */}
        <motion.div
          animate={{ top: ['-10%', '110%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-40 shadow-[0_0_10px_#00f3ff]"
        />
        
        {/* Holographic Noise/Grain */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </motion.div>

      <motion.div
        animate={isHovered ? {
          x: [0, -3, 3, -2, 2, 0],
          y: [0, 2, -2, 1, -1, 0],
          filter: [
            'drop-shadow(0 0 10px #00f3ff) drop-shadow(0 0 15px #00f3ff88)',
            'drop-shadow(-3px 0 0 #00f3ff88) drop-shadow(3px 0 0 #00f3ff)',
            'drop-shadow(0 0 10px #00f3ff) drop-shadow(0 0 15px #00f3ff88)'
          ]
        } : {
          filter: 'drop-shadow(0 0 5px rgba(0, 243, 255, 0.5))'
        }}
        transition={isHovered ? { duration: 0.1, repeat: Infinity } : {}}
        className="relative w-full h-full flex items-center justify-center z-10"
      >
        {/* Sharp Chevron SVG */}
        <svg 
          viewBox="0 0 24 40" 
          className="w-8 h-12"
        >
          <path
            d={direction === 'left' ? "M 18 4 L 6 20 L 18 36" : "M 6 4 L 18 20 L 6 36"}
            fill="none"
            stroke={isHovered ? "#00f3ff" : "#00f3ffaa"}
            strokeWidth="5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          
          {/* Glitch Ghost Path */}
          <AnimatePresence>
            {isHovered && (
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.4, 0],
                  x: [0, 4, -4, 0],
                }}
                transition={{ duration: 0.08, repeat: Infinity }}
                d={direction === 'left' ? "M 18 4 L 6 20 L 18 36" : "M 6 4 L 18 20 L 6 36"}
                fill="none"
                stroke="#00f3ff"
                strokeWidth="3"
                className="mix-blend-screen opacity-50"
              />
            )}
          </AnimatePresence>
        </svg>
      </motion.div>

      {/* Outer Glow Pulse */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute inset-0 bg-neon-cyan/30 blur-3xl rounded-full -z-10"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ServerWheel = ({ 
  servers, 
  selectedServer, 
  onSelect 
}: { 
  servers: any[], 
  selectedServer: string | null, 
  onSelect: (name: string) => void 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [constraints, setConstraints] = useState({ left: 0, right: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const x = useMotionValue(0);
  const itemWidth = 180;

  useEffect(() => {
    const updateConstraints = () => {
      if (containerRef.current) {
        const totalWidth = servers.length * itemWidth;
        const leftLimit = Math.min(0, -(totalWidth - itemWidth));
        setConstraints({
          left: leftLimit,
          right: 0
        });
      }
    };

    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, [servers.length]);

  // Sync x with selectedServer
  useEffect(() => {
    if (selectedServer && !isInteracting) {
      const index = servers.findIndex(s => s.server_name === selectedServer);
      if (index !== -1) {
        const target = -index * itemWidth;
        if (Math.abs(x.get() - target) > 1) {
          animate(x, target, { 
            type: 'spring', 
            stiffness: 300, 
            damping: 30,
            restDelta: 0.01
          });
        }
      }
    }
  }, [selectedServer, servers, x, isInteracting]);

  const handleDragStart = () => setIsInteracting(true);

  const handleDragEnd = (_: any, info: any) => {
    const currentX = x.get();
    const predictedX = currentX + info.velocity.x * 0.15;
    const index = Math.round(Math.abs(predictedX) / itemWidth);
    const safeIndex = Math.max(0, Math.min(servers.length - 1, index));
    
    onSelect(servers[safeIndex].server_name);
    
    // Delay setting isInteracting to false to allow the useEffect to catch up
    setTimeout(() => setIsInteracting(false), 50);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();
      setIsInteracting(true);
      
      const currentX = x.get();
      const newX = currentX - e.deltaY;
      const clampedX = Math.min(constraints.right, Math.max(constraints.left, newX));
      
      // Use a fast tween for immediate following of the wheel
      animate(x, clampedX, {
        type: 'tween',
        ease: 'easeOut',
        duration: 0.1
      });
      
      // Debounced snap
      const timeoutId = (window as any)._wheelTimeout;
      if (timeoutId) clearTimeout(timeoutId);
      (window as any)._wheelTimeout = setTimeout(() => {
        const index = Math.round(Math.abs(x.get()) / itemWidth);
        const safeIndex = Math.max(0, Math.min(servers.length - 1, index));
        const targetServer = servers[safeIndex].server_name;
        
        if (targetServer !== selectedServer) {
          onSelect(targetServer);
        }
        setIsInteracting(false);
      }, 200);
    };

    container.addEventListener('wheel', handleWheelRaw, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelRaw);
  }, [constraints, servers, x, onSelect, selectedServer]);

  const activeServerData = useMemo(() => 
    servers.find(s => s.server_name === selectedServer) || servers[0],
  [servers, selectedServer]);

  const activeIndex = useMemo(() => 
    servers.findIndex(s => s.server_name === (selectedServer || servers[0]?.server_name)),
  [servers, selectedServer]);

  const navigate = (dir: 'prev' | 'next') => {
    let newIndex = activeIndex;
    if (dir === 'prev') newIndex = Math.max(0, activeIndex - 1);
    else newIndex = Math.min(servers.length - 1, activeIndex + 1);
    
    if (newIndex !== activeIndex) {
      onSelect(servers[newIndex].server_name);
    }
  };

  if (servers.length === 0) return (
    <div className="h-48 flex items-center justify-center bg-cyber-black/40 border-y border-white/5">
      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">No Neural Links Established</div>
    </div>
  );

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-48 flex items-center overflow-hidden bg-cyber-black/40 border-y border-white/5 group"
    >
      {/* Mechanical Accents */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-cyber-black via-cyber-black/80 to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-cyber-black via-cyber-black/80 to-transparent z-20 pointer-events-none" />
      
      {/* Center Highlight */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex items-center gap-12 -translate-y-3">
          <NavArrow 
            direction="left" 
            onClick={() => navigate('prev')} 
            disabled={activeIndex === 0}
            className="pointer-events-auto"
          />
          
          <div className="relative w-48 h-36">
            {/* Main Frame */}
            <div className="absolute inset-0 border border-neon-cyan/30 bg-neon-cyan/5 backdrop-blur-[6px] rounded-2xl shadow-[inset_0_0_20px_rgba(0,243,255,0.1)]" />
            
            {/* Animated Scanning Line */}
            <motion.div 
              animate={{ top: ['5%', '65%', '5%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute left-2 right-2 h-[1px] bg-neon-cyan/40 shadow-[0_0_10px_#00f3ff] z-20"
            />

            {/* Server Info Display (Inside Box) */}
            <div className="absolute bottom-3 left-0 right-0 text-center z-30 px-2">
              <motion.div 
                key={activeServerData?.server_name}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="text-[11px] font-black text-white italic tracking-tighter uppercase truncate w-full shadow-black drop-shadow-md">
                  {activeServerData?.server_name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-[7px] font-black text-neon-cyan uppercase tracking-[0.3em]">
                    {activeServerData?.game_type}
                  </div>
                  <div className="w-1 h-1 bg-white/20 rounded-full" />
                  <div className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">
                    LINK #{String(activeIndex + 1).padStart(2, '0')}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan rounded-br-lg" />

            {/* Vertical Lock Indicators */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <div className="w-[2px] h-4 bg-neon-cyan/40 shadow-[0_0_15px_#00f3ff]" />
              <div className="w-1 h-1 bg-neon-cyan rounded-full animate-pulse" />
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <div className="w-1 h-1 bg-neon-cyan rounded-full animate-pulse" />
              <div className="w-[2px] h-4 bg-neon-cyan/40 shadow-[0_0_15px_#00f3ff]" />
            </div>
          </div>

          <NavArrow 
            direction="right" 
            onClick={() => navigate('next')} 
            disabled={activeIndex === servers.length - 1}
            className="pointer-events-auto"
          />
        </div>
      </div>

      <motion.div 
        style={{ x }}
        className="flex items-center gap-0 px-[calc(50%-90px)] cursor-pointer h-full"
        drag="x"
        dragConstraints={constraints}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {servers.map((s, i) => {
          const isActive = selectedServer === s.server_name || (!selectedServer && i === 0);
          return (
            <motion.button
              key={s.server_name}
              onClick={() => onSelect(s.server_name)}
              whileHover={{ scale: 1.05 }}
              animate={{
                scale: isActive ? 1.1 : 0.6,
                opacity: isActive ? 1 : 0.15,
                filter: isActive ? 'blur(0px)' : 'blur(3px)',
                y: isActive ? -12 : 0 // Lift active icon to center in box with text below
              }}
              className="flex flex-col items-center justify-center shrink-0 transition-all w-[180px] h-full"
            >
              <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-neon-cyan/20 border-neon-cyan shadow-[0_0_40px_rgba(0,243,255,0.3)]' : 'bg-white/5 border-white/10'}`}>
                <Server className={`w-10 h-10 ${isActive ? 'text-neon-cyan' : 'text-zinc-800'}`} />
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default function ProfilePage() {
  const { id } = useParams();
  const { user: currentUser, isLoading: authLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  const userId = id || currentUser?.id;

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['profile', userId],
    queryFn: () => fetch(`/api/users/${userId}`).then(res => res.json()),
    enabled: !!userId
  });

  const { data: gameStatsData } = useQuery<any[]>({
    queryKey: ['gameStats', userId],
    queryFn: () => fetch(`/api/users/${userId}/game-stats`).then(res => res.json()),
    enabled: !!userId
  });

  const { data: transactionsData } = useQuery<any[]>({
    queryKey: ['gameTransactions', userId],
    queryFn: () => fetch(`/api/users/${userId}/game-transactions`).then(res => res.json()),
    enabled: !!userId
  });

  const { data: matchesData } = useQuery<any[]>({
    queryKey: ['gameMatches', userId],
    queryFn: () => fetch(`/api/users/${userId}/game-matches`).then(res => res.json()),
    enabled: !!userId
  });

  const { data: leaderboardData } = useQuery<any[]>({
    queryKey: ['wealthLeaderboard'],
    queryFn: () => fetch('/api/leaderboards/wealth').then(res => res.json())
  });

  // Ensure data is always an array for rendering
  const gameStats = Array.isArray(gameStatsData) ? gameStatsData : [];
  const transactions = Array.isArray(transactionsData) ? transactionsData : [];
  const matches = Array.isArray(matchesData) ? matchesData : [];
  const leaderboard = Array.isArray(leaderboardData) ? leaderboardData : [];

  // Default selected server to the first one available
  useEffect(() => {
    if (!selectedServer && gameStats.length > 0) {
      setSelectedServer(gameStats[0].server_name);
    }
  }, [gameStats, selectedServer]);

  const activeStats = gameStats.find(s => s.server_name === selectedServer) || gameStats[0];

  const filteredTransactions = transactions.filter(t => 
    t.server_name === (selectedServer || gameStats[0]?.server_name)
  );

  const filteredMatches = matches.filter(m => 
    m.server_name === (selectedServer || gameStats[0]?.server_name)
  );

  // Calculate wealth trend from transactions
  const wealthTrend = useMemo(() => {
    if (!activeStats) return [];
    
    let currentWealth = activeStats.total_wealth;
    const trend = [{ name: 'Now', value: currentWealth }];
    
    // Sort transactions by date descending
    const sortedTs = [...filteredTransactions].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const t of sortedTs) {
      if (t.type === 'income') {
        currentWealth -= t.amount;
      } else {
        currentWealth += t.amount;
      }
      trend.unshift({ 
        name: new Date(t.created_at).toLocaleDateString(), 
        value: currentWealth 
      });
    }
    
    // If we have very few points, pad it
    while (trend.length < 7) {
      trend.unshift({ name: 'Prev', value: trend[0]?.value || 0 });
    }
    
    return trend.slice(-7); // Last 7 points
  }, [activeStats, filteredTransactions]);

  const updateMutation = useMutation({
    mutationFn: (updates: { avatar_url?: string; banner_url?: string; bio?: string }) =>
      fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      if (updateProfile) updateProfile(data.user);
      setIsEditing(false);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateMutation.mutate({ avatar_url: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateMutation.mutate({ banner_url: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  if (authLoading || profileLoading) return <div className="animate-pulse space-y-8"><div className="h-48 bg-white/5 rounded-3xl" /><div className="grid grid-cols-1 md:grid-cols-3 gap-8"><div className="h-64 bg-white/5 rounded-2xl" /><div className="md:col-span-2 h-64 bg-white/5 rounded-2xl" /></div></div>;
  
  if (!userId && !authLoading) return <Navigate to="/login" />;
  if (!profile) return <div className="text-center py-20 text-zinc-500">User not found</div>;

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Profile Header */}
      <section className="relative p-8 cyber-card border-neon-cyan/20 overflow-hidden min-h-[280px] flex items-end">
        {/* Banner Image */}
        <div className="absolute inset-0 z-0">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyber-black via-cyber-dark to-cyber-bg opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-transparent to-transparent" />
          
          {isOwnProfile && (
            <button 
              onClick={() => bannerInputRef.current?.click()}
              className="absolute top-4 right-4 p-2 bg-cyber-black/60 border border-white/10 rounded-lg text-white/40 hover:text-neon-cyan hover:border-neon-cyan/50 transition-all z-20"
              title="Change Banner"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
          <input 
            type="file" 
            ref={bannerInputRef} 
            onChange={handleBannerChange} 
            className="hidden" 
            accept="image/*"
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-8 w-full">
          <div className="relative group">
            <div className="w-36 h-36 rounded-3xl bg-cyber-black border-2 border-neon-cyan/50 flex items-center justify-center text-5xl font-black text-white shadow-[0_0_40px_rgba(0,243,255,0.3)] overflow-hidden relative">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <span className="relative z-10">{profile.username.charAt(0).toUpperCase()}</span>
              )}
              {/* Decorative Frame */}
              <div className="absolute inset-2 border border-white/5 rounded-2xl pointer-events-none" />
            </div>
            {isOwnProfile && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-cyber-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-neon-cyan rounded-3xl z-20"
              >
                <Camera className="w-10 h-10 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Update Scan</span>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-neon-green rounded-full border-4 border-cyber-dark shadow-[0_0_30px_#39ff14] z-30 animate-pulse" />
          </div>
          
          <div className="flex-1 text-center md:text-left pb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none neon-glow-white">
                {profile.username}
              </h1>
              <div className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] font-black px-4 py-1.5 rounded-lg self-center md:self-auto border translate-y-1 ${
                profile.role === 'admin' ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/30 shadow-[0_0_15px_rgba(255,0,255,0.2)]' :
                profile.role === 'moderator' ? 'bg-neon-green/10 text-neon-green border-neon-green/30 shadow-[0_0_15px_rgba(57,255,20,0.2)]' :
                'bg-white/5 text-zinc-500 border-white/10'
              }`}>
                {profile.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                {profile.role === 'moderator' && <Award className="w-3 h-3" />}
                {profile.role}
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-6 text-[10px] uppercase tracking-[0.3em] font-black text-zinc-500 mb-6">
              <div className="flex items-center gap-2 group">
                <Calendar className="w-4 h-4 text-neon-cyan/50 group-hover:text-neon-cyan transition-colors" />
                <span className="text-zinc-600">Uplinked:</span> <span className="text-zinc-300 font-mono">{new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 group">
                <Clock className="w-4 h-4 text-neon-pink/50 group-hover:text-neon-pink transition-colors" />
                <span className="text-zinc-600">Last Scan:</span> <span className="text-zinc-300 font-mono">{new Date(profile.last_active).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 group">
                <MapPin className="w-4 h-4 text-neon-green/50 group-hover:text-neon-green transition-colors" />
                <span className="text-zinc-600">Sector:</span> <span className="text-zinc-300">Global</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {[
                { icon: SteamIcon, color: 'hover:text-white', label: 'Steam' },
                { icon: XIcon, color: 'hover:text-white', label: 'X' },
                { icon: Facebook, color: 'hover:text-[#1877F2]', label: 'Facebook' },
                { icon: Github, color: 'hover:text-white', label: 'GitHub' },
                { icon: Youtube, color: 'hover:text-[#FF0000]', label: 'YouTube' },
                { icon: KickIcon, color: 'hover:text-[#53FC18]', label: 'Kick' },
                { icon: Twitch, color: 'hover:text-[#9146FF]', label: 'Twitch' },
                { icon: DiscordIcon, color: 'hover:text-[#5865F2]', label: 'Discord', link: 'https://discord.gg/NZbmQNxX' },
              ].map((social, i) => (
                <button 
                  key={i}
                  onClick={() => social.link ? window.open(social.link, '_blank') : null}
                  className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 transition-all duration-500 ${social.color} hover:bg-white/10 hover:border-white/20 hover:scale-110 active:scale-95 group relative`}
                  title={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          {isOwnProfile ? (
            <div className="absolute bottom-4 right-8">
              <button 
                onClick={() => {
                  setIsEditing(!isEditing);
                  setEditBio(profile.bio || '');
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-500 relative group overflow-hidden shrink-0 ${
                  isEditing 
                    ? 'btn-neon-magenta text-[10px]' 
                    : 'btn-neon-cyan text-[10px]'
                }`}
              >
                {isEditing ? (
                  <>
                    <X className="w-4 h-4 group-hover:animate-pulse" />
                    <span className="glitch-text" data-text="Abort Sync">Abort Sync</span>
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                    <span className="glitch-text" data-text="Modify Data">Modify Data</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="absolute bottom-4 right-8">
              <button 
                onClick={() => navigate(`/messages?user=${profile.id}`)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl btn-neon-cyan text-[10px] group overflow-hidden shrink-0"
              >
                <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="glitch-text" data-text="Send Message">Send Message</span>
              </button>
            </div>
          )}
        </div>

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </section>

      <div className="cyber-card p-10">
        <h3 className="text-2xl font-black text-white mb-8 italic tracking-tighter uppercase">Operative Dossier</h3>
        {isEditing ? (
          <div className="space-y-6">
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Input operative background data..."
              className="w-full h-48 bg-cyber-black border border-white/10 rounded-2xl p-6 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all resize-none font-medium"
            />
            <div className="flex justify-end gap-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="btn-holographic px-6 py-2 text-[10px]"
              >
                Abort
              </button>
              <button 
                onClick={() => updateMutation.mutate({ bio: editBio })}
                disabled={updateMutation.isPending}
                className={`btn-neon-cyan px-6 py-2 text-[10px] ${updateMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
              >
                {updateMutation.isPending ? 'Syncing...' : 'Update Dossier'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 leading-relaxed font-medium text-lg">
            {profile.bio || "No background data found for this operative. Likely deep cover."}
          </p>
        )}
      </div>

      <div className="cyber-card overflow-hidden">
        <div className="p-8 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
              <Server className="w-5 h-5 text-neon-cyan" />
              Neural Link: Game Servers
            </h3>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest font-black">Live Telemetry Feed</p>
          </div>
        </div>

        <div className="bg-cyber-black/5">
          <ServerWheel 
            servers={gameStats} 
            selectedServer={selectedServer} 
            onSelect={setSelectedServer} 
          />
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 space-y-8 border-r border-white/5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-cyan/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Clock className="w-3 h-3 text-neon-cyan/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Playtime</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono italic">
                    {activeStats?.playtime?.toFixed(1)}<span className="text-[10px] ml-1 text-zinc-600">HRS</span>
                  </div>
                </div>
                
                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-pink/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Wallet className="w-3 h-3 text-neon-pink/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Total Wealth</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono italic">
                    <span className="text-neon-pink mr-1">$</span>{activeStats?.total_wealth?.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-green/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Target className="w-3 h-3 text-neon-green/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Kills</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono italic">
                    {activeStats?.kills}
                  </div>
                </div>

                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-cyan/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Activity className="w-3 h-3 text-neon-cyan/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">K/D Ratio</span>
                  </div>
                  <div className="text-xl font-black text-neon-cyan font-mono italic">
                    {activeStats?.kd_ratio?.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-pink/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Car className="w-3 h-3 text-neon-pink/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Vehicles</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono italic">
                    {activeStats?.vehicles_owned || 0}
                  </div>
                </div>

                <div className="p-4 bg-cyber-black/40 border border-white/5 rounded-2xl group hover:border-neon-green/30 transition-colors">
                  <div className="flex items-center gap-2 text-zinc-500 mb-2">
                    <Zap className="w-3 h-3 text-neon-green/50" />
                    <span className="text-[7px] font-black uppercase tracking-widest">Raids</span>
                  </div>
                  <div className="text-xl font-black text-white font-mono italic">
                    {activeStats?.raids_completed || 0}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Wipe Performance</span>
                    <span className="text-[10px] font-black text-neon-cyan uppercase tracking-widest">{(activeStats?.wipe_performance * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-cyber-black rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(activeStats?.wipe_performance || 0) * 100}%` }}
                      className="h-full bg-gradient-to-r from-neon-cyan to-neon-pink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-cyber-black/20 border border-white/5 rounded-xl">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Bank Balance</span>
                    <span className="text-sm font-bold text-white font-mono">${activeStats?.bank_balance?.toLocaleString()}</span>
                  </div>
                  <div className="p-4 bg-cyber-black/20 border border-white/5 rounded-xl">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Cash on Hand</span>
                    <span className="text-sm font-bold text-white font-mono">${activeStats?.cash_on_hand?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-cyber-black/20 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Wealth Accumulation Index</h4>
                <TrendingUp className="w-4 h-4 text-neon-cyan" />
              </div>
              
              <div className="flex-1 min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={wealthTrend}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#444" 
                      fontSize={8} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: '#666', fontWeight: 'bold' }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Wealth']}
                      contentStyle={{ 
                        backgroundColor: '#0a0a0a', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}
                      itemStyle={{ color: '#00f3ff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#00f3ff" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      animationDuration={2000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                <span>Last Sync: {activeStats ? new Date(activeStats.last_updated).toLocaleTimeString() : 'N/A'}</span>
                <span className="text-neon-green flex items-center gap-2">
                  <div className="w-1 h-1 bg-neon-green rounded-full animate-ping" />
                  Encrypted Connection
                </span>
              </div>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Transaction Log */}
        <div className="cyber-card overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <History className="w-4 h-4 text-neon-pink" />
              Financial Ledger
            </h3>
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">30-Day Log</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-cyber-black/20">
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Timestamp</th>
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Description</th>
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-[10px] font-mono text-zinc-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{t.description}</td>
                    <td className={`p-4 text-[10px] font-black font-mono text-right ${t.type === 'income' ? 'text-neon-green' : 'text-neon-pink'}`}>
                      {t.type === 'income' ? <ArrowUpRight className="w-3 h-3 inline mr-1" /> : <ArrowDownLeft className="w-3 h-3 inline mr-1" />}
                      ${t.amount.toLocaleString()}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-[10px] text-zinc-600 uppercase font-black">No recent transactions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Match History */}
        <div className="cyber-card overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Trophy className="w-4 h-4 text-neon-cyan" />
              Combat Archives
            </h3>
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Recent Engagements</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-cyber-black/20">
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Map / Sector</th>
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest">Result</th>
                  <th className="p-4 text-[8px] font-black text-zinc-600 uppercase tracking-widest text-right">K/D/S</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredMatches.length > 0 ? filteredMatches.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="text-[10px] font-black text-white uppercase tracking-wider">{m.map_name}</div>
                      <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{new Date(m.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded border ${
                        m.result === 'victory' || m.result === 'survived' 
                          ? 'bg-neon-green/10 text-neon-green border-neon-green/30' 
                          : 'bg-neon-pink/10 text-neon-pink border-neon-pink/30'
                      }`}>
                        {m.result}
                      </span>
                    </td>
                    <td className="p-4 text-[10px] font-black font-mono text-right text-zinc-400">
                      {m.kills} / {m.deaths} / {m.score}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-[10px] text-zinc-600 uppercase font-black">No recent engagements</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="cyber-card p-8">
            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-8">System Metrics</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 text-zinc-500">
                  <MessageSquare className="w-4 h-4 text-neon-cyan/50" />
                  <span className="text-[10px] uppercase tracking-widest font-black">Data Transmissions</span>
                </div>
                <span className="text-white font-mono font-bold">124</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 text-zinc-500">
                  <Award className="w-4 h-4 text-neon-pink/50" />
                  <span className="text-[10px] uppercase tracking-widest font-black">Reputation Score</span>
                </div>
                <span className="text-neon-green font-mono font-bold">2,450</span>
              </div>
            </div>
          </div>

          <div className="cyber-card p-8">
            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-8">Achievement Chips</h3>
            <div className="flex flex-wrap gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyber-black border border-neon-cyan/30 flex items-center justify-center text-neon-cyan shadow-[0_0_10px_rgba(0,243,255,0.1)]" title="Early Adopter">
                <Award className="w-6 h-6" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyber-black border border-neon-green/30 flex items-center justify-center text-neon-green shadow-[0_0_10px_rgba(57,255,20,0.1)]" title="Top Contributor">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="cyber-card p-8">
            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-8">Top Richest Players</h3>
            <div className="space-y-4">
              {leaderboard.map((player, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyber-black border border-white/10 overflow-hidden flex items-center justify-center text-[10px] font-black text-white group-hover:border-neon-cyan/50 transition-colors">
                      {player.avatar_url ? (
                        <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                      ) : (
                        player.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-white uppercase tracking-wider">{player.username}</div>
                      <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Rank #{i + 1}</div>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-neon-green font-mono italic">
                    ${player.total_wealth.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white px-4 italic tracking-tighter uppercase">Recent Network Activity</h3>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex items-start gap-6 group hover:bg-neon-cyan/[0.02] transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-neon-cyan/30 transition-colors">
                    <MessageSquare className="w-6 h-6 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                  </div>
                  <div>
                    <p className="text-zinc-300 font-bold text-lg">
                      Transmitted data to <span className="text-white italic">What are you playing this weekend?</span>
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-[0.2em] font-black font-mono">
                      {i * 2}h // Sector_Forums
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
