import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiTarget = env.VITE_API_TARGET || 'http://192.168.42.111:8000';
    const wsTarget = env.VITE_WS_TARGET || apiTarget;
    const wsTargetIsHttps = wsTarget.startsWith('https');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Proxy all API requests to backend to bypass CORS
          '/api': {
            target: apiTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            configure: (proxy, _options) => {
              proxy.on('error', (_err, _req, _res) => {});
              proxy.on('proxyReq', (_proxyReq, _req, _res) => {});
            },
          },
          // Proxy WebSocket to backend (must match API target for session auth)
          '/ws': {
            target: wsTarget,
            ws: true,
            changeOrigin: true,
            secure: wsTargetIsHttps,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});



