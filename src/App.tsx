/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { MessagingProvider } from './context/MessagingContext';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ForumsPage from './pages/ForumsPage';
import ForumViewPage from './pages/ForumViewPage';
import ThreadViewPage from './pages/ThreadViewPage';
import ProfilePage from './pages/ProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminSectorsPage from './pages/admin/AdminSectorsPage';
import AdminTagsPage from './pages/admin/AdminTagsPage';
import AdminStorePage from './pages/admin/AdminStorePage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminIntegrationsPage from './pages/admin/AdminIntegrationsPage';
import AdminSupportPage from './pages/admin/AdminSupportPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StorePage from './pages/StorePage';
import MembersPage from './pages/MembersPage';
import SupportPage from './pages/SupportPage';
import HelpPage from './pages/HelpPage';
import SettingsPage from './pages/SettingsPage';
import CreateThreadPage from './pages/CreateThreadPage';
import MessagesPage from './pages/MessagesPage';
import DiscordPage from './pages/DiscordPage';
import ServersPage from './pages/ServersPage';
import VeoStudioPage from './pages/VeoStudioPage';
import ComingSoonPage from './pages/ComingSoonPage';

const queryClient = new QueryClient();

const CustomCursor = () => {
  useEffect(() => {
    const cursor = document.querySelector('.custom-cursor') as HTMLElement;
    if (!cursor) return;

    let rafId: number;
    const handlePointerMove = (e: PointerEvent) => {
      rafId = requestAnimationFrame(() => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
        
        const target = e.target as HTMLElement;
        const isClickable = !!target?.closest('a, button, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], select, label, .cursor-pointer');
        
        if (isClickable) {
          cursor.classList.add('scale-150');
        } else {
          cursor.classList.remove('scale-150');
        }
      });
    };

    const handlePointerDown = () => cursor.classList.add('scale-75');
    const handlePointerUp = () => cursor.classList.remove('scale-75');

    window.addEventListener('pointermove', handlePointerMove, { passive: true, capture: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div 
      className="custom-cursor cursor-glow"
      style={{ 
        transform: 'translate(-2px, -2px)',
        left: '-100px',
        top: '-100px'
      }} 
    />
  );
};

export default function App() {
  const isStudioEnabled = import.meta.env.VITE_ENABLE_STUDIO === 'true';

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MessagingProvider>
          <CustomCursor />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<ForumsPage />} />
                <Route path="forums/:id" element={<ForumViewPage />} />
                <Route path="forums/:id/new" element={<CreateThreadPage />} />
                <Route path="threads/:id" element={<ThreadViewPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/:id" element={<ProfilePage />} />
                <Route path="store" element={<StorePage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="help" element={<HelpPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="discord" element={<DiscordPage />} />
                <Route path="servers" element={<ServersPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="studio" element={isStudioEnabled ? <VeoStudioPage /> : <ComingSoonPage />} />
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="moderation" element={<AdminModerationPage />} />
                <Route path="forums" element={<AdminSectorsPage />} />
                <Route path="tags" element={<AdminTagsPage />} />
                <Route path="store" element={<AdminStorePage />} />
                <Route path="integrations" element={<AdminIntegrationsPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </MessagingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
