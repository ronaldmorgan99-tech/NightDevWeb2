import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Ticket, 
  Plus, 
  Clock, 
  MessageSquare, 
  ChevronRight, 
  Send, 
  User, 
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Gamepad2,
  LifeBuoy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';

interface SupportTicket {
  id: number;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  priority: 'low' | 'medium' | 'high';
  ticket_type: 'user' | 'admin_support';
  message_count: number;
  created_at: string;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  author_name: string;
  author_avatar: string;
  author_role: string;
  message: string;
  created_at: string;
}

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const SupportPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', priority: 'medium', ticket_type: 'user' });
  const [replyMessage, setReplyMessage] = useState('');

  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ['site-settings'],
    queryFn: () => fetch('/api/settings').then(res => res.json())
  });

  const { data: tickets, isLoading: isLoadingTickets } = useQuery<SupportTicket[]>({
    queryKey: ['user-tickets'],
    queryFn: () => fetch('/api/tickets').then(res => res.json()),
    enabled: !!user
  });

  const { data: ticketDetail, isLoading: isLoadingDetail } = useQuery<{ ticket: SupportTicket, messages: TicketMessage[] }>({
    queryKey: ['user-ticket', selectedTicketId],
    queryFn: () => fetch(`/api/tickets/${selectedTicketId}`).then(res => res.json()),
    enabled: !!selectedTicketId
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newTicket) => fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      setIsCreateModalOpen(false);
      setNewTicket({ subject: '', message: '', priority: 'medium', ticket_type: 'user' });
    }
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) => fetch(`/api/tickets/${selectedTicketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-ticket', selectedTicketId] });
      setReplyMessage('');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20';
      case 'pending': return 'text-neon-yellow bg-neon-yellow/10 border-neon-yellow/20';
      case 'closed': return 'text-zinc-500 bg-white/5 border-white/10';
      default: return 'text-zinc-400 bg-white/5 border-white/10';
    }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        <Shield className="w-10 h-10 text-zinc-800" />
      </div>
      <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2 text-glow-white">Access Denied</h2>
      <p className="text-zinc-500 text-xs uppercase tracking-widest font-black">Authentication required to access support uplink</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Support <span className="text-neon-cyan neon-glow-cyan">Uplink</span></h1>
          <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Direct Transmission // Technical Assistance</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-neon-cyan text-cyber-black rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,243,255,0.3)]"
        >
          <Plus className="w-4 h-4" /> New Transmission
        </button>
      </div>

      {/* Intelligence & Support Uplinks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* X Intelligence */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 cyber-card border-neon-cyan/20 bg-gradient-to-br from-neon-cyan/5 to-transparent flex flex-col justify-between gap-6 group"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-neon-cyan/30 flex items-center justify-center p-3 shadow-[0_0_15px_rgba(0,243,255,0.1)] group-hover:shadow-[0_0_25px_rgba(0,243,255,0.2)] transition-all">
              <div className="w-full h-full text-neon-cyan">
                <XIcon />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Network <span className="text-neon-cyan">Intelligence</span></h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 leading-relaxed">Follow the digital underground on X for real-time updates and announcements</p>
            </div>
          </div>
          <a 
            href={siteSettings?.x_account_url || "https://x.com/NightRespawn"} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all flex items-center justify-center gap-3"
          >
            Connect Uplink <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Discord Support */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 cyber-card border-neon-purple/20 bg-gradient-to-br from-neon-purple/5 to-transparent flex flex-col justify-between gap-6 group"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-neon-purple/30 flex items-center justify-center shadow-[0_0_15px_rgba(191,0,255,0.1)] group-hover:shadow-[0_0_25px_rgba(191,0,255,0.2)] transition-all">
              <Gamepad2 className="w-7 h-7 text-neon-purple" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Support <span className="text-neon-purple">Terminal</span></h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 leading-relaxed">Live Discord Assistance</p>
            </div>
          </div>
          <a 
            href="https://discord.gg/NZbmQNxX" 
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-neon-purple/50 hover:bg-neon-purple/5 transition-all flex items-center justify-center gap-3"
          >
            Join Discord <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Knowledge Base */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 cyber-card border-neon-green/20 bg-gradient-to-br from-neon-green/5 to-transparent flex flex-col justify-between gap-6 group"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-cyber-black border border-neon-green/30 flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.1)] group-hover:shadow-[0_0_25px_rgba(57,255,20,0.2)] transition-all">
              <LifeBuoy className="w-7 h-7 text-neon-green" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Knowledge <span className="text-neon-green">Base</span></h3>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1.5 leading-relaxed">Guides & Documentation</p>
            </div>
          </div>
          <a 
            href="/help" 
            className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-neon-green/50 hover:bg-neon-green/5 transition-all flex items-center justify-center gap-3"
          >
            Access Archives <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-8 h-[calc(100vh-20rem)]">
        {/* Tickets List */}
        <div className={`col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
          {tickets?.map((ticket) => (
            <motion.button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full text-left p-6 cyber-card border-white/5 hover:border-neon-cyan/30 transition-all flex items-center gap-4 group ${selectedTicketId === ticket.id ? 'border-neon-cyan/50 bg-neon-cyan/5' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  {ticket.ticket_type === 'admin_support' && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-neon-pink/10 border-neon-pink/20 text-neon-pink">
                      Admin Support
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest ml-auto">ID: {ticket.id}</span>
                </div>
                <h3 className="text-sm font-black text-white uppercase italic tracking-tight line-clamp-1">{ticket.subject}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(ticket.created_at))} ago
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    <MessageSquare className="w-3 h-3" /> {ticket.message_count}
                  </div>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-zinc-800 transition-transform ${selectedTicketId === ticket.id ? 'translate-x-1 text-neon-cyan' : 'group-hover:translate-x-1 group-hover:text-neon-cyan'}`} />
            </motion.button>
          ))}
          {tickets?.length === 0 && (
            <div className="p-12 text-center cyber-card border-white/5 bg-white/[0.02]">
              <Ticket className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20" />
              <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No active transmissions found</p>
            </div>
          )}
        </div>

        {/* Ticket Detail */}
        <div className={`col-span-12 lg:col-span-8 flex flex-col cyber-card border-white/5 overflow-hidden ${selectedTicketId ? 'flex' : 'hidden lg:flex items-center justify-center bg-white/[0.01]'}`}>
          {selectedTicketId ? (
            <>
              <div className="p-8 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedTicketId(null)} className="lg:hidden p-2 text-zinc-500 hover:text-white">
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">{ticketDetail?.ticket.subject}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(ticketDetail?.ticket.status || '')}`}>
                        {ticketDetail?.ticket.status}
                      </span>
                      {ticketDetail?.ticket.ticket_type === 'admin_support' && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-neon-pink/10 border-neon-pink/20 text-neon-pink">
                          Admin Support
                        </span>
                      )}
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                        Opened {ticketDetail?.ticket.created_at && formatDistanceToNow(new Date(ticketDetail.ticket.created_at))} ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {ticketDetail?.messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.user_id === user.id ? '' : 'flex-row-reverse'}`}>
                    <div className="w-10 h-10 rounded-lg bg-cyber-black border border-white/10 overflow-hidden flex-shrink-0">
                      {msg.author_avatar ? (
                        <img src={msg.author_avatar} alt={msg.author_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[80%] space-y-2 ${msg.user_id === user.id ? '' : 'text-right'}`}>
                      <div className={`flex items-center gap-2 ${msg.user_id === user.id ? '' : 'flex-row-reverse'}`}>
                        <span className="text-[10px] font-black text-white uppercase italic tracking-tight">{msg.author_name}</span>
                        {(msg.author_role === 'admin' || msg.author_role === 'moderator') && (
                          <span className="text-[8px] font-black text-neon-cyan uppercase tracking-widest px-1.5 py-0.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded flex items-center gap-1">
                            <Shield className="w-2 h-2" /> Staff
                          </span>
                        )}
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">
                          {formatDistanceToNow(new Date(msg.created_at))} ago
                        </span>
                      </div>
                      <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                        msg.author_role === 'admin' || msg.author_role === 'moderator' 
                          ? 'bg-neon-cyan/10 border border-neon-cyan/20 text-white rounded-tr-none' 
                          : 'bg-white/5 border border-white/10 text-zinc-300 rounded-tl-none'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {ticketDetail?.ticket.status !== 'closed' && (
                <div className="p-8 bg-white/[0.02] border-t border-white/5">
                  <div className="relative">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Enter response..."
                      className="w-full bg-cyber-black border border-white/10 rounded-2xl px-6 py-4 pr-16 text-sm text-white focus:border-neon-cyan/50 outline-none resize-none transition-all"
                      rows={3}
                    />
                    <button 
                      onClick={() => replyMutation.mutate(replyMessage)}
                      disabled={!replyMessage.trim() || replyMutation.isPending}
                      className="absolute bottom-4 right-4 p-3 bg-neon-cyan text-cyber-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_0_15px_rgba(0,243,255,0.3)]"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                <Ticket className="w-10 h-10 text-zinc-800" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Select Transmission</h3>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Select a ticket from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="fixed inset-0 bg-cyber-bg/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-xl bg-cyber-dark border border-white/5 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative z-10"
            >
              <div className="p-8 border-b border-white/5">
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">New <span className="text-neon-cyan">Transmission</span></h2>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Initialize technical support protocol</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subject</label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    placeholder="Brief description of the issue"
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Priority Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setNewTicket({ ...newTicket, priority: p as any })}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newTicket.priority === p 
                            ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' 
                            : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {(user.role === 'admin' || user.role === 'moderator') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Transmission Channel</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setNewTicket({ ...newTicket, ticket_type: 'user' })}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newTicket.ticket_type === 'user' 
                            ? 'bg-neon-cyan/10 border-neon-cyan text-neon-cyan' 
                            : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'
                        }`}
                      >
                        Standard Support
                      </button>
                      <button
                        onClick={() => setNewTicket({ ...newTicket, ticket_type: 'admin_support' })}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          newTicket.ticket_type === 'admin_support' 
                            ? 'bg-neon-pink/10 border-neon-pink text-neon-pink' 
                            : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'
                        }`}
                      >
                        Admin Direct
                      </button>
                    </div>
                    <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-black">Admin Direct transmissions are only visible to high-clearance administrators.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Message</label>
                  <textarea
                    value={newTicket.message}
                    onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                    placeholder="Provide detailed information..."
                    className="w-full bg-cyber-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-neon-cyan/50 outline-none transition-all min-h-[150px] resize-none"
                  />
                </div>
              </div>

              <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-4 bg-white/5 text-zinc-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={() => createMutation.mutate(newTicket)}
                  disabled={!newTicket.subject || !newTicket.message || createMutation.isPending}
                  className="flex-[2] py-4 bg-neon-cyan text-cyber-black rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                >
                  Initialize Uplink
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportPage;
