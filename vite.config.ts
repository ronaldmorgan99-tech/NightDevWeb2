import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Detect GitHub Codespaces environment
  const isCodespaces = process.env.CODESPACES === 'true';
  
  // Configure HMR based on environment
  let hmrConfig = env.DISABLE_HMR !== 'true';
  if (hmrConfig && isCodespaces) {
    // For GitHub Codespaces: use secure WebSocket with forwarded domain
    hmrConfig = {
      protocol: 'wss',
      host: process.env.CODESPACE_NAME ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'}` : 'localhost',
      port: 443,
      clientPort: 443,
    };
  } else if (hmrConfig) {
    // For local dev: configure to match actual server port
    hmrConfig = {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
    };
  }
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: hmrConfig,
    },
  };
});
