import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite Configuration
 * 
 * Environment Variables:
 * - Vite automatically loads .env.local file
 * - Only variables prefixed with VITE_ are exposed to client code
 * - Access via import.meta.env.VITE_* in client code
 * - Server-side variables (like GEMINI_API_KEY) are loaded via loadEnv()
 */
export default defineConfig(({ mode }) => {
    // Load environment variables from .env.local
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
