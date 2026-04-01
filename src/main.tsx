import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { apiFetch } from './lib/api';

if (typeof window !== 'undefined' && window.fetch) {
  window.fetch = apiFetch as typeof window.fetch;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
