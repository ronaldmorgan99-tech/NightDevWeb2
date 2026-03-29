import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Search, MoreVertical, Phone, Video, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import { format } from 'date-fns';
import { useSearchParams, Navigate } from 'react-router';

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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const wasNearBottomRef = useRef(true);

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

  useEffect(() => {
    const searchUsers = async () => {
      if (userSearch.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/members?search=${userSearch}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: any) => u.id !== user?.id));
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [userSearch, user]);

  useEffect(() => {
    const userIdParam = searchParams.get('user');
    if (userIdParam && user) {
      const conv = conversations.find(c => c.id === Number(userIdParam));
      if (conv) {
        setSelectedUser(conv);
      } else {
        // If not in conversations, fetch user info
        fetch(`/api/users/${userIdParam}`)
          .then(res => res.json())
          .then(userData => {
            if (userData && userData.id) {
              setSelectedUser({
                id: userData.id,
                username: userData.username,
                avatar_url: userData.avatar_url,
                last_message: '',
                last_message_at: new Date().toISOString(),
                unread_count: 0
              });
            }
          })
          .catch(err => console.error('Failed to fetch user for message:', err));
      }
    }
  }, [searchParams, conversations, user]);

  useEffect(() => {
    if (selectedUser && user) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser, user]);

  useEffect(() => {
    if (socket && user) {
      socket.on('new_message', (message: Message) => {
        if (selectedUser && (message.sender_id === selectedUser.id || message.receiver_id === selectedUser.id)) {
          wasNearBottomRef.current = getIsNearBottom();
          setMessages(prev => dedupeMessagesById([...prev, message]));
        }
        fetchConversations();
      });

      return () => {
        socket.off('new_message');
      };
    }
  }, [socket, selectedUser, user]);

  if (authLoading) return <div className="h-full flex items-center justify-center text-neon-cyan animate-pulse">Initializing Neural Link...</div>;
  if (!user) return <Navigate to="/login" />;

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (userId: number) => {
    try {
      const res = await fetch(`/api/messages/${userId}`);
      if (res.ok) {
        const data = await res.json();
        wasNearBottomRef.current = getIsNearBottom();
        setMessages(dedupeMessagesById(data));
        // Update unread count locally
        setConversations(prev => prev.map(c => c.id === userId ? { ...c, unread_count: 0 } : c));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
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
      fetchConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-cyber-black/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-cyber-dark">
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
        
        <div className="flex-1 overflow-y-auto">
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
                        u.username.charAt(0).toUpperCase()
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
      <div className="flex-1 flex flex-col bg-cyber-black/20">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-cyber-black/40">
              <div className="flex items-center gap-3">
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
                <button className="hover:text-neon-cyan transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="hover:text-neon-cyan transition-colors"><Video className="w-5 h-5" /></button>
                <button className="hover:text-neon-cyan transition-colors"><Info className="w-5 h-5" /></button>
                <button className="hover:text-neon-cyan transition-colors"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
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
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
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
