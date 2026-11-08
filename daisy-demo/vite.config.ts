import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The 3D view's chunk (three.js and the scene, D120) is about 600 kB minified and loads only when the
    // viewer first asks for the 3D view; tests/scene3dBundle.test.ts keeps it out of the main bundle.
    chunkSizeWarningLimit: 650,
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
