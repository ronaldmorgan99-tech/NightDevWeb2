import React from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  ShieldAlert, 
  FolderTree, 
  Tags, 
  ShoppingBag, 
  Share2, 
  BarChart3, 
  Ticket, 
  Settings,
  ArrowLeft,
  Gamepad2
} from 'lucide-react';

const AdminLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-neon-cyan font-mono animate-pulse">INITIALIZING_ADMIN_UPLINK...</div>;
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return <Navigate to="/" replace />;
  }

  const menuItems = [
    { label: 'Command Center', path: '/admin', icon: LayoutDashboard },
    { label: 'Operatives', path: '/admin/users', icon: Users, roles: ['admin'] },
    { label: 'Enforcement', path: '/admin/moderation', icon: ShieldAlert },
    { label: 'Sectors', path: '/admin/forums', icon: FolderTree, roles: ['admin'] },
    { label: 'Data Tags', path: '/admin/tags', icon: Tags, roles: ['admin'] },
    { label: 'Black Market', path: '/admin/store', icon: ShoppingBag, roles: ['admin'] },
    { label: 'Uplinks', path: '/admin/integrations', icon: Share2, roles: ['admin'] },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3, roles: ['admin'] },
    { label: 'Support Tickets', path: '/admin/support', icon: Ticket },
    { label: 'Core Settings', path: '/admin/settings', icon: Settings, roles: ['admin'] },
  ];

  return (
    <div className="min-h-screen text-zinc-100 font-sans flex">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-cyber-dark flex flex-col sticky top-0 h-screen">
        <div className="p-8 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-cyber-black border border-neon-cyan/50 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.2)]">
              <Gamepad2 className="w-6 h-6 text-neon-cyan" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">Admin</span>
              <span className="text-[8px] font-black tracking-[0.3em] text-neon-cyan uppercase">Command Center</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-2">
          {menuItems.map((item) => {
            if (item.roles && !item.roles.includes(user.role)) return null;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  isActive
                    ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-[0_0_20px_rgba(0,243,255,0.1)]'
                    : 'text-zinc-500 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-neon-cyan neon-glow-cyan' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/5">
          <Link 
            to="/" 
            className="flex items-center gap-4 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-neon-pink hover:bg-neon-pink/5 transition-all border border-transparent hover:border-neon-pink/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Terminal
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="p-12 max-w-7xl mx-auto relative z-10">
          <Outlet />
        </div>
        
        {/* Background Scanlines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </main>
    </div>
  );
};

export default AdminLayout;
