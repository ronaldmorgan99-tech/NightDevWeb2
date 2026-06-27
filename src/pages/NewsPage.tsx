import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Newspaper, Pin, MessageSquare, Eye, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchNews, newsExcerpt, formatNewsDate, type NewsItem } from '../lib/news';

const NewsPage: React.FC = () => {
  const { data: news, isLoading, isError } = useQuery<NewsItem[]>({
    queryKey: ['news-page'],
    queryFn: () => fetchNews(50),
    staleTime: 60_000,
    retry: 1
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="relative p-10 md:p-14 rounded-[2rem] overflow-hidden border border-neon-magenta/20 bg-gradient-to-r from-neon-magenta/10 via-cyber-black/40 to-neon-cyan/10">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[length:20px_20px]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-neon-magenta/10 border border-neon-magenta/30 rounded-full mb-6 backdrop-blur-md">
            <Newspaper className="w-3.5 h-3.5 text-neon-magenta" />
            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-neon-magenta">NETWORK BROADCAST</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase italic leading-none">
            LATEST <span className="text-gradient-pink-blue">NEWS</span>
          </h1>
          <p className="text-zinc-400 text-base md:text-lg font-medium mt-5 max-w-2xl">
            Official announcements, patch notes, and network updates from the NightRespawn command deck.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-10 text-center bg-cyber-dark/40 border border-white/5 rounded-2xl">
          <p className="text-zinc-400 font-medium">News feed unavailable. Try again later.</p>
        </div>
      ) : !news || news.length === 0 ? (
        <div className="p-14 text-center bg-cyber-dark/40 border border-white/5 rounded-2xl">
          <Newspaper className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-xl font-black text-zinc-300 italic tracking-tight">No broadcasts yet</h3>
          <p className="text-zinc-500 text-sm font-medium mt-2">
            Announcements posted by the team will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {news.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.4) }}
            >
              <Link
                to={`/threads/${item.id}`}
                className="group relative flex flex-col gap-3 p-7 bg-cyber-dark/40 backdrop-blur-sm border border-white/5 rounded-2xl hover:border-neon-magenta/30 transition-all duration-500 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-neon-magenta/0 via-neon-magenta/[0.03] to-neon-magenta/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">
                  {item.is_pinned ? (
                    <span className="flex items-center gap-1 text-neon-magenta">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  ) : (
                    <Newspaper className="w-3 h-3 text-neon-cyan" />
                  )}
                  <span>{formatNewsDate(item.created_at)}</span>
                  <span className="text-zinc-700">//</span>
                  <span className="text-zinc-400">{item.author_name}</span>
                </div>
                <h2 className="relative z-10 text-xl md:text-2xl font-black text-zinc-100 group-hover:text-white transition-colors italic tracking-tight">
                  {item.title}
                </h2>
                <p className="relative z-10 text-zinc-500 text-sm md:text-base font-medium line-clamp-2">
                  {newsExcerpt(item.excerpt, 240)}
                </p>
                <div className="relative z-10 flex items-center gap-6 text-xs text-zinc-600 font-bold uppercase tracking-widest mt-1">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> {Math.max(item.reply_count, 0)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> {item.views ?? 0}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-neon-cyan group-hover:text-white transition-colors">
                    Read <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
