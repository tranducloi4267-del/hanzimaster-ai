import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { synthesizeEdgeTts } from './electron/edgeTts';

function edgeTtsDevProxyPlugin(): Plugin {
  return {
    name: 'edge-tts-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/edge-tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          const audio = await synthesizeEdgeTts({
            text: String(body.text || ''),
            voice: body.voice,
            rate: Number(body.rate || 1.0)
          });
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(audio);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Edge TTS proxy error'
            })
          );
        }
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), edgeTtsDevProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'lucide-react'],
          db: ['dexie', 'dexie-react-hooks', 'ts-fsrs'],
          ai: ['@google/genai', 'zod'],
          hanzi: ['hanzi-writer'],
          docs: ['pdfjs-dist', 'mammoth']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}']
  }
});
