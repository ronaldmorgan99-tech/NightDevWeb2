import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';
import { useMutation } from '@tanstack/react-query';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Bell, 
  Eye, 
  EyeOff, 
  Save, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Camera,
  Smartphone,
  Globe,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'security' | 'notifications'>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || ''
      }));
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (updates: any) => apiJson<{ user: any }>('/api/auth/me', {
      method: 'PATCH',
      json: updates
    }),
    onSuccess: (data) => {
      if (updateProfile) updateProfile(data.user);
      setSuccessMessage('System protocols updated successfully');
      setErrorMessage(null);
      // Clear password fields after successful update
      if (formData.newPassword) {
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      }
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      setErrorMessage(error.message);
      setSuccessMessage(null);
      setTimeout(() => setErrorMessage(null), 5000);
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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      username: formData.username,
      email: formData.email,
      bio: formData.bio
    });
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      setErrorMessage('Password mismatch detected');
      return;
    }
    updateMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });
  };

  const tabs = [
    { id: 'profile', label: 'Operative Profile', icon: User },
    { id: 'account', label: 'Account Uplink', icon: Mail },
    { id: 'security', label: 'Security Protocols', icon: Shield },
    { id: 'notifications', label: 'Neural Alerts', icon: Bell },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">System <span className="text-neon-cyan neon-glow-cyan">Settings</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Configuration // Operative Identity Management</p>
        </div>
        
        <AnimatePresence>
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 px-4 py-2 bg-neon-green/10 border border-neon-green/30 rounded-xl text-neon-green text-[10px] font-black uppercase tracking-widest"
            >
              <CheckCircle2 className="w-4 h-4" /> {successMessage}
            </motion.div>
          )}
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 px-4 py-2 bg-neon-pink/10 border border-neon-pink/30 rounded-xl text-neon-pink text-[10px] font-black uppercase tracking-widest"
            >
              <AlertCircle className="w-4 h-4" /> {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="col-span-12 lg:col-span-3 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all group ${
                activeTab === tab.id 
                  ? 'bg-neon-cyan/5 border-neon-cyan/30 text-white' 
                  : 'bg-white/2 border-white/5 text-zinc-500 hover:border-white/10 hover:text-zinc-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? 'text-neon-cyan' : 'group-hover:text-neon-cyan'}`} />
              <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${activeTab === tab.id ? 'translate-x-1 opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="col-span-12 lg:col-span-9">
          <div className="cyber-card p-8 lg:p-12 border-white/5 bg-white/[0.01]">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-10">
                <div className="flex flex-col md:flex-row gap-10 items-start">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-3xl bg-cyber-black border-2 border-white/10 flex items-center justify-center text-4xl font-black text-white shadow-2xl overflow-hidden group-hover:border-neon-cyan/50 transition-all">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        user?.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-cyber-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-neon-cyan rounded-3xl"
                    >
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Update</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-6 w-full">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <User className="w-3 h-3" /> Operative Alias
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Monitor className="w-3 h-3" /> System Bio
                      </label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows={4}
                        placeholder="Enter operative background data..."
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                  <button 
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-8 py-3 bg-neon-cyan text-cyber-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {updateMutation.isPending ? 'Syncing...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'account' && (
              <form onSubmit={handleSaveProfile} className="space-y-8">
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center text-neon-cyan">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Email Address</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Primary communication uplink</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email address"
                      className="flex-1 bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-neon-cyan text-cyber-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> {updateMutation.isPending ? 'Updating...' : 'Update Email'}
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center text-neon-magenta">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Two-Factor Authentication</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Enhanced security layer</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Protect your account with an additional verification step.</p>
                    <button className="px-6 py-2 bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-magenta hover:text-white transition-all">
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handleSaveSecurity} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-neon-cyan transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3 h-3" /> New Password
                      </label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" /> Confirm Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                  <button 
                    type="submit"
                    disabled={updateMutation.isPending || !formData.newPassword}
                    className="flex items-center gap-2 px-8 py-3 bg-neon-magenta text-white rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,0,255,0.2)] disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" /> {updateMutation.isPending ? 'Syncing...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                {[
                  { id: 'mentions', label: 'Neural Mentions', desc: 'Alert when an operative tags your alias' },
                  { id: 'replies', label: 'Transmission Replies', desc: 'Alert when someone responds to your data' },
                  { id: 'messages', label: 'Direct Uplinks', desc: 'Alert for private transmissions' },
                  { id: 'system', label: 'System Announcements', desc: 'Critical network updates and protocols' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl group hover:border-neon-cyan/30 transition-all">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase italic tracking-tight">{item.label}</h3>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{item.desc}</p>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-cyber-black border border-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-600 after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-cyan/20 peer-checked:after:bg-neon-cyan peer-checked:after:shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
