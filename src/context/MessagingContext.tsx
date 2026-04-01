import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiFetch, apiJson } from '../lib/api';

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
      const data = await apiJson<Notification[]>('/api/notifications');
      setNotifications(data);
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
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const sendMessage = async (receiverId: number, content: string) => {
    return apiJson<Message>('/api/messages', {
      method: 'POST',
      json: { receiver_id: receiverId, content }
    });
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
