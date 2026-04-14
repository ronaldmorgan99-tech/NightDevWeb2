/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { MessagingProvider } from './context/MessagingContext';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

// Loading fallback component for lazy-loaded routes
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-cyber-black">
    <div className="text-center">
      <div className="animate-pulse mb-4">
        <div className="w-16 h-16 bg-neon-cyan/20 rounded-lg mx-auto"></div>
      </div>
      <p className="text-neon-cyan text-sm uppercase tracking-widest">Loading...</p>
    </div>
  </div>
);
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
const StudioUnavailablePage = lazy(() => import('./pages/ComingSoonPage'));
const VeoStudioPage = lazy(() => import('./pages/VeoStudioPage'));

const queryClient = new QueryClient();
const isStudioDiscoverable = String(import.meta.env.VITE_ENABLE_STUDIO || '').toLowerCase() === 'true';

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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MessagingProvider>
          <CustomCursor />
          <HashRouter>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<Suspense fallback={<LoadingFallback />}><ForumsPage /></Suspense>} />
                <Route path="forums/:id" element={<Suspense fallback={<LoadingFallback />}><ForumViewPage /></Suspense>} />
                <Route path="forums/:id/new" element={<Suspense fallback={<LoadingFallback />}><CreateThreadPage /></Suspense>} />
                <Route path="threads/:id" element={<Suspense fallback={<LoadingFallback />}><ThreadViewPage /></Suspense>} />
                <Route path="members" element={<Suspense fallback={<LoadingFallback />}><MembersPage /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense>} />
                <Route path="profile/:id" element={<Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense>} />
                <Route path="store" element={<Suspense fallback={<LoadingFallback />}><StorePage /></Suspense>} />
                <Route path="support" element={<Suspense fallback={<LoadingFallback />}><SupportPage /></Suspense>} />
                <Route path="help" element={<Suspense fallback={<LoadingFallback />}><HelpPage /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<LoadingFallback />}><SettingsPage /></Suspense>} />
                <Route path="messages" element={<Suspense fallback={<LoadingFallback />}><MessagesPage /></Suspense>} />
                <Route path="discord" element={<Suspense fallback={<LoadingFallback />}><DiscordPage /></Suspense>} />
                <Route path="servers" element={<Suspense fallback={<LoadingFallback />}><ServersPage /></Suspense>} />
                <Route path="login" element={<Suspense fallback={<LoadingFallback />}><LoginPage /></Suspense>} />
                <Route path="register" element={<Suspense fallback={<LoadingFallback />}><RegisterPage /></Suspense>} />
                <Route
                  path="studio"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      {isStudioDiscoverable ? <VeoStudioPage /> : <StudioUnavailablePage />}
                    </Suspense>
                  }
                />
              </Route>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>} />
                <Route path="users" element={<Suspense fallback={<LoadingFallback />}><AdminUsersPage /></Suspense>} />
                <Route path="moderation" element={<Suspense fallback={<LoadingFallback />}><AdminModerationPage /></Suspense>} />
                <Route path="forums" element={<Suspense fallback={<LoadingFallback />}><AdminSectorsPage /></Suspense>} />
                <Route path="tags" element={<Suspense fallback={<LoadingFallback />}><AdminTagsPage /></Suspense>} />
                <Route path="store" element={<Suspense fallback={<LoadingFallback />}><AdminStorePage /></Suspense>} />
                <Route path="integrations" element={<Suspense fallback={<LoadingFallback />}><AdminIntegrationsPage /></Suspense>} />
                <Route path="analytics" element={<Suspense fallback={<LoadingFallback />}><AdminAnalyticsPage /></Suspense>} />
                <Route path="support" element={<Suspense fallback={<LoadingFallback />}><AdminSupportPage /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<LoadingFallback />}><AdminSettingsPage /></Suspense>} />
              </Route>
            </Routes>
          </HashRouter>
        </MessagingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
