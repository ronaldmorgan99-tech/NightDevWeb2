import React, { useState, useRef, useEffect } from 'react';
import { Bell, MessageSquare, AtSign, Reply, Info, Check, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMessaging } from '../context/MessagingContext';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router';

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadNotificationsCount, markNotificationAsRead, markAllNotificationsAsRead } = useMessaging();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4 text-neon-cyan" />;
      case 'mention': return <AtSign className="w-4 h-4 text-neon-pink" />;
      case 'reply': return <Reply className="w-4 h-4 text-neon-purple" />;
      default: return <Info className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-neon-cyan/50 transition-all group"
      >
        <Bell className={`w-5 h-5 transition-colors ${unreadNotificationsCount > 0 ? 'text-neon-cyan animate-pulse' : 'text-zinc-400 group-hover:text-white'}`} />
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-neon-pink text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg shadow-neon-pink/50">
            {unreadNotificationsCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-cyber-black/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <h3 className="font-orbitron font-bold text-sm text-neon-cyan">NOTIFICATIONS</h3>
              {unreadNotificationsCount > 0 && (
                <button 
                  onClick={markAllNotificationsAsRead}
                  className="text-[10px] text-zinc-500 hover:text-neon-cyan transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> MARK ALL READ
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No notifications yet.</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors relative group ${!notif.is_read ? 'bg-neon-cyan/5' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-1">{getIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-xs font-bold truncate ${!notif.is_read ? 'text-neon-cyan' : 'text-zinc-300'}`}>
                            {notif.title}
                          </h4>
                          <span className="text-[9px] text-zinc-600 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2">{notif.content}</p>
                        <div className="flex items-center gap-3">
                          {notif.link && (
                            <Link 
                              to={notif.link}
                              onClick={() => {
                                setIsOpen(false);
                                markNotificationAsRead(notif.id);
                              }}
                              className="text-[10px] text-neon-cyan hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> VIEW
                            </Link>
                          )}
                          {!notif.is_read && (
                            <button 
                              onClick={() => markNotificationAsRead(notif.id)}
                              className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> DISMISS
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-white/5 border-t border-white/10 text-center">
              <button className="text-[10px] text-zinc-500 hover:text-white transition-colors">
                VIEW ALL NOTIFICATIONS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
