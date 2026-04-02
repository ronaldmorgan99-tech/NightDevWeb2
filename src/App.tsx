/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { MessagingProvider } from './context/MessagingContext';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
const ForumsPage = lazy(() => import('./pages/ForumsPage'));
const ForumViewPage = lazy(() => import('./pages/ForumViewPage'));
const ThreadViewPage = lazy(() => import('./pages/ThreadViewPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminSectorsPage = lazy(() => import('./pages/admin/AdminSectorsPage'));
const AdminTagsPage = lazy(() => import('./pages/admin/AdminTagsPage'));
const AdminStorePage = lazy(() => import('./pages/admin/AdminStorePage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminIntegrationsPage = lazy(() => import('./pages/admin/AdminIntegrationsPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const StorePage = lazy(() => import('./pages/StorePage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CreateThreadPage = lazy(() => import('./pages/CreateThreadPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const DiscordPage = lazy(() => import('./pages/DiscordPage'));
const ServersPage = lazy(() => import('./pages/ServersPage'));
const VeoStudioPage = lazy(() => import('./pages/VeoStudioPage'));
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));

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
  const isStudioEnabled = (import.meta as any).env.VITE_ENABLE_STUDIO === 'true';

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MessagingProvider>
          <CustomCursor />
          <BrowserRouter>
            <Suspense fallback={<div>Loading...</div>}>
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
            </Suspense>
          </BrowserRouter>
        </MessagingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
