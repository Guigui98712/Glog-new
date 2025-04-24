import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8084,
    host: true,
    strictPort: false,
    watch: {
      usePolling: true
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['batch', 'emitter']
  },
  build: {
    rollupOptions: {
      external: ['batch', 'emitter']
    },
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  define: {
    'process.env': process.env,
    global: 'globalThis',
  },
  base: './',
  publicDir: 'public',
});
