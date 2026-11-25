import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';
import { useNavigate, useLocation, Link } from 'react-router';
import { Gamepad2, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const SteamIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 0a12 12 0 0 0-11.979 11.037l6.432 2.619a3.15 3.15 0 0 1 1.544-.491c.13 0 .257.01.381.028l2.847-4.142c-.03-.129-.048-.264-.048-.403 0-1.833 1.488-3.321 3.321-3.321S17.821 7.155 17.821 8.988s-1.488 3.321-3.321 3.321c-.14 0-.274-.017-.403-.048l-4.142 2.847c.018.124.028.251.028.381 0 1.833-1.488 3.321-3.321 3.321-.464 0-.887-.174-1.211-.459l-3.058.801c.08.243.18.472.299.688l1.817 4.461A12 12 0 1 0 12 0zm-1.066 14.896c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797zm4.074-5.464c-.992 0-1.797-.805-1.797-1.797s.805-1.797 1.797-1.797 1.797.805 1.797 1.797-.805 1.797-1.797 1.797z"/>
  </svg>
);

const STEAM_AUTH_ERRORS: Record<string, string> = {
  steam_auth_failed: 'Steam sign-in failed or was cancelled. Please try again.'
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const steamError = new URLSearchParams(location.search).get('error');
  const steamErrorMessage = steamError ? STEAM_AUTH_ERRORS[steamError] || STEAM_AUTH_ERRORS.steam_auth_failed : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await apiJson<{ user: any }>('/api/auth/login', {
        method: 'POST',
        json: { username, password }
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
            <span className="text-neon-cyan neon-glow-cyan">Access</span>
          </h2>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] font-black text-zinc-600">Secure Uplink Required</p>
        </div>

        {(error || steamErrorMessage) && (
          <div className="bg-neon-pink/10 border border-neon-pink/20 text-neon-pink p-4 rounded-xl text-[10px] uppercase tracking-widest font-black italic">
            Error // {error || steamErrorMessage}
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
            Authenticate
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-600">Or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <a
          href="/api/auth/steam"
          className="btn-holographic w-full py-4 flex justify-center items-center gap-3 text-xs"
        >
          <SteamIcon />
          Sign in with Steam
        </a>

        <div className="text-center">
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">
            New Operative?{' '}
            <Link to="/register" className="text-neon-cyan hover:text-white transition-colors">
              Initialize Registration
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
