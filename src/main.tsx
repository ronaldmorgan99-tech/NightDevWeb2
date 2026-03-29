import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase();
    const csrfToken = localStorage.getItem('csrfToken');

    const shouldAttach = csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const headers = new Headers(init?.headers as HeadersInit || {});

    if (shouldAttach && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrfToken);
    }

    return originalFetch(input, { ...init, headers });
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
