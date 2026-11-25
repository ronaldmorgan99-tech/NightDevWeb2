import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { MessageSquare, Clock, ChevronRight, Pin, Lock, CheckCircle2, Plus, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { apiJson } from '../lib/api';
import { AuthorLink } from '../components/UserAvatar';
import { formatDbDate, formatDbDateTime, formatRelativeTime } from '../lib/dates';

interface Thread {
  id: number;
  title: string;
  author_id: number;
  author_name: string;
  author_avatar?: string | null;
  author_role?: string;
  last_post_at?: string | null;
  last_post_author_id?: number | null;
  last_post_author_name?: string | null;
  last_post_author_avatar?: string | null;
  is_pinned: number;
  is_locked: number;
  is_solved: number;
  is_hidden: number;
  is_hidden_placeholder?: boolean;
  views: number;
  post_count: number;
  created_at: string;
  updated_at: string;
}

interface ForumData {
  forum: {
    id: number;
    name: string;
    description: string | null;
    min_role_to_thread: string;
    is_hidden: number;
  } | null;
  threads: Thread[];
}

const ForumViewPage: React.FC = () => {
  const { id } = useParams();
  const { user } = useAuth();
  
  const { data, isLoading, isError } = useQuery<ForumData>({
    queryKey: ['forum', id],
    queryFn: () => apiJson<ForumData>(`/api/forums/${id}`),
    enabled: !!id
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 w-64 bg-white/5 rounded-lg" /><div className="h-96 bg-white/5 rounded-2xl" /></div>;
  if (isError || !data?.forum) {
    return (
      <div className="cyber-card p-12 text-center space-y-4">
        <p className="text-zinc-400 font-bold">Forum not found.</p>
        <Link to="/forums" className="text-neon-cyan hover:underline text-sm">Back to forums</Link>
      </div>
    );
  }

  const roles = ['member', 'moderator', 'admin'];
  const userRoleIndex = user ? roles.indexOf(user.role) : -1;
  const requiredRoleIndex = roles.indexOf(data.forum.min_role_to_thread);
  const canStartThread = userRoleIndex >= requiredRoleIndex;

  return (
    <div className="space-y-8">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600 mb-4">
            <Link to="/forums" className="hover:text-neon-cyan transition-colors">Forums</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-neon-cyan">{data.forum.name}</span>
          </nav>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">
            {data.forum.name}
          </h1>
          <p className="text-zinc-500 font-medium max-w-xl">{data.forum.description}</p>
        </div>

        {canStartThread && (
          <Link 
            to={`/forums/${id}/new`}
            className="cyber-button cyber-button-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Initialize Thread
          </Link>
        )}
      </div>

      {/* Thread List */}
      <div className="cyber-card border-neon-cyan/10">
        <div className="grid grid-cols-12 gap-4 p-6 bg-white/[0.02] text-[10px] uppercase tracking-[0.3em] font-black text-zinc-600 border-b border-white/5">
          <div className="col-span-12 sm:col-span-7 md:col-span-8">Transmission</div>
          <div className="hidden sm:block sm:col-span-2 text-center">Metrics</div>
          <div className="hidden md:block md:col-span-2 text-right">Uplink Status</div>
        </div>

        <div className="divide-y divide-white/5">
          {data.threads.map((thread, idx) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`group grid grid-cols-12 gap-4 p-6 sm:p-8 hover:bg-neon-cyan/[0.02] transition-all duration-500 relative ${thread.is_pinned ? 'bg-neon-cyan/[0.01]' : ''}`}
            >
              {thread.is_pinned === 1 && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-neon-cyan shadow-[0_0_10px_#00f3ff]" />}
              
              <div className="col-span-12 sm:col-span-7 md:col-span-8 flex gap-6">
                <div className="mt-1">
                  {thread.is_pinned ? (
                    <Pin className="w-6 h-6 text-neon-cyan neon-glow-cyan" />
                  ) : thread.is_solved ? (
                    <CheckCircle2 className="w-6 h-6 text-neon-green" />
                  ) : (
                    <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center group-hover:border-neon-cyan/30 border border-transparent transition-all">
                      <MessageSquare className="w-4 h-4 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <Link 
                    to={`/threads/${thread.id}`}
                    className={`text-xl font-black transition-all duration-300 block truncate italic tracking-tight uppercase ${thread.is_hidden_placeholder ? 'text-neon-purple/40 italic' : 'text-zinc-300 group-hover:text-white group-hover:neon-glow-cyan'}`}
                  >
                    {thread.is_hidden_placeholder && <EyeOff className="w-4 h-4 inline mr-2" />}
                    {thread.title}
                  </Link>
                  <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-black text-zinc-600 mt-2">
                    <AuthorLink
                      userId={thread.author_id}
                      name={thread.author_name}
                      avatar={thread.author_avatar}
                      size="xs"
                      nameClassName="text-zinc-400 hover:text-neon-cyan"
                    />
                    <span className="text-zinc-800">//</span>
                    <span className="font-mono" title={formatDbDateTime(thread.created_at)}>{formatDbDate(thread.created_at)}</span>
                    {thread.is_locked === 1 && <Lock className="w-3 h-3 text-neon-pink" />}
                    {thread.is_hidden === 1 && (
                      <span className="flex items-center gap-1 text-neon-purple neon-glow-purple">
                        <EyeOff className="w-3 h-3" /> Hidden
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex sm:col-span-2 items-center justify-center gap-10 text-sm">
                <div className="text-center">
                  <p className="text-neon-cyan font-mono font-bold text-lg">{thread.post_count}</p>
                  <p className="text-zinc-700 text-[8px] uppercase tracking-[0.2em] font-black">Data</p>
                </div>
                <div className="text-center">
                  <p className="text-neon-pink font-mono font-bold text-lg">{thread.views}</p>
                  <p className="text-zinc-700 text-[8px] uppercase tracking-[0.2em] font-black">Scans</p>
                </div>
              </div>

              <div className="hidden md:flex md:col-span-2 items-center justify-end text-right">
                <div className="text-right min-w-0 flex flex-col items-end gap-1">
                  <p className="text-[8px] uppercase tracking-[0.2em] font-black text-zinc-700">Last Uplink</p>
                  {thread.last_post_author_id && (
                    <AuthorLink
                      userId={thread.last_post_author_id}
                      name={thread.last_post_author_name}
                      avatar={thread.last_post_author_avatar}
                      size="xs"
                      className="max-w-full"
                      nameClassName="text-[11px] text-zinc-400 hover:text-neon-cyan"
                    />
                  )}
                  <p
                    className="text-zinc-500 font-mono text-[10px] flex items-center justify-end gap-2 group-hover:text-neon-cyan transition-colors"
                    title={formatDbDateTime(thread.last_post_at || thread.updated_at)}
                  >
                    <Clock className="w-3 h-3 opacity-50" />
                    {formatRelativeTime(thread.last_post_at || thread.updated_at)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

          {data.threads.length === 0 && (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500">No threads found in this forum yet.</p>
              {canStartThread && (
                <Link to={`/forums/${id}/new`} className="text-indigo-400 hover:text-indigo-300 mt-2 inline-block font-medium">
                  Be the first to start a discussion!
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForumViewPage;
