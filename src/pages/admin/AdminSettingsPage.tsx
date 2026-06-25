import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Globe, 
  Shield, 
  MessageSquare, 
  ShoppingBag, 
  Palette, 
  Save,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface Settings {
  site_name: string;
  site_slogan: string;
  site_description: string;
  maintenance_mode: boolean;
  allow_registrations: boolean;
  require_email_verification: boolean;
  max_login_attempts: number;
  session_timeout_minutes: number;
  threads_per_page: number;
  posts_per_page: number;
  allow_signatures: boolean;
  primary_accent_color: string;
  custom_css: string;
}

const AdminSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    site_name: '',
    site_slogan: '',
    site_description: '',
    maintenance_mode: false,
    allow_registrations: true,
    require_email_verification: true,
    max_login_attempts: 5,
    session_timeout_minutes: 1440,
    threads_per_page: 20,
    posts_per_page: 15,
    allow_signatures: true,
    primary_accent_color: '#00f3ff',
    custom_css: '',
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'forums', label: 'Forums', icon: MessageSquare },
    { id: 'economy', label: 'Economy', icon: ShoppingBag },
    { id: 'branding', label: 'Branding', icon: Palette },
  ];

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/admin/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        
        const data = await response.json();
        const settingsMap: Record<string, any> = {};
        
        data.forEach((item: any) => {
          let value = item.value;
          // Parse boolean and number values
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(value) && value !== '') value = parseInt(value, 10);
          settingsMap[item.key] = value;
        });
        
        setSettings(prev => ({ ...prev, ...settingsMap }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      // Convert settings to API format
      const settingsToSave = Object.entries(settings).map(([key, value]) => ({
        key,
        value: typeof value === 'boolean' ? String(value) : value,
      }));

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToSave }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-neon-cyan" />
          <p className="text-zinc-500 uppercase tracking-widest text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Core <span className="text-neon-cyan neon-glow-cyan">Settings</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">System Configuration // Global Protocol Management</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="cyber-button cyber-button-primary px-8 py-4 flex items-center gap-3 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span className="text-xs">{isSaving ? 'Synchronizing...' : 'Save Changes'}</span>
        </button>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-neon-pink/10 border border-neon-pink/30 rounded-xl"
        >
          <AlertCircle className="w-5 h-5 text-neon-pink flex-shrink-0" />
          <p className="text-sm text-neon-pink">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl"
        >
          <CheckCircle className="w-5 h-5 text-neon-cyan flex-shrink-0" />
          <p className="text-sm text-neon-cyan">Settings saved successfully!</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        {/* Settings Navigation */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                activeTab === tab.id
                  ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30 shadow-[0_0_20px_rgba(0,243,255,0.1)]'
                  : 'text-zinc-500 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-neon-cyan neon-glow-cyan' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-8">
          {activeTab === 'general' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="cyber-card border-white/5 p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site Name</label>
                    <input 
                      type="text" 
                      value={settings.site_name}
                      onChange={(e) => handleSettingChange('site_name', e.target.value)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site Slogan</label>
                    <input 
                      type="text" 
                      value={settings.site_slogan}
                      onChange={(e) => handleSettingChange('site_slogan', e.target.value)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Site Description</label>
                  <textarea 
                    rows={4}
                    value={settings.site_description}
                    onChange={(e) => handleSettingChange('site_description', e.target.value)}
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all resize-none"
                  />
                </div>
                <div className="flex items-center justify-between p-6 bg-neon-pink/5 border border-neon-pink/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-neon-pink" />
                    <div>
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Maintenance Mode</h4>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Disable public access to the terminal</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSettingChange('maintenance_mode', !settings.maintenance_mode)}
                    className={`w-12 h-6 rounded-full relative transition-all ${settings.maintenance_mode ? 'bg-neon-pink/30' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute w-4 h-4 rounded-full transition-all ${settings.maintenance_mode ? 'bg-neon-pink right-1' : 'bg-zinc-500 left-1'} top-1`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="cyber-card border-white/5 p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tight">New Registrations</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Allow new operatives to join the network</p>
                  </div>
                  <button 
                    onClick={() => handleSettingChange('allow_registrations', !settings.allow_registrations)}
                    className={`w-12 h-6 rounded-full relative transition-all ${settings.allow_registrations ? 'bg-neon-cyan/20' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute w-4 h-4 rounded-full transition-all ${settings.allow_registrations ? 'bg-neon-cyan right-1 shadow-[0_0_10px_rgba(0,243,255,0.5)]' : 'bg-zinc-500 left-1'} top-1`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Email Verification</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Require uplink confirmation for new accounts</p>
                  </div>
                  <button 
                    onClick={() => handleSettingChange('require_email_verification', !settings.require_email_verification)}
                    className={`w-12 h-6 rounded-full relative transition-all ${settings.require_email_verification ? 'bg-neon-cyan/20' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute w-4 h-4 rounded-full transition-all ${settings.require_email_verification ? 'bg-neon-cyan right-1 shadow-[0_0_10px_rgba(0,243,255,0.5)]' : 'bg-zinc-500 left-1'} top-1`} />
                  </button>
                </div>
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Max Login Attempts</label>
                    <input 
                      type="number" 
                      value={settings.max_login_attempts}
                      onChange={(e) => handleSettingChange('max_login_attempts', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Session Timeout (Minutes)</label>
                    <input 
                      type="number" 
                      value={settings.session_timeout_minutes}
                      onChange={(e) => handleSettingChange('session_timeout_minutes', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'forums' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="cyber-card border-white/5 p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Threads Per Page</label>
                    <input 
                      type="number" 
                      value={settings.threads_per_page}
                      onChange={(e) => handleSettingChange('threads_per_page', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Posts Per Page</label>
                    <input 
                      type="number" 
                      value={settings.posts_per_page}
                      onChange={(e) => handleSettingChange('posts_per_page', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tight">Allow Signatures</h4>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Enable custom operative signatures in posts</p>
                  </div>
                  <button 
                    onClick={() => handleSettingChange('allow_signatures', !settings.allow_signatures)}
                    className={`w-12 h-6 rounded-full relative transition-all ${settings.allow_signatures ? 'bg-neon-cyan/20' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute w-4 h-4 rounded-full transition-all ${settings.allow_signatures ? 'bg-neon-cyan right-1 shadow-[0_0_10px_rgba(0,243,255,0.5)]' : 'bg-zinc-500 left-1'} top-1`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'economy' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="cyber-card border-white/5 p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-10 h-10 text-neon-pink" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Sector Under Construction</h3>
                  <p className="text-sm text-zinc-500 uppercase tracking-widest max-w-md mx-auto">
                    The economy protocols are currently being rewritten. Access to credit management and market configuration is restricted.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-neon-pink uppercase tracking-[0.3em]">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Uplink Pending...
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'branding' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="cyber-card border-white/5 p-8 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Primary Accent Color</label>
                  <div className="flex flex-wrap gap-4">
                    {['#00f3ff', '#ff00ff', '#39ff14', '#bc13fe', '#ff0055'].map(color => (
                      <button 
                        key={color}
                        onClick={() => handleSettingChange('primary_accent_color', color)}
                        className={`w-12 h-12 rounded-xl border-2 transition-all ${settings.primary_accent_color === color ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Custom CSS Uplink</label>
                  <textarea 
                    rows={6}
                    value={settings.custom_css}
                    onChange={(e) => handleSettingChange('custom_css', e.target.value)}
                    placeholder="/* Inject custom protocols here */"
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-neon-cyan focus:border-neon-cyan/50 outline-none transition-all resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
