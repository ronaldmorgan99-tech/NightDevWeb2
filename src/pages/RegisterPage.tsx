import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';
import { useNavigate, Link } from 'react-router';
import { Gamepad2, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiJson<{ user: any }>('/api/auth/register', {
        method: 'POST',
        json: { username, email, password }
      });
      login(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-8 cyber-card p-12 border-neon-cyan/20"
      >
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-cyber-black border border-neon-cyan/50 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.2)] mb-8">
            <Gamepad2 className="w-10 h-10 text-neon-cyan" />
          </div>
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
            Initialize <br />
            <span className="text-neon-cyan neon-glow-cyan">Uplink</span>
          </h2>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] font-black text-zinc-600">New Operative Registration</p>
        </div>

        {error && (
          <div className="bg-neon-pink/10 border border-neon-pink/20 text-neon-pink p-4 rounded-xl text-[10px] uppercase tracking-widest font-black italic">
            Error // {error}
          </div>
        )}

        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-cyan/50" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl py-4 pl-12 pr-4 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all font-medium"
                placeholder="OPERATIVE_ID"
              />
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-cyan/50" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl py-4 pl-12 pr-4 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all font-medium"
                placeholder="COMMS_CHANNEL (EMAIL)"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-cyan/50" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-cyber-black border border-white/10 rounded-xl py-4 pl-12 pr-4 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all font-medium"
                placeholder="ACCESS_KEY"
              />
            </div>
          </div>

          <button
            type="submit"
            className="cyber-button cyber-button-primary w-full flex justify-center items-center gap-3"
          >
            Initialize
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center">
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">
            Already Authenticated?{' '}
            <Link to="/login" className="text-neon-cyan hover:text-white transition-colors">
              Initialize Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
