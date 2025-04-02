import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: 8083,
      host: true,
      strictPort: true,
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
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'process.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
      'process.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION),
      global: 'globalThis',
    },
    base: './',
    publicDir: 'public',
  };
});
