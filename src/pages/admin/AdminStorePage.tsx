import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ShoppingBag,
  X,
  Save,
  DollarSign,
  Package,
  Image as ImageIcon,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock: number;
}

const AdminStorePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    description: '', 
    price: 0, 
    image_url: '', 
    category: 'Digital', 
    stock: -1 
  });
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: () => fetch('/api/store/products').then(res => res.json())
  });

  const createMutation = useMutation({
    mutationFn: (product: typeof newProduct) => fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setIsAdding(false);
      setNewProduct({ name: '', description: '', price: 0, image_url: '', category: 'Digital', stock: -1 });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (product: Product) => fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setEditingProduct(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setConfirmDelete(null);
    }
  });

  if (isLoading) return <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-8">{[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-white/5 rounded-3xl" />)}</div>;

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Black <span className="text-neon-cyan neon-glow-cyan">Market</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Manage Contraband // Inventory Control Protocols</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="cyber-button cyber-button-primary px-8 py-4 flex items-center gap-3"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">List New Asset</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {products?.map((product) => (
          <motion.div 
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="cyber-card border-white/5 p-6 group flex gap-6"
          >
            <div className="w-32 h-32 rounded-2xl bg-cyber-black border border-white/10 overflow-hidden flex-shrink-0 relative">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-zinc-800" />
                </div>
              )}
              <div className="absolute top-2 right-2 px-2 py-1 bg-cyber-black/80 backdrop-blur-md border border-white/10 rounded text-[8px] font-black text-neon-cyan uppercase tracking-widest">
                {product.category}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight">{product.name}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingProduct(product)}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(product)}
                      className="p-2 text-zinc-500 hover:text-neon-pink transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{product.description}</p>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-neon-cyan" />
                    <span className="text-lg font-black text-white italic">{product.price.toFixed(2)}</span>
                  </div>
                  <div className="w-[1px] h-4 bg-white/10" />
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <Package className="w-3 h-3" /> 
                    {product.stock === -1 ? 'Unlimited' : `${product.stock} Units`}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">ID: {product.id}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setIsAdding(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">List Asset</h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Asset Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                    <textarea 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none resize-none" 
                      rows={4}
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Price (Credits)</label>
                      <input 
                        type="number" 
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                        value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stock (-1 = ∞)</label>
                      <input 
                        type="number" 
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Image URL</label>
                    <input 
                      type="text" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={newProduct.image_url}
                      onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Category</label>
                    <select 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    >
                      <option value="Digital">Digital</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Access">Access</option>
                      <option value="Visual">Visual</option>
                    </select>
                  </div>
                  <div className="aspect-video rounded-2xl bg-cyber-black border border-white/10 overflow-hidden flex items-center justify-center">
                    {newProduct.image_url ? (
                      <img src={newProduct.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-700">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Image Preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-8">
                <button onClick={() => setIsAdding(false)} className="flex-1 px-6 py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Abort</button>
                <button 
                  onClick={() => createMutation.mutate(newProduct)}
                  disabled={!newProduct.name || createMutation.isPending}
                  className="flex-1 cyber-button cyber-button-primary px-6 py-4 text-[10px] disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Listing...' : 'Confirm Listing'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md" onClick={() => setEditingProduct(null)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-cyber-dark border border-neon-cyan/20 rounded-3xl p-8 relative z-10"
            >
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-6">Modify Asset</h3>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Asset Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={editingProduct.name || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Description</label>
                    <textarea 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none resize-none" 
                      rows={4}
                      value={editingProduct.description || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Price (Credits)</label>
                      <input 
                        type="number" 
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                        value={editingProduct.price ?? 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Stock (-1 = ∞)</label>
                      <input 
                        type="number" 
                        className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                        value={editingProduct.stock ?? -1}
                        onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Image URL</label>
                    <input 
                      type="text" 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none" 
                      value={editingProduct.image_url || ''}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Category</label>
                    <select 
                      className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none"
                      value={editingProduct.category || 'Digital'}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    >
                      <option value="Digital">Digital</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Access">Access</option>
                      <option value="Visual">Visual</option>
                    </select>
                  </div>
                  <div className="aspect-video rounded-2xl bg-cyber-black border border-white/10 overflow-hidden flex items-center justify-center">
                    {editingProduct.image_url ? (
                      <img src={editingProduct.image_url} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-700">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Image Preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-8">
                <button onClick={() => setEditingProduct(null)} className="flex-1 px-6 py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 transition-all">Abort</button>
                <button 
                  onClick={() => updateMutation.mutate(editingProduct)}
                  disabled={updateMutation.isPending}
                  className="flex-1 cyber-button cyber-button-primary px-6 py-4 text-[10px] disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Syncing...' : 'Save Changes'}
                </button>
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
                    Are you sure you want to decommission <span className="text-white font-bold italic">"{confirmDelete.name}"</span>? 
                    This asset will be permanently removed from the market.
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

export default AdminStorePage;
