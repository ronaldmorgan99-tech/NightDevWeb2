import React, { useState, useEffect } from 'react';
import { apiJson } from '../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Link2, 
  Globe, 
  MessageSquare, 
  Gamepad2, 
  Twitch, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

const AdminIntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [isSaved, setIsSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ['admin-settings'],
    queryFn: () => apiJson<Setting[]>('/api/admin/settings')
  });

  useEffect(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      settings.forEach(s => initial[s.key] = s.value);
      setLocalSettings(initial);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (newSettings: { key: string, value: string }[]) => apiJson('/api/admin/settings', {
      method: 'POST',
      json: { settings: newSettings }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  });

  const handleSave = () => {
    const payload = Object.entries(localSettings).map(([key, value]) => ({ key, value: value as string }));
    updateMutation.mutate(payload);
  };

  if (isLoading) return <div className="animate-pulse space-y-8">{[1, 2, 3].map(i => <div key={i} className="h-48 bg-white/5 rounded-3xl" />)}</div>;

  const integrationGroups = [
    {
      title: 'Communication Uplinks',
      icon: MessageSquare,
      color: 'text-neon-cyan',
      items: [
        { key: 'discord_webhook_url', label: 'Discord Webhook URL', placeholder: 'https://discord.com/api/webhooks/...', type: 'password' },
        { key: 'x_account_url', label: 'X Account Link', placeholder: 'https://x.com/NightRespawn', type: 'text' },
      ]
    },
    {
      title: 'Gaming Protocols',
      icon: Zap,
      color: 'text-orange-400',
      items: [
        { key: 'steam_api_key', label: 'Steam Web API Key', placeholder: '32-character hex key', type: 'password' },
        { key: 'twitch_client_id', label: 'Twitch Client ID', placeholder: 'Client ID from Twitch Dev Console', type: 'text' },
        { key: 'network_servers', label: 'Network Servers JSON', placeholder: '[{"name":"Node Alpha","ip":"127.0.0.1:28015"}]', type: 'textarea' },
      ]
    },
    {
      title: 'Core Identity',
      icon: Shield,
      color: 'text-emerald-400',
      items: [
        { key: 'site_name', label: 'Network Name', placeholder: 'NightRespawn', type: 'text' },
        { key: 'site_description', label: 'Network Broadcast Message', placeholder: 'Digital Underground', type: 'text' },
      ]
    }
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">System <span className="text-neon-cyan neon-glow-cyan">Uplinks</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">External Protocol Management // Secure Data Bridges</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="cyber-button cyber-button-primary px-10 py-4 flex items-center gap-3 relative overflow-hidden"
        >
          <Save className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">{updateMutation.isPending ? 'Syncing...' : 'Sync Protocols'}</span>
          {isSaved && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-white flex items-center justify-center text-cyber-black font-black uppercase text-[10px] tracking-widest"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Protocols Synchronized
            </motion.div>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {integrationGroups.map((group, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="cyber-card border-white/5 p-8 space-y-8"
          >
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl bg-white/5 border border-white/10 ${group.color} shadow-[0_0_15px_rgba(255,255,255,0.05)]`}>
                <group.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{group.title}</h3>
            </div>

            <div className="space-y-6">
              {group.items.map((item) => (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{item.label}</label>
                    <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">Key: {item.key}</span>
                  </div>
                  <div className="relative group">
                    {item.type === 'textarea' ? (
                      <textarea
                        rows={6}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all resize-y"
                        placeholder={item.placeholder}
                        value={localSettings[item.key] || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, [item.key]: e.target.value })}
                      />
                    ) : (
                      <input
                        type={item.type}
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                        placeholder={item.placeholder}
                        value={localSettings[item.key] || ''}
                        onChange={(e) => setLocalSettings({ ...localSettings, [item.key]: e.target.value })}
                      />
                    )}
                    <div className="absolute top-4 right-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link2 className="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* System Status Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card border-white/5 p-8 bg-gradient-to-br from-white/[0.02] to-transparent"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-neon-cyan">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Network Status</h3>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Database Uplink', status: 'Optimal', color: 'text-neon-green' },
              { label: 'Asset Server', status: 'Active', color: 'text-neon-green' },
              { label: 'External API Gateway', status: 'Standby', color: 'text-neon-cyan' },
              { label: 'Security Firewall', status: 'Maximum', color: 'text-neon-green' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{stat.label}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${stat.color}`}>{stat.status}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-neon-cyan/80 uppercase tracking-widest leading-relaxed">
              Caution: Modifying system uplinks may disrupt real-time data flow. Ensure all protocol signatures are valid before synchronization.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminIntegrationsPage;
