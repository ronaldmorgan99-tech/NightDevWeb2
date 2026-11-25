import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate, useLocation } from 'react-router';
import { 
  Clock, 
  ChevronRight, 
  Reply, 
  ShieldCheck,
  Award,
  Pin,
  Lock,
  Unlock,
  CheckCircle,
  Save,
  X,
  EyeOff,
  Eye,
  Trash2,
  AlertTriangle,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiJson } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';
import ConfirmationModal from '../components/ConfirmationModal';
import PostOverflowMenu from '../components/PostOverflowMenu';
import { AuthorLink, UserAvatar, profilePath } from '../components/UserAvatar';
import { formatDbDate, formatDbDateTime, isRecentlyActive, parseDbDate } from '../lib/dates';
import { buildQuotedReply, parsePostIdFromUrl, postAnchorId } from '../lib/postMenu';

interface Post {
  id: number;
  content: string;
  author_id: number;
  author_name: string;
  author_avatar?: string;
  author_role: string;
  author_bio?: string | null;
  author_joined_at?: string | null;
  author_last_active?: string | null;
  author_post_count?: number;
  is_hidden: number;
  is_hidden_placeholder?: boolean;
  created_at: string;
  edited_at?: string | null;
}

interface ThreadData {
  thread: {
    id: number;
    title: string;
    forum_id: number;
    is_locked: number;
    is_pinned: number;
    is_solved: number;
    is_hidden: number;
    author_id?: number;
    author_name?: string;
    author_avatar?: string | null;
    forum_name?: string;
    views?: number;
    created_at?: string;
  };
  posts: Post[];
}

const ThreadViewPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replyContent, setReplyContent] = useState('');
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<number | null>(null);
  const replyBoxRef = useRef<HTMLTextAreaElement>(null);
  
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'thread' | 'post';
    id: number | null;
  }>({
    isOpen: false,
    type: 'thread',
    id: null
  });

  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    targetType: 'post' | 'thread' | 'user';
    targetId: number;
  }>({
    isOpen: false,
    targetType: 'post',
    targetId: 0
  });

  const { data, isLoading } = useQuery<ThreadData>({
    queryKey: ['thread', id],
    queryFn: () => apiJson<ThreadData>(`/api/threads/${id}`)
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiJson('/api/posts', {
        method: 'POST',
        json: { thread_id: id, content }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      setReplyContent('');
      setErrorMessage(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ postId, content, is_hidden, is_deleted }: { postId: number; content?: string; is_hidden?: boolean; is_deleted?: boolean }) => {
      return apiJson(`/api/posts/${postId}`, {
        method: 'PATCH',
        json: { content, is_hidden, is_deleted }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      setEditingPostId(null);
      setErrorMessage(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    }
  });

  const threadModMutation = useMutation({
    mutationFn: async (updates: { is_pinned?: boolean; is_locked?: boolean; is_solved?: boolean; is_hidden?: boolean }) => {
      return apiJson(`/api/threads/${id}`, {
        method: 'PATCH',
        json: updates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', id] });
      setErrorMessage(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    }
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async () => {
      return apiJson(`/api/threads/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum', String(data?.thread.forum_id)] });
      navigate(`/forums/${data?.thread.forum_id}`);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    }
  });

  useEffect(() => {
    if (!data?.posts?.length) return;
    const href = typeof window !== 'undefined' ? window.location.href : `${location.pathname}${location.search}${location.hash}`;
    const postId = parsePostIdFromUrl(href) ?? parsePostIdFromUrl(`${location.pathname}${location.search}${location.hash}`);
    if (!postId) return;
    const el = document.getElementById(postAnchorId(postId));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data, location.pathname, location.search, location.hash]);

  const handleQuote = (post: Post) => {
    setReplyContent((prev) => buildQuotedReply(post.author_name, post.content, prev));
    setOpenMenuPostId(null);
    window.requestAnimationFrame(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      replyBoxRef.current?.focus();
    });
  };

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-12 w-64 bg-white/5 rounded-lg" /><div className="h-96 bg-white/5 rounded-2xl" /></div>;
  if (!data?.thread) {
    return (
      <div className="cyber-card p-12 text-center space-y-4">
        <p className="text-zinc-400 font-bold">Thread not found.</p>
        <Link to="/forums" className="text-neon-cyan hover:underline text-sm">Back to forums</Link>
      </div>
    );
  }

  const isStaff = user && ['admin', 'moderator'].includes(user.role);

  return (
    <div className="space-y-8">
      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between text-red-400 text-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {errorMessage}
            </div>
            <button onClick={() => setErrorMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600 mb-4">
            <Link to="/forums" className="hover:text-neon-cyan transition-colors">Forums</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/forums/${data.thread.forum_id}`} className="hover:text-neon-cyan transition-colors">{data.thread.forum_name || 'Sector'}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-neon-cyan truncate max-w-[200px]">{data.thread.title}</span>
          </nav>
          <div className="flex items-center gap-4 mb-2">
            {data.thread.is_pinned === 1 && <Pin className="w-6 h-6 text-neon-cyan neon-glow-cyan" />}
            {data.thread.is_locked === 1 && <Lock className="w-6 h-6 text-neon-pink neon-glow-pink" />}
            {data.thread.is_solved === 1 && <CheckCircle className="w-6 h-6 text-neon-green" />}
            {data.thread.is_hidden === 1 && <EyeOff className="w-6 h-6 text-neon-purple" />}
            <h1 className="text-5xl font-black text-white italic tracking-tighter leading-none uppercase">
              {data.thread.title}
            </h1>
          </div>
          {data.thread.author_id && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span>Started by</span>
              <AuthorLink
                userId={data.thread.author_id}
                name={data.thread.author_name}
                avatar={data.thread.author_avatar}
                size="sm"
                nameClassName="text-zinc-200 hover:text-neon-cyan"
              />
              {data.thread.created_at && (
                <span className="font-mono" title={formatDbDateTime(data.thread.created_at)}>
                  {formatDbDate(data.thread.created_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {isStaff && (
          <div className="flex gap-2">
            <button 
              onClick={() => threadModMutation.mutate({ is_pinned: !data.thread.is_pinned })}
              className={`p-3 rounded-xl border transition-all ${data.thread.is_pinned ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-white'}`}
              title={data.thread.is_pinned ? 'Unpin Thread' : 'Pin Thread'}
            >
              <Pin className="w-5 h-5" />
            </button>
            <button 
              onClick={() => threadModMutation.mutate({ is_locked: !data.thread.is_locked })}
              className={`p-3 rounded-xl border transition-all ${data.thread.is_locked ? 'bg-neon-pink/10 border-neon-pink/30 text-neon-pink' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-white'}`}
              title={data.thread.is_locked ? 'Unlock Thread' : 'Lock Thread'}
            >
              {data.thread.is_locked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => threadModMutation.mutate({ is_hidden: !data.thread.is_hidden })}
              className={`p-3 rounded-xl border transition-all ${data.thread.is_hidden ? 'bg-neon-purple/10 border-neon-purple/30 text-neon-purple' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-white'}`}
              title={data.thread.is_hidden ? 'Unhide Thread' : 'Hide Thread'}
            >
              {data.thread.is_hidden ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => {
                setConfirmDelete({ isOpen: true, type: 'thread', id: data.thread.id });
              }}
              className="p-3 rounded-xl border border-white/5 bg-white/5 text-zinc-500 hover:text-neon-pink hover:bg-neon-pink/5 transition-all"
              title="Delete Thread"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {data.posts.map((post, idx) => (
          <motion.div
            key={post.id}
            id={postAnchorId(post.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex flex-col md:flex-row gap-px bg-white/5 border border-white/5 rounded-3xl overflow-hidden group scroll-mt-24"
          >
            {/* Author Sidebar */}
            <div className="w-full md:w-64 bg-cyber-dark p-8 flex flex-col items-center text-center border-b md:border-b-0 md:border-r border-white/5 relative">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <Link to={profilePath(post.author_id)} title={`View ${post.author_name}'s profile`} className="group/avatar relative mb-6">
                <UserAvatar
                  name={post.author_name}
                  src={post.author_avatar}
                  size="xl"
                  className="shadow-2xl group-hover/avatar:border-neon-cyan/50 transition-all duration-500"
                />
                {isRecentlyActive(post.author_last_active) && (
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-neon-green rounded-full border-2 border-cyber-dark shadow-[0_0_8px_#39ff14]"
                    title="Active recently"
                  />
                )}
              </Link>
              
              <Link
                to={profilePath(post.author_id)}
                className="font-black text-white hover:text-neon-cyan transition-colors mb-2 italic tracking-tight text-lg uppercase break-all"
              >
                {post.author_name}
              </Link>
              
              <div className={`text-[8px] uppercase tracking-[0.3em] font-black px-3 py-1.5 rounded-lg mb-6 flex items-center gap-2 border ${
                post.author_role === 'admin' ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/20' :
                post.author_role === 'moderator' ? 'bg-neon-green/10 text-neon-green border-neon-green/20' :
                'bg-white/5 text-zinc-500 border-white/10'
              }`}>
                {post.author_role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                {post.author_role === 'moderator' && <Award className="w-3 h-3" />}
                {post.author_role}
              </div>

              <div className="hidden md:block space-y-3 w-full pt-6 border-t border-white/5">
                {user && user.id !== post.author_id && (
                  <button 
                    onClick={() => navigate(`/messages?user=${post.author_id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-neon-cyan hover:bg-neon-cyan/20 transition-all group/msg"
                  >
                    <Mail className="w-3 h-3 group-hover/msg:scale-110 transition-transform" />
                    Message
                  </button>
                )}
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">
                  <span>Posts</span>
                  <span className="text-neon-cyan font-mono">{post.author_post_count ?? 0}</span>
                </div>
                <div className="flex justify-between text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">
                  <span>Joined</span>
                  <span className="text-zinc-400 font-mono">{parseDbDate(post.author_joined_at)?.getFullYear() ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div className={`flex-1 bg-cyber-black/40 flex flex-col ${post.is_hidden ? 'opacity-50' : ''} relative`}>
              <div className="p-5 border-b border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest font-black text-zinc-600">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-neon-cyan/50">
                    <Clock className="w-3 h-3" />
                    <span className="font-mono">{formatDbDateTime(post.created_at)}</span>
                  </div>
                  {post.edited_at && !post.is_hidden_placeholder && (
                    <span
                      className="text-zinc-500 normal-case tracking-normal font-semibold italic"
                      title={`Edited ${formatDbDateTime(post.edited_at)}`}
                      data-testid="post-edited-label"
                    >
                      Edited
                    </span>
                  )}
                  {post.is_hidden === 1 && (
                    <span className="flex items-center gap-1 text-neon-purple neon-glow-purple">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
                <PostOverflowMenu
                  postId={post.id}
                  threadLocked={data.thread.is_locked === 1}
                  isHidden={post.is_hidden === 1}
                  isHiddenPlaceholder={Boolean(post.is_hidden_placeholder)}
                  postAuthorId={post.author_id}
                  viewer={user ? { id: user.id, role: user.role } : null}
                  isOpen={openMenuPostId === post.id}
                  onOpenChange={(open) => setOpenMenuPostId(open ? post.id : null)}
                  onEdit={() => {
                    setEditingPostId(post.id);
                    setEditContent(post.content);
                  }}
                  onHide={() => editMutation.mutate({ postId: post.id, is_hidden: !post.is_hidden })}
                  onDelete={() => setConfirmDelete({ isOpen: true, type: 'post', id: post.id })}
                  onReport={() => setReportModal({ isOpen: true, targetType: 'post', targetId: post.id })}
                  onQuote={() => handleQuote(post)}
                />
              </div>
              
              <div className="p-6 flex-1 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {post.is_hidden_placeholder ? (
                  <div className="flex items-center gap-3 p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl text-orange-400/60 italic text-sm">
                    <EyeOff className="w-4 h-4" />
                    {post.content}
                  </div>
                ) : editingPostId === post.id ? (
                  <div className="space-y-4">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-40 bg-[#0a0a0c] border border-white/10 rounded-xl p-4 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setEditingPostId(null)}
                        className="px-4 py-2 bg-white/5 text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => editMutation.mutate({ postId: post.id, content: editContent })}
                        disabled={editMutation.isPending || !editContent.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                      >
                        <Save className="w-3 h-3" />
                        {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  post.content
                )}
              </div>
              
              {post.author_bio && (
                <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] text-xs text-zinc-500 italic">
                  {post.author_bio}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Reply Section */}
      {user ? (
        data.thread.is_locked && !isStaff ? (
          <div className="p-12 bg-neon-pink/5 border border-neon-pink/10 rounded-3xl text-center text-neon-pink flex flex-col items-center gap-4">
            <Lock className="w-10 h-10 opacity-50 neon-glow-pink" />
            <p className="font-black uppercase tracking-widest italic">Terminal Locked // Uplink Disabled</p>
          </div>
        ) : (
          <div className="cyber-card p-8 space-y-6">
            <div className="flex items-center gap-3 text-white font-black uppercase italic tracking-tighter text-xl">
              <Reply className="w-6 h-6 text-neon-cyan" />
              Initialize Transmission
            </div>
            {data.thread.is_locked === 1 && (
              <p className="flex items-center gap-2 text-xs text-neon-pink">
                <Lock className="w-3 h-3" /> This thread is locked. You can still reply as staff.
              </p>
            )}
            <textarea
              ref={replyBoxRef}
              id="thread-reply"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Enter data for broadcast..."
              className="w-full h-48 bg-cyber-black border border-white/10 rounded-2xl p-6 text-zinc-300 focus:outline-none focus:border-neon-cyan/50 transition-all resize-none font-medium"
            />
            <div className="flex justify-end">
              <button
                onClick={() => replyMutation.mutate(replyContent)}
                disabled={!replyContent.trim() || replyMutation.isPending}
                className="cyber-button cyber-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replyMutation.isPending ? 'Transmitting...' : 'Broadcast Data'}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="p-12 bg-white/5 border border-white/5 rounded-3xl text-center">
          <p className="text-zinc-500 font-medium tracking-wide">Authentication required for uplink. <Link to="/login" className="text-neon-cyan hover:underline">Initialize Login</Link>.</p>
        </div>
      )}

      <ReportModal 
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ ...reportModal, isOpen: false })}
        targetType={reportModal.targetType}
        targetId={reportModal.targetId}
      />

      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
        onConfirm={() => {
          if (confirmDelete.type === 'thread') {
            deleteThreadMutation.mutate();
          } else if (confirmDelete.type === 'post' && confirmDelete.id) {
            editMutation.mutate({ postId: confirmDelete.id, is_deleted: true });
          }
        }}
        title={`Delete ${confirmDelete.type === 'thread' ? 'Thread' : 'Post'}`}
        message={`Are you sure you want to delete this ${confirmDelete.type}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default ThreadViewPage;
