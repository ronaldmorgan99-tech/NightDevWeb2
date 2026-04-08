import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { apiFetch } from './lib/api';
import { FrontendErrorBoundary, initializeFrontendMonitoring } from './lib/monitoring';

initializeFrontendMonitoring();

if (typeof window !== 'undefined' && window.fetch) {
  window.fetch = apiFetch as typeof window.fetch;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FrontendErrorBoundary fallback={<p>Something went wrong. The incident has been reported.</p>}>
      <App />
    </FrontendErrorBoundary>
  </StrictMode>,
);
