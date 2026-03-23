import React, { useState, useRef, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import NotificationDropdown from '../components/NotificationDropdown';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  MessageSquare, 
  Search, 
  Bell, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  ShieldCheck,
  Menu,
  X,
  Gamepad2,
  Server,
  Activity,
  Zap,
  Cpu,
  Globe,
  Monitor,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GlobeIcon = Globe;

type SidebarServer = {
  id: number;
  name: string;
  players_current: number;
  players: number;
  status: 'online' | 'offline';
  map: string;
};

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.27 4.57c-1.3-.6-2.7-1.04-4.19-1.3-.17.3-.37.63-.5.94-1.58-.24-3.15-.24-4.7 0-.13-.31-.33-.64-.5-.94-1.49.26-2.89.7-4.19 1.3C2.56 8.53 1.64 12.39 2.02 16.23c1.79 1.32 3.53 2.12 5.24 2.65.42-.58.8-1.21 1.12-1.88-.62-.23-1.21-.53-1.77-.88.15-.11.29-.22.43-.34 3.42 1.58 7.13 1.58 10.5 0 .14.12.28.23.43.34-.56.35-1.15.65-1.77.88.32.67.7 1.3 1.12 1.88 1.71-.53 3.45-1.33 5.24-2.65.46-4.4-.7-8.22-3.04-11.66zM8.47 13.42c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03-.02 1.12-.8 2.03-1.81 2.03zm7.06 0c-.99 0-1.81-.91-1.81-2.03s.8-2.03 1.81-2.03c1.02 0 1.83.91 1.81 2.03 0 1.12-.8 2.03-1.81 2.03z"/>
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const SteamIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 0a12 12 0 0 0-11.979 11.037l6.432 2.619a3.15 3.15 0 0 1 1.544-.491c.13 0 .257.01.381.028l2.847-4.142c-.03-.129-.048-.264-.048-.403 0-1.833 1.488-3.321 3.321-3.321S17.821 7.155 17.821 8.988s-1.488 3.321-3.321 3.321c-.14 0-.274-.017-.403-.048l-4.142 2.847c.018.124.028.251.028.381 0 1.833-1.488 3.321-3.321 3.321-.464 0-.887-.174-1.211-.459l-3.058.801c.08.243.18.472.299.688l1.817 4.461A12 12 0 1 0 12 0zm-1.066 14.896c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797zm4.074-5.464c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
);

