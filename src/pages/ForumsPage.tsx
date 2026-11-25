import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { MessageSquare, ChevronRight, Hash } from 'lucide-react';
import { motion } from 'motion/react';
import { AuthorLink } from '../components/UserAvatar';
import { formatRelativeTime, formatDbDateTime } from '../lib/dates';

interface Forum {
  id: number;
  name: string;
  description: string;
  display_order: number;
  thread_count: number;
  post_count: number;
  last_thread_id?: number | null;
  last_thread_title?: string | null;
  last_post_at?: string | null;
  last_post_author_id?: number | null;
  last_post_author_name?: string | null;
  last_post_author_avatar?: string | null;
}

interface Category {
  id: number;
  name: string;
  description: string;
  forums: Forum[];
}

/** Forum index (route /forums): breadcrumb, title and categories. The landing page is HomePage. */
const ForumsPage: React.FC = () => {
  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['forum-categories'],
    queryFn: () => fetch('/api/forums/categories').then(res => res.json())
  });
  const formatCompact = (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-8 w-48 bg-white/5 rounded-lg" />
            <div className="grid gap-4">
              {[1, 2].map(j => (
                <div key={j} className="h-24 bg-white/5 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Forum index header */}
      <header className="space-y-3 px-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600">
          <Link to="/" className="hover:text-neon-cyan transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-neon-cyan" aria-current="page">Forums</span>
        </nav>
        <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase">
          Community <span className="text-neon-cyan">Forums</span>
        </h1>
        <p className="text-zinc-500 text-sm font-medium">Pick a board to read threads or start a discussion.</p>
      </header>

      {/* Categories */}
      <div className="space-y-12">
        {categories?.map((category, idx) => (
          <motion.section 
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="space-y-6"
          >
            <div className="flex items-end justify-between px-4">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3 italic tracking-tighter group-hover:text-neon-cyan transition-colors">
                  <Hash className="w-6 h-6 text-neon-cyan animate-pulse" />
                  {category.name}
                </h2>
                <div className="h-[2px] w-12 bg-neon-cyan mt-2" />
              </div>
            </div>

            <div className="grid gap-4">
              {category.forums.map((forum) => (
                <Link
                  key={forum.id}
                  to={`/forums/${forum.id}`}
                  className="glitch-card group relative flex items-center gap-6 p-8 bg-cyber-dark/40 backdrop-blur-sm border border-white/5 rounded-2xl hover:border-neon-cyan/30 transition-all duration-500 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/0 via-neon-cyan/[0.02] to-neon-cyan/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                  
                  <div className="w-14 h-14 bg-cyber-black border border-white/5 rounded-xl flex items-center justify-center group-hover:border-neon-cyan/50 group-hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] transition-all duration-500">
                    <MessageSquare className="w-7 h-7 text-zinc-600 group-hover:text-neon-cyan transition-colors" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-zinc-300 group-hover:text-white transition-colors italic tracking-tight">
                      {forum.name}
                    </h3>
                    <p className="text-zinc-500 text-sm mt-1 line-clamp-1 font-medium">
                      {forum.description}
                    </p>
                  </div>

                  <div className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-l border-white/5 pl-6 min-w-0">
                    <p className="text-[8px] uppercase tracking-[0.2em] font-black text-zinc-600">Last Post</p>
                    {forum.last_post_author_id ? (
                      <>
                        <AuthorLink
                          nested
                          userId={forum.last_post_author_id}
                          name={forum.last_post_author_name}
                          avatar={forum.last_post_author_avatar}
                          size="sm"
                          nameClassName="text-xs text-zinc-300 hover:text-neon-cyan"
                        />
                        {forum.last_thread_title && (
                          <p className="text-[11px] text-zinc-500 truncate" title={forum.last_thread_title}>{forum.last_thread_title}</p>
                        )}
                        <p className="text-[10px] font-mono text-zinc-600" title={formatDbDateTime(forum.last_post_at)}>
                          {formatRelativeTime(forum.last_post_at)}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] text-zinc-600">No posts yet</p>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-10 text-sm">
                    <div className="text-center">
                      <p className="text-neon-cyan font-mono font-bold text-lg">{formatCompact(forum.thread_count || 0)}</p>
                      <p className="text-zinc-600 text-[8px] uppercase tracking-[0.2em] font-black">Threads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-neon-pink font-mono font-bold text-lg">{formatCompact(forum.post_count || 0)}</p>
                      <p className="text-zinc-600 text-[8px] uppercase tracking-[0.2em] font-black">Posts</p>
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center group-hover:border-neon-cyan/30 transition-colors">
                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-neon-cyan transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

    </div>
  );
};

export default ForumsPage;
