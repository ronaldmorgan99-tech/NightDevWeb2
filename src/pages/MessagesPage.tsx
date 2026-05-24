import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Search, MoreVertical, Phone, Video, Info, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import { format } from 'date-fns';
import { useSearchParams, Navigate } from 'react-router';
import { buildMembersSearchUrl } from '../lib/messagesSearch';
import type { SearchUserResult } from '../lib/messageSearch';

interface Conversation {
  id: number;
  username: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: number;
  created_at: string;
}

export default function MessagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { socket, sendMessage } = useMessaging();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [userBootstrapError, setUserBootstrapError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const wasNearBottomRef = useRef(true);
  const messagesRequestControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const conversationsRequestControllerRef = useRef<AbortController | null>(null);
  const conversationsRequestSeqRef = useRef(0);
  const conversationsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSearchRequestControllerRef = useRef<AbortController | null>(null);
  const userSearchRequestSeqRef = useRef(0);


  const isConversationOpen = Boolean(selectedUser);
  const showSidebarOnMobile = !isConversationOpen;
  const showChatOnMobile = isConversationOpen;

  const getIsNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= 80;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const dedupeMessagesById = (items: Message[]) => {
    const messageMap = new Map<number, Message>();
    items.forEach(message => messageMap.set(message.id, message));
    return Array.from(messageMap.values());
  };

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const isOwnLatestMessage = latestMessage?.sender_id === user?.id;
    const shouldAutoScroll = isInitialLoadRef.current || isOwnLatestMessage || wasNearBottomRef.current;

    if (shouldAutoScroll) {
      scrollToBottom(isInitialLoadRef.current ? 'auto' : 'smooth');
      isInitialLoadRef.current = false;
      wasNearBottomRef.current = true;
    }
  }, [messages]);

  useEffect(() => {
    if (!selectedUser?.id) return;
    isInitialLoadRef.current = true;
    wasNearBottomRef.current = true;
    scrollToBottom('auto');
  }, [selectedUser?.id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      wasNearBottomRef.current = getIsNearBottom();
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [selectedUser?.id]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => () => {
    if (conversationsRefreshTimerRef.current) {
      clearTimeout(conversationsRefreshTimerRef.current);
    }
    conversationsRequestControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (userSearch.length < 2) {
      userSearchRequestControllerRef.current?.abort();
      userSearchRequestSeqRef.current += 1;
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    userSearchRequestSeqRef.current += 1;
    const requestToken = userSearchRequestSeqRef.current;

    const timer = setTimeout(() => {
      userSearchRequestControllerRef.current?.abort();

      const controller = new AbortController();
      userSearchRequestControllerRef.current = controller;
      setIsSearching(true);

      const searchUsers = async () => {
        try {
          const searchUrl = buildMembersSearchUrl(userSearch);
          const res = await fetch(searchUrl);
          if (res.ok) {
            const data = await res.json();
            if (controller.signal.aborted || requestToken !== userSearchRequestSeqRef.current) {
              return;
            }

            const members = Array.isArray(data) ? data : [];
            setSearchResults(members.filter((u: any) => u.id !== user?.id));
          }
        } catch (err) {
          if (controller.signal.aborted || requestToken !== userSearchRequestSeqRef.current) {
            return;
          }
          console.error('Failed to search users:', err);
        } finally {
          if (!controller.signal.aborted && requestToken === userSearchRequestSeqRef.current) {
            setIsSearching(false);
          }
        }
      };

      void searchUsers();
    }, 300);

    return () => {
      clearTimeout(timer);
      userSearchRequestControllerRef.current?.abort();
    };
  }, [userSearch, user]);

  useEffect(() => {
    const userIdParam = searchParams.get('user');

    if (userIdParam) {
      if (!user) return;

      const clearInvalidUserSelection = (message: string) => {
        setSelectedUser(null);
        setMessages([]);
        setMessagesError(null);
        setUserBootstrapError(message);
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('user');
          return next;
        });
      };

      const conv = conversations.find(c => c.id === Number(userIdParam));
      if (conv) {
        setSelectedUser(conv);
        setUserBootstrapError(null);
        return;
      }

      const controller = new AbortController();

      const bootstrapSelectedUser = async () => {
        try {
          const res = await fetch(`/api/users/${userIdParam}`, { signal: controller.signal });
          if (controller.signal.aborted || searchParams.get('user') !== userIdParam) return;

          if (!res.ok) {
            clearInvalidUserSelection('Unable to open that conversation. Please choose a user from search.');
            return;
          }

          let userData: unknown;
          try {
            userData = await res.json();
          } catch {
            clearInvalidUserSelection('Unable to open that conversation right now. Please try again.');
            return;
          }

          if (
            userData &&
            typeof userData === 'object' &&
            'id' in userData &&
            String((userData as { id: number | string }).id) === userIdParam
          ) {
            const typedUserData = userData as { id: number; username: string; avatar_url: string | null };
            setSelectedUser({
              id: typedUserData.id,
              username: typedUserData.username,
              avatar_url: typedUserData.avatar_url,
              last_message: '',
              last_message_at: new Date().toISOString(),
              unread_count: 0
            });
            setUserBootstrapError(null);
            return;
          }

          clearInvalidUserSelection('That user could not be found. Please choose a valid recipient.');
        } catch (err) {
          if (controller.signal.aborted || searchParams.get('user') !== userIdParam) return;
          console.error('Failed to fetch user for message:', err);
          clearInvalidUserSelection('Unable to open conversation due to a network issue. Please try again.');
        }
      };

      void bootstrapSelectedUser();

      return () => {
        controller.abort();
      };
    } else {
      setSelectedUser(null);
      setMessages([]);
      setMessagesError(null);
      setUserBootstrapError(null);
    }
  }, [searchParams, conversations, user, setSearchParams]);

  useEffect(() => {
    if (!selectedUser || !user) return;

    fetchMessages(selectedUser.id);

    return () => {
      messagesRequestControllerRef.current?.abort();
    };
  }, [selectedUser, user]);

  useEffect(() => {
    if (!socket || !user) return;

    const onNewMessage = (message: Message) => {
      if (selectedUser && (message.sender_id === selectedUser.id || message.receiver_id === selectedUser.id)) {
        wasNearBottomRef.current = getIsNearBottom();
        setMessages(prev => dedupeMessagesById([...prev, message]));
      }
      scheduleConversationsRefresh();
    };

    socket.on('new_message', onNewMessage);

    return () => {
      // Use handler-specific cleanup so we don't remove listeners from other components/screens.
      socket.off('new_message', onNewMessage);
    };
  }, [socket, selectedUser, user]);

  if (authLoading) return <div className="h-full flex items-center justify-center text-neon-cyan animate-pulse">Initializing Neural Link...</div>;
  if (!user) return <Navigate to="/login" />;

  const mergeConversationsMonotonic = (nextConversations: Conversation[]) => {
    setConversations(prevConversations => {
      const previousById = new Map<number, Conversation>(prevConversations.map(conversation => [conversation.id, conversation]));
      const merged = nextConversations.map(conversation => {
        const previous = previousById.get(conversation.id);
        if (!previous) return conversation;

        const nextTime = new Date(conversation.last_message_at).getTime();
        const prevTime = new Date(previous.last_message_at).getTime();

        if (Number.isNaN(nextTime) || Number.isNaN(prevTime)) {
          return { ...conversation, unread_count: Math.max(conversation.unread_count, previous.unread_count) };
        }

        if (nextTime < prevTime) {
          return { ...previous, unread_count: Math.max(previous.unread_count, conversation.unread_count) };
        }

        return { ...conversation, unread_count: Math.max(conversation.unread_count, previous.unread_count) };
      });

      return merged.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });
  };

  async function fetchConversations() {
    conversationsRequestControllerRef.current?.abort();

    const controller = new AbortController();
    conversationsRequestControllerRef.current = controller;
    conversationsRequestSeqRef.current += 1;
    const requestToken = conversationsRequestSeqRef.current;

    try {
      const res = await fetch('/api/messages/conversations', { signal: controller.signal });
      if (!res.ok) return;

      const data = await res.json();
      if (controller.signal.aborted || requestToken !== conversationsRequestSeqRef.current) {
        return;
      }

      const conversationsData = Array.isArray(data) ? data : [];
      mergeConversationsMonotonic(conversationsData);
    } catch (err) {
      if (controller.signal.aborted || requestToken !== conversationsRequestSeqRef.current) {
        return;
      }
      console.error('Failed to fetch conversations:', err);
    } finally {
      if (!controller.signal.aborted && requestToken === conversationsRequestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }

  function scheduleConversationsRefresh(delayMs = 300) {
    if (conversationsRefreshTimerRef.current) {
      clearTimeout(conversationsRefreshTimerRef.current);
    }

    conversationsRefreshTimerRef.current = setTimeout(() => {
      fetchConversations();
      conversationsRefreshTimerRef.current = null;
    }, delayMs);
  }

  const fetchMessages = async (userId: number) => {
    messagesRequestControllerRef.current?.abort();

    const controller = new AbortController();
    messagesRequestControllerRef.current = controller;
    requestSeqRef.current += 1;
    const requestToken = requestSeqRef.current;

    setIsMessagesLoading(true);
    setMessagesError(null);

    try {
      const res = await fetch(`/api/messages/${userId}`, { signal: controller.signal });
      if (!res.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await res.json();
      const isStaleRequest = controller.signal.aborted || requestToken !== requestSeqRef.current || selectedUser?.id !== userId;
      if (isStaleRequest) {
        return;
      }

      wasNearBottomRef.current = getIsNearBottom();
      setMessages(dedupeMessagesById(data));
      setConversations(prev => prev.map(c => c.id === userId ? { ...c, unread_count: 0 } : c));
    } catch (err) {
      if (controller.signal.aborted || requestToken !== requestSeqRef.current || selectedUser?.id !== userId) {
        return;
      }

      console.error('Failed to fetch messages:', err);
      setMessagesError('Failed to load messages');
    } finally {
      if (!controller.signal.aborted && requestToken === requestSeqRef.current && selectedUser?.id === userId) {
        setIsMessagesLoading(false);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    try {
      const sentMessage = await sendMessage(selectedUser.id, newMessage);
      wasNearBottomRef.current = getIsNearBottom();
      setMessages(prev => dedupeMessagesById([...prev, sentMessage]));
      setNewMessage('');
      scheduleConversationsRefresh();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-120px)] min-h-0 md:min-h-[420px] bg-cyber-black/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Sidebar */}
      <div className={`w-full md:w-80 md:border-r border-white/5 flex flex-col min-h-0 bg-cyber-dark ${showSidebarOnMobile ? 'flex' : 'hidden'} md:flex`}>
        <div className="p-4 border-b border-white/5">
          <h2 className="text-xl font-orbitron font-bold text-neon-cyan mb-4 uppercase tracking-tighter italic">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-neon-cyan/50 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
          {userBootstrapError && (
            <div className="mx-3 mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {userBootstrapError}
            </div>
          )}
          {userSearch.length >= 2 ? (
            <div className="p-2 space-y-1">
              <p className="px-3 py-2 text-[10px] uppercase tracking-widest font-black text-zinc-600">Search Results</p>
              {isSearching ? (
                <div className="p-4 text-center text-zinc-500 text-xs animate-pulse">Scanning Network...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSearchParams({ user: u.id.toString() });
                      setUserSearch('');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-cyber-black border border-white/10 flex items-center justify-center text-sm font-black text-white group-hover:border-neon-cyan/50 transition-all overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                      ) : (
                        u.username?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-zinc-300 group-hover:text-white transition-colors">{u.username}</p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-tighter">Initialize Link</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-zinc-600 text-xs italic">No operatives found.</div>
              )}
            </div>
          ) : conversations.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-zinc-500">
              <p className="text-sm">No conversations yet.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedUser(conv);
                  setSearchParams({ user: conv.id.toString() });
                }}
                className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 text-left ${selectedUser?.id === conv.id ? 'bg-white/10' : ''}`}
              >
                <div className="relative">
                  {conv.avatar_url ? (
                    <img src={conv.avatar_url} alt={conv.username} className="w-12 h-12 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <User className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-neon-pink text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-neon-pink/50">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-zinc-200 truncate">{conv.username}</span>
                    <span className="text-[10px] text-zinc-500">{format(new Date(conv.last_message_at), 'HH:mm')}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{conv.last_message}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`w-full flex-1 min-h-0 flex-col bg-cyber-black/20 ${showChatOnMobile ? 'flex' : 'hidden'} md:flex`}>
        {selectedUser ? (
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-cyber-black/40">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchParams({});
                  }}
                  className="md:hidden inline-flex items-center justify-center text-zinc-400 hover:text-neon-cyan transition-colors"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt={selectedUser.username} className="w-10 h-10 rounded-full object-cover border border-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <User className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-medium text-zinc-200">{selectedUser.username}</h3>
                  <span className="text-[10px] text-neon-green uppercase tracking-wider">Online</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <button
                  type="button"
                  className="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Start voice call (coming soon)"
                  title="Start voice call (coming soon)"
                  disabled
                >
                  <Phone className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Start video call (coming soon)"
                  title="Start video call (coming soon)"
                  disabled
                >
                  <Video className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="View conversation info (coming soon)"
                  title="View conversation info (coming soon)"
                  disabled
                >
                  <Info className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Open conversation menu (coming soon)"
                  title="Open conversation menu (coming soon)"
                  disabled
                >
                  <MoreVertical className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4">
              {isMessagesLoading && (
                <div className="text-center text-zinc-500 text-xs animate-pulse">Loading messages...</div>
              )}
              {messagesError && !isMessagesLoading && (
                <div className="text-center text-red-400 text-xs">{messagesError}</div>
              )}
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user?.id;
                const showDate = idx === 0 || format(new Date(messages[idx-1].created_at), 'yyyy-MM-dd') !== format(new Date(msg.created_at), 'yyyy-MM-dd');

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-6">
                        <span className="text-[10px] uppercase tracking-widest text-zinc-600 bg-white/5 px-3 py-1 rounded-full">
                          {format(new Date(msg.created_at), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isMe ? 'order-1' : 'order-2'}`}>
                        <div className={`p-3 rounded-2xl text-sm ${
                          isMe 
                            ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-tr-none shadow-[0_0_15px_rgba(0,243,255,0.1)]' 
                            : 'bg-white/5 text-zinc-300 border border-white/10 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                        <span className={`text-[10px] text-zinc-600 mt-1 block ${isMe ? 'text-right' : 'text-left'}`}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-cyber-black/40 border-t border-white/5">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..." 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-cyan/50 transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-neon-cyan text-black p-3 rounded-xl hover:bg-white transition-all hover:shadow-[0_0_20px_rgba(0,243,255,0.5)] disabled:opacity-50 disabled:hover:shadow-none"
                  aria-label="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
              <Send className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-xl font-orbitron font-bold text-zinc-400 mb-2">SELECT A CONVERSATION</h3>
            <p className="max-w-xs text-sm">Choose a user from the sidebar or visit a profile to start a new direct transmission.</p>
          </div>
        )}
      </div>
    </div>
  );
}
