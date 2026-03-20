import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FolderTree, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  GripVertical,
  MessageSquare,
  Shield,
  Eye,
  EyeOff,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Forum {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  display_order: number;
  min_role_to_thread: 'member' | 'moderator' | 'admin';
  is_hidden: number;
  created_at?: string;
}

interface Category {
  id: number;
  name: string;
  display_order: number;
  description?: string | null;
  created_at?: string;
  forums: Forum[];
}

const AdminSectorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingForum, setEditingForum] = useState<Forum | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [addingForumToCategory, setAddingForumToCategory] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'category' | 'forum', id: number, name: string } | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newForum, setNewForum] = useState({ name: '', description: '', min_role_to_thread: 'member', display_order: 0 });

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => fetch('/api/forums/categories').then(res => res.json())
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (category: Category) => fetch(`/api/admin/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: category.name, display_order: category.display_order })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingCategory(null);
    }
  });

  const createForumMutation = useMutation({
    mutationFn: (forum: any) => fetch('/api/admin/forums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forum)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setAddingForumToCategory(null);
      setNewForum({ name: '', description: '', min_role_to_thread: 'member', display_order: 0 });
    }
  });

  const updateForumMutation = useMutation({
    mutationFn: (forum: Forum) => fetch(`/api/admin/forums/${forum.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forum)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingForum(null);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  });

  const deleteForumMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/forums/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  });

  if (isLoading) return <div className="animate-pulse space-y-8">{[1, 2, 3].map(i => <div key={i} className="h-64 bg-white/5 rounded-3xl" />)}</div>;

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Sector <span className="text-neon-cyan neon-glow-cyan">Management</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Configure Forum Hierarchy // Access Control Protocols</p>
        </div>
        <button 
          onClick={() => setIsAddingCategory(true)}
          className="cyber-button cyber-button-primary px-8 py-4 flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">Initialize New Sector</span>
        </button>
      </div>

      <div className="space-y-8">
        {categories?.map((category) => (
          <motion.div 
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="cyber-card border-white/5 overflow-hidden"
          >
            {/* Category Header */}
            <div className="p-6 bg-white/[0.02] border-b border-white/5 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <GripVertical className="w-5 h-5 text-zinc-700 cursor-grab" />
                <h2 className="text-xl font-black text-white uppercase italic tracking-tight">{category.name}</h2>
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-2 py-1 bg-white/5 rounded">ID: {category.id}</span>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditingCategory(category)}
                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setConfirmDelete({ type: 'category', id: category.id, name: category.name });
                  }}
                  className="p-2 text-zinc-500 hover:text-neon-pink transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setAddingForumToCategory(category.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-neon-cyan/20 transition-all"
                >
                  <Plus className="w-3 h-3" /> Add Forum
                </button>
              </div>
            </div>

            {/* Forums List */}
            <div className="divide-y divide-white/5">
              {category.forums.map((forum) => (
                <div key={forum.id} className="p-6 flex items-center gap-6 hover:bg-white/[0.01] transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center group-hover:border-neon-cyan/30 transition-colors">
                    <MessageSquare className="w-6 h-6 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-black text-white uppercase italic tracking-tight">{forum.name}</h3>
                      {forum.is_hidden === 1 && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-neon-pink uppercase tracking-widest px-1.5 py-0.5 bg-neon-pink/10 border border-neon-pink/20 rounded">
                          <EyeOff className="w-2 h-2" /> Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-1">{forum.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                        <Shield className="w-3 h-3 text-neon-cyan/50" /> {forum.min_role_to_thread} Access
                      </div>
                      <div className="w-[1px] h-3 bg-white/10" />
                      <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                        Order: {forum.display_order}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingForum(forum)}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setConfirmDelete({ type: 'forum', id: forum.id, name: forum.name });
                      }}
                      className="p-2 text-zinc-500 hover:text-neon-pink transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {category.forums.length === 0 && (
                <div className="p-12 text-center text-zinc-600 uppercase tracking-widest text-[10px] font-black">
                  No forums initialized in this sector
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddingCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setIsAddingCategory(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Initialize Sector</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sector Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    placeholder="e.g. Sector Alpha" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsAddingCategory(false)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                  <button 
                    onClick={() => createCategoryMutation.mutate(newCategoryName)}
                    disabled={!newCategoryName || createCategoryMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {createCategoryMutation.isPending ? 'Initializing...' : 'Initialize'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Category Modal */}
      <AnimatePresence>
        {editingCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setEditingCategory(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Edit Sector</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sector Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    value={editingCategory.name || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Display Order</label>
                  <input 
                    type="number" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    value={editingCategory.display_order ?? 0}
                    onChange={(e) => setEditingCategory({ ...editingCategory, display_order: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setEditingCategory(null)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                  <button 
                    onClick={() => updateCategoryMutation.mutate(editingCategory)}
                    disabled={updateCategoryMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {updateCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Forum Modal */}
      <AnimatePresence>
        {addingForumToCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setAddingForumToCategory(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Add New Forum</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Forum Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    value={newForum.name}
                    onChange={(e) => setNewForum({ ...newForum, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                  <textarea 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none resize-none" 
                    rows={3}
                    value={newForum.description}
                    onChange={(e) => setNewForum({ ...newForum, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Min Role</label>
                    <select 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none"
                      value={newForum.min_role_to_thread}
                      onChange={(e) => setNewForum({ ...newForum, min_role_to_thread: e.target.value })}
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Display Order</label>
                    <input 
                      type="number" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={newForum.display_order}
                      onChange={(e) => setNewForum({ ...newForum, display_order: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setAddingForumToCategory(null)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                  <button 
                    onClick={() => createForumMutation.mutate({ ...newForum, category_id: addingForumToCategory })}
                    disabled={!newForum.name || createForumMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {createForumMutation.isPending ? 'Creating...' : 'Create Forum'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Forum Modal */}
      <AnimatePresence>
        {editingForum && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setEditingForum(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Edit Forum</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Forum Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                    value={editingForum.name || ''}
                    onChange={(e) => setEditingForum({ ...editingForum, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                  <textarea 
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none resize-none" 
                    rows={3}
                    value={editingForum.description || ''}
                    onChange={(e) => setEditingForum({ ...editingForum, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Min Role</label>
                    <select 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none"
                      value={editingForum.min_role_to_thread || 'member'}
                      onChange={(e) => setEditingForum({ ...editingForum, min_role_to_thread: e.target.value })}
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Display Order</label>
                    <input 
                      type="number" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={editingForum.display_order ?? 0}
                      onChange={(e) => setEditingForum({ ...editingForum, display_order: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <EyeOff className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-400">Hidden Forum</span>
                  </div>
                  <button 
                    onClick={() => setEditingForum({ ...editingForum, is_hidden: editingForum.is_hidden === 1 ? 0 : 1 })}
                    className={`w-10 h-5 rounded-full relative transition-all ${editingForum.is_hidden === 1 ? 'bg-neon-pink' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingForum.is_hidden === 1 ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setEditingForum(null)} className="flex-1 px-6 py-3 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
                  <button 
                    onClick={() => updateForumMutation.mutate(editingForum)}
                    disabled={updateForumMutation.isPending}
                    className="flex-1 cyber-button cyber-button-primary px-6 py-3 text-[10px] disabled:opacity-50"
                  >
                    {updateForumMutation.isPending ? 'Saving...' : 'Save Changes'}
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
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Confirm Deletion</h3>
                  <p className="text-sm text-zinc-500 uppercase tracking-widest leading-relaxed">
                    Are you sure you want to purge <span className="text-white font-bold italic">"{confirmDelete.name}"</span>? 
                    This action is irreversible and all nested data will be lost.
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
                    onClick={() => {
                      if (confirmDelete.type === 'category') {
                        deleteCategoryMutation.mutate(confirmDelete.id);
                      } else {
                        deleteForumMutation.mutate(confirmDelete.id);
                      }
                      setConfirmDelete(null);
                    }}
                    className="flex-1 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-pink hover:text-white transition-all shadow-[0_0_20px_rgba(255,68,102,0.2)]"
                  >
                    Confirm Purge
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

export default AdminSectorsPage;
