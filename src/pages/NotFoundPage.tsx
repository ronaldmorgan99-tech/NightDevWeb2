import React from 'react';
import { Link, useLocation } from 'react-router';
import { Compass } from 'lucide-react';

const NotFoundPage: React.FC = () => {
  const location = useLocation();
  return (
    <div className="cyber-card p-12 text-center space-y-6">
      <Compass className="w-12 h-12 text-neon-cyan mx-auto" />
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Page not found</h1>
        <p className="text-zinc-500 text-sm">
          Nothing lives at <span className="font-mono text-zinc-400">{location.pathname}</span>.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/forums" className="cyber-button cyber-button-primary">Go to forums</Link>
        <Link to="/servers" className="text-neon-cyan hover:underline text-sm">View servers</Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
