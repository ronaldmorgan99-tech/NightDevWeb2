import React, { useState } from 'react';
import { apiJson } from '../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Tag as TagIcon,
  X,
  Save,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Tag {
  id: number;
  name: string;
  color: string;
}

const AdminTagsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTag, setNewTag] = useState({ name: '', color: '#00f3ff' });
  const [confirmDelete, setConfirmDelete] = useState<Tag | null>(null);

  const { data: tags, isLoading } = useQuery<Tag[]>({
    queryKey: ['admin-tags'],
    queryFn: () => apiJson<Tag[]>('/api/admin/tags')
  });

  const createMutation = useMutation({
    mutationFn: (tag: typeof newTag) => apiJson('/api/admin/tags', {
      method: 'POST',
      json: tag
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setIsAdding(false);
      setNewTag({ name: '', color: '#00f3ff' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (tag: Tag) => apiJson(`/api/admin/tags/${tag.id}`, {
      method: 'PATCH',
      json: { name: tag.name, color: tag.color }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setEditingTag(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiJson(`/api/admin/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setConfirmDelete(null);
    }
  });

  if (isLoading) return <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-6">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}</div>;
  const safeTags = Array.isArray(tags) ? tags : [];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Data <span className="text-neon-cyan neon-glow-cyan">Tags</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Classify Network Transmissions // Visual Identification Protocols</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="cyber-button cyber-button-primary px-8 py-4 flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">Generate New Tag</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {safeTags.map((tag) => (
          <motion.div 
            key={tag.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="cyber-card border-white/5 p-6 group relative overflow-hidden"
          >
            <div 
              className="absolute top-0 left-0 w-1 h-full" 
              style={{ backgroundColor: tag.color, boxShadow: `0 0 10px ${tag.color}` }} 
            />
            
            <div className="flex flex-col h-full justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <TagIcon className="w-5 h-5" style={{ color: tag.color }} />
                  <span className="text-lg font-black text-white uppercase italic tracking-tight">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingTag(tag)}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setConfirmDelete(tag)}
                    className="p-2 text-zinc-500 hover:text-neon-pink transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{tag.color}</span>
                <div 
                  className="w-4 h-4 rounded-full border border-white/10" 
                  style={{ backgroundColor: tag.color }} 
                />
              </div>
            </div>
          </motion.div>
        ))}
        {safeTags.length === 0 && (
          <div className="md:col-span-3 lg:col-span-4 p-12 text-center cyber-card border-white/5 bg-white/[0.02]">
            <TagIcon className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20" />
            <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No tags returned from API response</p>
          </div>
        )}
      </div>

      {/* Add Tag Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setIsAdding(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Generate Tag</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tag Label</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    placeholder="e.g. CRITICAL" 
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Color Signature</label>
                  <div className="flex gap-4">
                    <input 
                      type="color" 
                      className="w-12 h-12 bg-transparent border-none cursor-pointer" 
                      value={newTag.color}
                      onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                    />
                    <input 
                      type="text" 
                      className="flex-1 bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none font-mono" 
                      value={newTag.color}
                      onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsAdding(false)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Abort</button>
                  <button 
                    onClick={() => createMutation.mutate(newTag)}
                    disabled={!newTag.name || createMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Generating...' : 'Initialize'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tag Modal */}
      <AnimatePresence>
        {editingTag && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setEditingTag(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Modify Tag</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tag Label</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    value={editingTag.name || ''}
                    onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Color Signature</label>
                  <div className="flex gap-4">
                    <input 
                      type="color" 
                      className="w-12 h-12 bg-transparent border-none cursor-pointer" 
                      value={editingTag.color || '#ffffff'}
                      onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                    />
                    <input 
                      type="text" 
                      className="flex-1 bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none font-mono" 
                      value={editingTag.color || '#ffffff'}
                      onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setEditingTag(null)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Abort</button>
                  <button 
                    onClick={() => updateMutation.mutate(editingTag)}
                    disabled={updateMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Syncing...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/90 backdrop-blur-xl" onClick={() => setConfirmDelete(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-cyber-dark border border-neon-pink/30 rounded-3xl p-8 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-pink to-transparent opacity-50" />
              
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-neon-pink" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Confirm Purge</h3>
                  <p className="text-sm text-zinc-500 uppercase tracking-widest leading-relaxed">
                    Are you sure you want to delete the tag <span className="text-white font-bold italic">"{confirmDelete.name}"</span>? 
                    This will remove it from all associated transmissions.
                  </p>
                </div>

                <div className="flex gap-4 w-full pt-4">
                  <button 
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-6 py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={() => deleteMutation.mutate(confirmDelete.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-pink hover:text-white transition-all shadow-[0_0_20px_rgba(255,68,102,0.2)]"
                  >
                    {deleteMutation.isPending ? 'Purging...' : 'Confirm Purge'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTagsPage;
