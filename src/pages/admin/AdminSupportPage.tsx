import React, { useState } from 'react';
import { apiJson } from '../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Ticket, 
  Search, 
  Filter, 
  Clock, 
  User, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronRight,
  Send,
  Shield,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface SupportTicket {
  id: number;
  user_id: number;
  author_name: string;
  author_avatar: string;
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

const AdminSupportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: tickets, isLoading: isLoadingTickets } = useQuery<SupportTicket[]>({
    queryKey: ['admin-tickets'],
    queryFn: () => apiJson<SupportTicket[]>('/api/admin/tickets')
  });

  const { data: ticketDetail, isLoading: isLoadingDetail } = useQuery<{ ticket: SupportTicket, messages: TicketMessage[] }>({
    queryKey: ['admin-ticket', selectedTicketId],
    queryFn: () => apiJson<{ ticket: SupportTicket, messages: TicketMessage[] }>(`/api/admin/tickets/${selectedTicketId}`),
    enabled: !!selectedTicketId
  });

  const replyMutation = useMutation({
    mutationFn: (message: string) => apiJson(`/api/admin/tickets/${selectedTicketId}/messages`, {
      method: 'POST',
      json: { message }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      setReplyMessage('');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiJson(`/api/admin/tickets/${selectedTicketId}`, {
      method: 'PATCH',
      json: { status }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket', selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    }
  });

  const filteredTickets = tickets?.filter(t => filterStatus === 'all' || t.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/20';
      case 'pending': return 'text-neon-yellow bg-neon-yellow/10 border-neon-yellow/20';
      case 'closed': return 'text-zinc-500 bg-white/5 border-white/10';
      default: return 'text-zinc-400 bg-white/5 border-white/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-neon-pink';
      case 'medium': return 'text-neon-yellow';
      case 'low': return 'text-neon-cyan';
      default: return 'text-zinc-400';
    }
  };

  if (isLoadingTickets) return <div className="animate-pulse space-y-8">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-white/5 rounded-3xl" />)}</div>;

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-8">
      {/* Tickets List */}
      <div className={`flex-1 flex flex-col gap-8 ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">Support <span className="text-neon-cyan neon-glow-cyan">Terminal</span></h1>
            <p className="text-zinc-500 font-medium uppercase tracking-widest text-xs">Operative Assistance // Resolution Protocols</p>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-cyber-black border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:border-neon-cyan/50 outline-none"
            >
              <option value="all">All Channels</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {filteredTickets?.map((ticket) => (
            <motion.button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`w-full text-left p-6 cyber-card border-white/5 hover:border-neon-cyan/30 transition-all flex items-center gap-6 group ${selectedTicketId === ticket.id ? 'border-neon-cyan/50 bg-neon-cyan/5' : ''}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-cyber-black border border-white/10 flex items-center justify-center ${selectedTicketId === ticket.id ? 'border-neon-cyan/50' : 'group-hover:border-neon-cyan/30'}`}>
                <Ticket className={`w-6 h-6 ${selectedTicketId === ticket.id ? 'text-neon-cyan' : 'text-zinc-700 group-hover:text-neon-cyan'}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  {ticket.ticket_type === 'admin_support' && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-neon-pink/10 border-neon-pink/20 text-neon-pink">
                      Admin Support
                    </span>
                  )}
                  <span className={`text-[8px] font-black uppercase tracking-widest ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority} Priority
                  </span>
                  <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest ml-auto">ID: {ticket.id}</span>
                </div>
                <h3 className="text-sm font-black text-white uppercase italic tracking-tight line-clamp-1">{ticket.subject}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    <User className="w-3 h-3" /> {ticket.author_name}
                  </div>
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
          {filteredTickets?.length === 0 && (
            <div className="p-12 text-center cyber-card border-white/5 bg-white/[0.02]">
              <Ticket className="w-12 h-12 text-zinc-800 mx-auto mb-4 opacity-20" />
              <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">No active support transmissions found</p>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className={`flex-[1.5] flex flex-col cyber-card border-white/5 overflow-hidden ${selectedTicketId ? 'flex' : 'hidden lg:flex items-center justify-center bg-white/[0.01]'}`}>
        {selectedTicketId ? (
          <>
            {/* Header */}
            <div className="p-8 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setSelectedTicketId(null)}
                  className="lg:hidden p-2 text-zinc-500 hover:text-white"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">{ticketDetail?.ticket.subject}</h2>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStatusColor(ticketDetail?.ticket.status || '')}`}>
                      {ticketDetail?.ticket.status}
                    </span>
                    {ticketDetail?.ticket.ticket_type === 'admin_support' && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-neon-pink/10 border-neon-pink/20 text-neon-pink">
                        Admin Support
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Opened by <span className="text-white">{ticketDetail?.ticket.author_name}</span> // {ticketDetail?.ticket.created_at && formatDistanceToNow(new Date(ticketDetail.ticket.created_at))} ago
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {ticketDetail?.ticket.status !== 'closed' ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate('closed')}
                    className="flex items-center gap-2 px-4 py-2 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-pink hover:text-white transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Close Ticket
                  </button>
                ) : (
                  <button 
                    onClick={() => updateStatusMutation.mutate('open')}
                    className="flex items-center gap-2 px-4 py-2 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-cyan hover:text-white transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Reopen Ticket
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {ticketDetail?.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.author_role === 'admin' || msg.author_role === 'moderator' ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-lg bg-cyber-black border border-white/10 overflow-hidden flex-shrink-0">
                    {msg.author_avatar ? (
                      <img src={msg.author_avatar} alt={msg.author_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className={`max-w-[80%] space-y-2 ${msg.author_role === 'admin' || msg.author_role === 'moderator' ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 ${msg.author_role === 'admin' || msg.author_role === 'moderator' ? 'flex-row-reverse' : ''}`}>
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

            {/* Reply Input */}
            <div className="p-8 bg-white/[0.02] border-t border-white/5">
              <div className="relative">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Enter resolution protocol..."
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
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Ticket className="w-10 h-10 text-zinc-800" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Select Transmission</h3>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Select a ticket from the terminal to begin resolution</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSupportPage;
