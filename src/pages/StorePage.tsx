import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShoppingBag, Star, Tag, ChevronRight, ShoppingCart, Award, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category: string;
}

interface CartItem {
  productId: number;
  quantity: number;
  price: number;
  name: string;
}

const StorePage: React.FC = () => {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/store/products').then(res => res.json())
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddToCart = async (product: Product) => {
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to cart');
      }
      setCart([...cart, { productId: product.id, quantity: 1, price: product.price, name: product.name }]);
      setSuccess(`${product.name} added to cart!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleRemoveFromCart = async (productId: number) => {
    try {
      const response = await fetch(`/api/cart/${productId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove from cart');
      setCart(cart.filter(item => item.productId !== productId));
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Checkout failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSuccess(`Order #${data.id} created successfully!`);
      setCart([]);
      setShowCart(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    }
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (isLoading) return <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{[1, 2, 3].map(i => <div key={i} className="h-80 bg-white/5 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-12">
      {/* Notifications */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="fixed top-6 right-6 flex items-center gap-3 px-6 py-3 bg-neon-green/10 border border-neon-green text-neon-green rounded-xl z-50">
            <Check className="w-5 h-5" /> {success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="fixed top-6 right-6 flex items-center gap-3 px-6 py-3 bg-neon-pink/10 border border-neon-pink text-neon-pink rounded-xl z-50">
            <AlertCircle className="w-5 h-5" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button onClick={() => setShowCart(!showCart)} className="relative flex items-center justify-center w-16 h-16 bg-neon-cyan text-cyber-black rounded-full shadow-[0_0_20px_rgba(0,243,255,0.5)] hover:scale-110 transition-transform">
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-neon-pink text-white rounded-full flex items-center justify-center text-xs font-black">
              {cart.length}
            </div>
          )}
        </button>
      </div>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {showCart && (
          <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} className="fixed top-0 right-0 h-screen w-96 bg-cyber-black border-l border-white/10 shadow-2xl z-40 flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase">Shopping Cart</h3>
              <button onClick={() => setShowCart(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-zinc-500 py-12">Cart is empty</p>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="flex justify-between items-start p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex-1">
                      <h4 className="text-sm font-black text-white">{item.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1">Qty: {item.quantity}</p>
                      <p className="text-sm font-bold text-neon-green mt-2">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => handleRemoveFromCart(item.productId)} className="text-zinc-500 hover:text-neon-pink transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t border-white/10 p-6 space-y-4">
                <div className="flex justify-between items-center text-lg font-black text-white">
                  <span>Total:</span>
                  <span className="text-neon-green">${cartTotal.toFixed(2)}</span>
                </div>
                <button onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending} className="w-full py-3 bg-neon-green text-cyber-black rounded-xl font-black uppercase hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  {checkoutMutation.isPending ? 'Processing...' : 'Checkout'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative py-24 px-12 rounded-[2rem] overflow-hidden bg-cyber-black border border-neon-cyan/20 text-center">
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase leading-none mb-6">
            Black Market <span className="text-neon-cyan neon-glow-cyan">Exchange</span>
          </h1>
          <p className="text-zinc-500 text-lg font-medium uppercase tracking-widest">
            Support the network // Acquire exclusive digital assets
          </p>
        </div>
        
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-neon-cyan/5 rounded-full blur-[150px]" />
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        </div>
      </section>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {products?.map((product, idx) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="group cyber-card border-white/5 hover:border-neon-cyan/30 transition-all duration-500 flex flex-col overflow-hidden"
          >
            <div className="aspect-square bg-cyber-black flex items-center justify-center relative overflow-hidden border-b border-white/5">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
              ) : (
                <ShoppingBag className="w-20 h-20 text-zinc-900 group-hover:text-neon-cyan/10 transition-colors duration-500" />
              )}
              <div className="absolute top-6 left-6 px-4 py-1.5 bg-cyber-black border border-neon-cyan/30 text-neon-cyan text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                {product.category}
              </div>
            </div>

            <div className="p-8 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase group-hover:text-neon-cyan transition-colors">
                  {product.name}
                </h3>
                <span className="text-2xl font-black text-neon-green font-mono">${product.price.toFixed(2)}</span>
              </div>
              <p className="text-zinc-500 text-sm mb-8 line-clamp-2 font-medium">
                {product.description}
              </p>
              
              <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neon-pink">
                  <Star className="w-4 h-4 fill-current neon-glow-pink" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Elite Status</span>
                </div>
                <button onClick={() => handleAddToCart(product)} className="cyber-button text-xs flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Acquire
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Featured Promo */}
      <section className="cyber-card p-16 flex flex-col md:flex-row items-center gap-16 border-neon-pink/20 relative overflow-hidden">
        <div className="flex-1 space-y-8 relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-neon-pink/10 text-neon-pink text-[10px] font-black uppercase tracking-[0.3em] rounded-lg border border-neon-pink/30 shadow-[0_0_15px_rgba(255,0,255,0.1)]">
            <Tag className="w-4 h-4" /> Limited Protocol
          </div>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">Elite Operative <br /> <span className="text-neon-pink neon-glow-pink">Bundle</span></h2>
          <p className="text-zinc-500 leading-relaxed font-medium text-lg max-w-xl">
            Upgrade your network clearance. Includes the Elite Operative Badge, custom UI themes, and 15% reduction in asset acquisition costs.
          </p>
          <button className="cyber-button cyber-button-primary px-10 py-5 flex items-center gap-3">
            View Bundle <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="w-full md:w-1/3 aspect-square bg-cyber-black border border-neon-pink/20 rounded-[2rem] flex items-center justify-center relative group">
          <Award className="w-40 h-40 text-neon-pink opacity-20 group-hover:opacity-40 transition-opacity duration-500 neon-glow-pink" />
          <div className="absolute inset-0 bg-gradient-to-br from-neon-pink/5 to-transparent rounded-[2rem]" />
        </div>
        
        {/* Background Scanlines */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </section>
    </div>
  );
};
