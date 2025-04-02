import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Carregar variáveis de ambiente com base no modo (development/production)
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
      exclude: ['@capacitor-community/barcode-scanner']
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        external: ['@capacitor-community/barcode-scanner'],
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-alert-dialog', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
          }
        }
      },
      commonjsOptions: {
        include: []
      }
    },
    define: {
      'process.env': {},
      // Definir explicitamente as variáveis do Supabase
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ionichwiclbqlfcsmhhy.supabase.co'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmljaHdpY2xicWxmY3NtaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk5OTY5NzAsImV4cCI6MjAyNTU3Mjk3MH0.mYxr5ybj-zJi9wh0g1LQE7lG_4FN2p89UCxXKqgwKGE'),
      // Outras variáveis de ambiente
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || ''),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV || 'production'),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      global: 'globalThis',
    },
    base: './',
    publicDir: 'public',
  };
});
