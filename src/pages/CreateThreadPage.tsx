import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router';
import { MessageSquare, ArrowLeft, Send, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface ForumResponse {
  forum: {
    id: number;
    name: string;
    description: string | null;
    min_role_to_thread: 'member' | 'moderator' | 'admin';
    is_hidden: number;
  } | null;
}

interface CreateThreadResponse {
  id: number;
}

export default function CreateThreadPage() {
  const { id: forumId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: forumData, isLoading: forumLoading } = useQuery<ForumResponse>({
    queryKey: ['forum', forumId],
    queryFn: () => fetch(`/api/forums/${forumId}`).then(res => res.json()),
    enabled: !!forumId
  });

  const roles = ['member', 'moderator', 'admin'];
  const userRoleIndex = user ? roles.indexOf(user.role) : -1;
  const requiredRoleIndex = forumData?.forum?.min_role_to_thread ? roles.indexOf(forumData.forum.min_role_to_thread) : 0;
  const canPost = userRoleIndex >= requiredRoleIndex;

  const mutation = useMutation({
    mutationFn: async (newThread: { forum_id: string; title: string; content: string }): Promise<CreateThreadResponse> => {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newThread)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create thread');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['forum', forumId] });
      navigate(`/threads/${data.id}`);
    }
  });

  if (forumLoading) return <div className="animate-pulse space-y-8"><div className="h-12 w-64 bg-white/5 rounded-lg" /><div className="h-96 bg-white/5 rounded-2xl" /></div>;

  if (!canPost && !forumLoading) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-neon-pink/5 border border-neon-pink/10 rounded-3xl text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-neon-pink mx-auto neon-glow-pink" />
        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Access Denied</h2>
        <p className="text-zinc-500 font-medium">Insufficient clearance for transmission in this sector.</p>
        <Link to={`/forums/${forumId}`} className="cyber-button text-xs">
          Return to Sector
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    mutation.mutate({ forum_id: forumId!, title, content });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex items-center gap-6">
        <Link to={`/forums/${forumId}`} className="p-3 bg-cyber-black border border-white/10 rounded-xl text-zinc-500 hover:text-neon-cyan hover:border-neon-cyan/50 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">Initialize Transmission</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-600">Sector: <span className="text-neon-cyan neon-glow-cyan">{forumData?.forum?.name || 'FORUM'}</span></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {mutation.isError && (
          <div className="p-6 bg-neon-pink/10 border border-neon-pink/20 rounded-2xl flex items-center gap-4 text-neon-pink text-[10px] uppercase tracking-widest font-black italic">
            <AlertCircle className="w-6 h-6" />
            Error // {(mutation.error as Error).message}
          </div>
        )}

        <div className="cyber-card p-10 space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Transmission Header</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter descriptive header..."
              className="w-full bg-cyber-black border border-white/10 rounded-2xl py-5 px-8 text-2xl font-black text-white italic tracking-tight uppercase focus:outline-none focus:border-neon-cyan/50 transition-all"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Data Payload</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Input transmission data..."
              className="w-full h-80 bg-cyber-black border border-white/10 rounded-2xl py-6 px-8 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all resize-none font-medium"
              required
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-neon-cyan/5 border border-neon-cyan/10 rounded-3xl">
          <div className="flex items-center gap-4 text-zinc-500 text-[10px] uppercase tracking-widest font-black italic">
            <AlertCircle className="w-6 h-6 text-neon-cyan opacity-50" />
            Adhere to network protocols during broadcast.
          </div>
          <button
            type="submit"
            disabled={mutation.isPending || !title.trim() || !content.trim()}
            className="cyber-button cyber-button-primary px-12 py-5 flex items-center gap-3 w-full md:w-auto justify-center"
          >
            <Send className="w-5 h-5" />
            {mutation.isPending ? 'Transmitting...' : 'Broadcast Transmission'}
          </button>
        </div>
      </form>
    </div>
  );
}
