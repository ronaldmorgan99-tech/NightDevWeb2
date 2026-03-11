import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: number;
  created_at: string;
}

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string;
  link: string;
  is_read: number;
  created_at: string;
}

interface MessagingContextType {
  socket: Socket | null;
  notifications: Notification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  sendMessage: (receiverId: number, content: string) => Promise<Message>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('new_notification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
        // Optional: Show a toast or play a sound
      });

      fetchNotifications();

      return () => {
        newSocket.close();
      };
    } else {
      setSocket(null);
      setNotifications([]);
    }
  }, [user, fetchNotifications]);

  const markNotificationAsRead = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const sendMessage = async (receiverId: number, content: string) => {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, content })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  };

  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;

  return (
    <MessagingContext.Provider value={{ 
      socket, 
      notifications, 
      unreadNotificationsCount, 
      markNotificationAsRead, 
      markAllNotificationsAsRead,
      sendMessage
    }}>
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
};
