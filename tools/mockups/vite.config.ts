import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The mockup factory is a separate app on purpose: Astryx is a React UI system,
 * not a frame-driven renderer, and must never enter the Remotion bundle.
 *
 * `build.target: chrome120` keeps the output in the range of the browsers used
 * for capture (Edge/Chromium) and lets CSS `@scope`, `light-dark()` and
 * `color-mix()` pass through untouched.
 */
export default defineConfig({
  plugins: [react()],
  server: {host: '127.0.0.1', port: 5180, strictPort: true},
  preview: {host: '127.0.0.1', port: 5180, strictPort: true},
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome120',
  },
});