const ServerStatus: React.FC<{ name: string; players: string; map: string; status: 'online' | 'offline'; color: string }> = ({ name, players, map, status, color }) => (
  <div className="group relative p-3 bg-cyber-black/40 border border-white/5 rounded-xl hover:border-neon-cyan/30 transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full animate-pulse ${status === 'online' ? 'bg-neon-green shadow-[0_0_8px_#39ff14]' : 'bg-red-500'}`} />
        <span className="text-[10px] uppercase tracking-tighter font-bold text-zinc-400 group-hover:text-white transition-colors">{name}</span>
      </div>
      <span className="text-[10px] font-mono text-neon-cyan">{players}</span>
    </div>
    <div className="flex items-center justify-between text-[8px] uppercase tracking-widest text-zinc-600">
      <span>{map}</span>
      <div className={`h-[1px] flex-1 mx-2 bg-gradient-to-r from-transparent via-${color}/20 to-transparent`} />
      <Activity className="w-2 h-2" />
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ['site-settings'],
    queryFn: () => fetch('/api/settings').then(res => res.json())
  });

  const { data: sidebarServers = [] } = useQuery<SidebarServer[]>({
    queryKey: ['servers'],
    refetchInterval: 10000,
    queryFn: async () => {
      const response = await fetch('/api/servers');
      if (!response.ok) {
        throw new Error('Failed to load server status');
      }
      return response.json();
    }
  });

  const activeUplinkPlayers = sidebarServers.reduce((sum, server) => sum + (server.players || 0), 0);
  const onlineNodes = sidebarServers.filter(server => server.status === 'online').length;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (centerY - y) / 5;
    const rotateY = (x - centerX) / 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    cardRef.current.style.transition = 'all 0.5s ease';
  };

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = 'none';
  };

  const discordLink = "https://discord.gg/NZbmQNxX";

  const navItems = [
    { label: 'Forums', path: '/', icon: MessageSquare },
    { label: 'Servers', path: '/servers', icon: Server },
    { label: 'Members', path: '/members', icon: Users },
    { label: 'Store', path: '/store', icon: ShoppingBag },
    { label: 'Support', path: '/support', icon: Ticket },
    { label: 'Discord', path: '/discord', icon: Gamepad2 },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen text-zinc-300 font-sans selection:bg-neon-cyan/30 selection:text-neon-cyan overflow-x-hidden relative">
      {/* Atmospheric Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-purple/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-cyan/20 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-neon-magenta/20 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
          >
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setIsSearchOpen(false)} />
            
            <motion.div
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              className="w-full max-w-2xl bg-cyber-dark border border-neon-cyan/20 rounded-2xl shadow-[0_0_50px_rgba(0,243,255,0.1)] overflow-hidden relative z-10"
            >
              <div className="p-6 border-b border-white/5 flex items-center gap-4">
                <Search className="w-6 h-6 text-neon-cyan" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search forums, members, or news..."
                  className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder:text-zinc-600 font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4">
                {searchQuery ? (
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2">Results for "{searchQuery}"</p>
                    <div className="grid gap-2">
                      {/* Mock Search Results */}
                      {[
                        { title: 'Cyberpunk 2077 Modding Guide', category: 'General Discussion', icon: Cpu },
                        { title: 'New Member: GhostInTheShell', category: 'Members', icon: Users },
                        { title: 'Neon District Store Update', category: 'Store', icon: ShoppingBag },
                        { title: 'Server Maintenance Schedule', category: 'Announcements', icon: Activity }
                      ].filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())).map((item, i) => (
                        <button 
                          key={i}
                          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-all group text-left"
                        >
                          <div className="w-10 h-10 rounded-lg bg-cyber-black flex items-center justify-center border border-white/5 group-hover:border-neon-cyan/30 transition-colors">
                            <item.icon className="w-5 h-5 text-neon-cyan" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">{item.title}</h4>
                            <p className="text-xs text-zinc-500">{item.category}</p>
                          </div>
                        </button>
                      ))}
                      {searchQuery.length > 0 && [
                        { title: 'Cyberpunk 2077 Modding Guide', category: 'General Discussion', icon: Cpu },
                        { title: 'New Member: GhostInTheShell', category: 'Members', icon: Users },
                        { title: 'Neon District Store Update', category: 'Store', icon: ShoppingBag },
                        { title: 'Server Maintenance Schedule', category: 'Announcements', icon: Activity }
                      ].filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div className="py-12 text-center">
                          <Search className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                          <p className="text-zinc-500">No results found for your query.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 py-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2 mb-4">Quick Links</p>
                      <div className="grid grid-cols-2 gap-2">
                        {navItems.map((item) => (
                          <button 
                            key={item.path}
                            onClick={() => {
                              navigate(item.path);
                              setIsSearchOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                          >
                            <item.icon className="w-4 h-4 text-zinc-400 group-hover:text-neon-cyan" />
                            <span className="text-sm text-zinc-400 group-hover:text-white">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2 mb-4">Recent Searches</p>
                      <div className="flex flex-wrap gap-2 px-2">
                        {['Modding', 'Hardware', 'Events', 'Rules'].map(tag => (
                          <button 
                            key={tag}
                            onClick={() => setSearchQuery(tag)}
                            className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-zinc-400 hover:text-neon-cyan hover:border-neon-cyan/30 transition-all"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-cyber-black/50 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><kbd className="bg-cyber-dark px-1.5 py-0.5 rounded border border-white/10 text-white">ESC</kbd> to close</span>
                  <span className="flex items-center gap-1"><kbd className="bg-cyber-dark px-1.5 py-0.5 rounded border border-white/10 text-white">↵</kbd> to select</span>
                </div>
                <span className="text-neon-cyan/50">NightRespawn Search Engine v2.4</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="scanline" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cyber-bg/90 backdrop-blur-xl border-b border-neon-cyan/20 shadow-[0_0_20px_rgba(0,243,255,0.15)]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="perspective-[1000px]">
              <div 
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="bg-cyber-dark/40 p-3 pr-8 pl-6 rounded-sm relative group transition-all duration-300 cursor-pointer hover:shadow-[0_0_20px_rgba(0,243,255,0.1)] border-t border-l border-neon-cyan/30 border-b border-r border-neon-magenta/30"
              >
                {/* Decorative Corners */}
                <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-neon-cyan z-20" />
                <div className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-neon-cyan z-20" />
                <div className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-neon-cyan z-20" />
                <div className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-neon-magenta z-20 shadow-[0_0_10px_rgba(255,0,255,0.5)]" />

                <Link to="/" className="flex items-center gap-4 relative z-10">
                  <div className="relative">
                    <div className="w-10 h-10 bg-cyber-dark border border-neon-cyan/50 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.2)] group-hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] transition-all duration-500 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 opacity-50" />
                      <img 
                        src="https://i.imgur.com/xuiV5kI.gif" 
                        alt="Logo" 
                        className="w-full h-full object-cover relative z-10"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span 
                      className="text-xl font-black tracking-tighter text-white uppercase italic leading-none neon-glow-cyan glitch-text relative"
                      data-text="NIGHTRESPAWN"
                    >
                      Night<span className="text-neon-cyan">Respawn</span>
                    </span>
                    <span className="text-[7px] uppercase tracking-[0.4em] text-neon-magenta font-black mt-1 opacity-80">
                      Digital Underground
                    </span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-6 py-2 text-xs uppercase tracking-[0.2em] font-bold transition-all duration-300 group ${
                    location.pathname === item.path
                      ? 'text-neon-cyan'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <span className="relative z-10">{item.label}</span>
                  {location.pathname === item.path && (
                    <motion.div 
                      layoutId="nav-glow"
                      className="absolute inset-0 bg-neon-cyan/5 blur-md rounded-lg"
                    />
                  )}
                  <div className={`absolute bottom-0 left-0 h-[2px] bg-neon-cyan transition-all duration-300 ${location.pathname === item.path ? 'w-full' : 'w-0 group-hover:w-1/2'}`} />
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-zinc-400 hover:text-neon-cyan transition-all duration-300 group relative"
              >
                <Search className="w-5 h-5 group-hover:scale-110" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-cyber-dark border border-white/10 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Search <kbd className="font-sans opacity-50">⌘K</kbd>
                </span>
              </button>

              {user && (
                <>
                  <Link 
                    to="/messages"
                    className="p-2 text-zinc-400 hover:text-neon-cyan transition-all duration-300 group relative"
                  >
                    <MessageSquare className="w-5 h-5 group-hover:scale-110" />
                  </Link>
                  <NotificationDropdown />
                </>
              )}
              
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-neon-cyan/20 transition-colors border border-transparent hover:border-neon-cyan/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold ring-2 ring-white/10 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isUserDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-2 w-64 bg-[#0a0a0c] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 overflow-hidden"
                        >
                          {/* Dropdown Header */}
                          <div className="p-5 border-b border-white/5 bg-gradient-to-br from-cyber-black to-cyber-dark/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                              <ShieldCheck className="w-12 h-12 text-neon-cyan" />
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-black ring-1 ring-white/20 shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-lg object-cover" />
                                ) : (
                                  user.username.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col">
                                <p className="text-xs font-black text-white uppercase tracking-widest italic leading-none">{user.username}</p>
                                <p className="text-[8px] text-zinc-500 truncate uppercase tracking-[0.2em] font-black mt-1.5">{user.email}</p>
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Body */}
                          <div className="p-2">
                            <Link 
                              to="/profile" 
                              onClick={() => setIsUserDropdownOpen(false)}
                              className="flex items-center justify-between px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <UserIcon className="w-3.5 h-3.5 text-neon-cyan group-hover:scale-110 transition-transform" />
                                <span>Profile</span>
                              </div>
                              <div className="w-1 h-1 bg-neon-cyan rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            
                            <Link 
                              to="/settings" 
                              onClick={() => setIsUserDropdownOpen(false)}
                              className="flex items-center justify-between px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <Settings className="w-3.5 h-3.5 text-neon-purple group-hover:scale-110 transition-transform" />
                                <span>Settings</span>
                              </div>
                              <div className="w-1 h-1 bg-neon-purple rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>

                            <Link 
                              to="/support" 
                              onClick={() => setIsUserDropdownOpen(false)}
                              className="flex items-center justify-between px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <Ticket className="w-3.5 h-3.5 text-neon-magenta group-hover:scale-110 transition-transform" />
                                <span>Support</span>
                              </div>
                              <div className="w-1 h-1 bg-neon-magenta rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>

                            {['admin', 'moderator'].includes(user.role) && (
                              <div className="mt-2 pt-2 border-t border-white/5">
                                <Link 
                                  to="/admin" 
                                  onClick={() => setIsUserDropdownOpen(false)}
                                  className="flex items-center justify-between px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-neon-green btn-admin-animated rounded-lg group"
                                >
                                  <div className="flex items-center gap-3 relative z-10">
                                    <ShieldCheck className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                    <span>Admin Panel</span>
                                  </div>
                                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse relative z-10" />
                                </Link>
                              </div>
                            )}
                          </div>

                          {/* Dropdown Footer */}
                          <div className="p-2 border-t border-white/5 bg-cyber-black/20">
                            <button 
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-lg transition-all group"
                            >
                              <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                              <span>Logout</span>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-holographic px-4 py-2 text-[10px]">
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-neon-cyan px-4 py-2 text-[10px]">
                    <span className="glitch-text" data-text="Join Now">Join Now</span>
                  </Link>
                </div>
              )}

              <button 
                className="md:hidden p-2 text-zinc-400 hover:text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-white/5 bg-[#0a0a0c] overflow-hidden"
            >
              <div className="px-4 py-6 space-y-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 text-lg font-medium text-zinc-400 hover:text-white"
                  >
                    <item.icon className="w-6 h-6" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Layout Grid */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar - Server Browser */}
          <aside className="hidden xl:block col-span-3 space-y-6 relative z-10">
            <div className="cyber-card p-6 border-neon-cyan/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black tracking-widest text-neon-cyan flex items-center gap-2 uppercase">
                  <Server className="w-4 h-4" />
                  NETWORK STATUS
                </h3>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-neon-cyan rounded-full animate-ping" />
                  <span className="text-[8px] font-mono text-neon-cyan/50 uppercase">Live</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-cyber-black/40 px-4 py-4">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">Network Stats</p>
                  <div className="mt-3 space-y-2 text-[10px] uppercase tracking-[0.15em]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Active Uplinks</span>
                      <span className="font-mono text-neon-cyan">{activeUplinkPlayers} PLAYERS</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Global Nodes</span>
                      <span className={onlineNodes > 0 ? 'font-mono text-neon-green' : 'font-mono text-red-400'}>
                        {onlineNodes > 0 ? `${onlineNodes} ONLINE` : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                </div>

                {sidebarServers.length > 0 ? (
                  sidebarServers.slice(0, 3).map((server) => (
                    <ServerStatus
                      key={server.id}
                      name={server.name}
                      players={`${server.players} PLAYERS`}
                      map={server.map || 'UNKNOWN'}
                      status={server.status}
                      color="neon-cyan"
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-cyber-black/40 px-4 py-5 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">No active nodes detected</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">No Servers Connected</p>
                    <p className="mt-2 text-[10px] text-zinc-600">Connect a game server to display live network status.</p>
                  </div>
                )}
              </div>

              <button className="w-full mt-6 btn-holographic py-2 text-[8px]" onClick={() => navigate('/servers')}>
                View All Servers
              </button>
            </div>

            <div className="cyber-card p-6 border-neon-pink/20">
              <h3 className="text-xs font-black tracking-widest text-neon-pink flex items-center gap-2 mb-6">
                <Zap className="w-4 h-4" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="p-3 bg-white/5 rounded-xl flex flex-col items-center gap-2 hover:bg-neon-pink/10 transition-all border border-transparent hover:border-neon-pink/30 group">
                  <ShoppingBag className="w-5 h-5 text-neon-pink group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] uppercase font-bold text-zinc-500 group-hover:text-white">Store</span>
                </button>
                <button 
                  onClick={() => window.open(discordLink, '_blank')}
                  className="p-3 bg-white/5 rounded-xl flex flex-col items-center gap-2 hover:bg-neon-cyan/10 transition-all border border-transparent hover:border-neon-cyan/30 group"
                >
                  <DiscordIcon />
                  <span className="text-[8px] uppercase font-bold text-zinc-500 group-hover:text-white">Discord</span>
                </button>
                <button className="p-3 bg-white/5 rounded-xl flex flex-col items-center gap-2 hover:bg-neon-green/10 transition-all border border-transparent hover:border-neon-green/30 group">
                  <Globe className="w-5 h-5 text-neon-green group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] uppercase font-bold text-zinc-500 group-hover:text-white">Vote</span>
                </button>
                <button className="p-3 bg-white/5 rounded-xl flex flex-col items-center gap-2 hover:bg-neon-purple/10 transition-all border border-transparent hover:border-neon-purple/30 group">
                  <Activity className="w-5 h-5 text-neon-purple group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] uppercase font-bold text-zinc-500 group-hover:text-white">Stats</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="col-span-12 xl:col-span-9 relative z-10">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neon-cyan/10 bg-cyber-bg py-20 mt-32 relative overflow-hidden z-10">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent" />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-cyber-dark border border-neon-cyan/30 rounded-lg flex items-center justify-center overflow-hidden">
                  <img 
                    src="https://i.imgur.com/xuiV5kI.gif" 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-2xl font-black tracking-tighter text-white uppercase italic neon-glow-cyan">Night<span className="text-neon-cyan">Respawn</span></span>
              </Link>
              <p className="text-zinc-500 max-w-sm leading-relaxed text-sm font-medium">
                The ultimate community platform for the digital underground. Fusing competitive gaming, survival, and creative empires into one living neon-lit universe.
              </p>
              <div className="flex gap-4 mt-8">
                <a 
                  href={siteSettings?.x_account_url || "https://x.com/NightRespawn"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-zinc-500 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all border border-white/5"
                >
                  <span className="sr-only">X</span>
                  <XIcon />
                </a>
                {[
                  { name: 'Discord', icon: DiscordIcon, link: discordLink },
                  { name: 'YouTube', icon: YoutubeIcon, link: null },
                  { name: 'Steam', icon: SteamIcon, link: null }
                ].map(social => (
                  <button 
                    key={social.name} 
                    onClick={() => social.link ? window.open(social.link, '_blank') : null}
                    className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-zinc-500 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all border border-white/5"
                  >
                    <span className="sr-only">{social.name}</span>
                    <social.icon />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-6">Community</h4>
              <ul className="space-y-4">
                <li><Link to="/" className="text-zinc-500 hover:text-white transition-colors">Forums</Link></li>
                <li><Link to="/members" className="text-zinc-500 hover:text-white transition-colors">Members</Link></li>
                <li><Link to="/discord" className="text-zinc-500 hover:text-white transition-colors">Discord</Link></li>
                <li><Link to="/servers" className="text-zinc-500 hover:text-white transition-colors">Servers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-6">Support</h4>
              <ul className="space-y-4">
                <li><Link to="/help" className="text-zinc-500 hover:text-white transition-colors">Help Center</Link></li>
                <li><Link to="/rules" className="text-zinc-500 hover:text-white transition-colors">Rules</Link></li>
                <li><Link to="/contact" className="text-zinc-500 hover:text-white transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-600 text-sm">
              &copy; {new Date().getFullYear()} NightRespawn. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-zinc-600 hover:text-white text-sm">Privacy Policy</Link>
              <Link to="/terms" className="text-zinc-600 hover:text-white text-sm">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
