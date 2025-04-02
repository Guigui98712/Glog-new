import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Lista de módulos externos que precisam ser tratados especialmente
const externalModules = [
  '@capacitor-community/barcode-scanner',
  '@capacitor/browser',
  '@capacitor/share',
  '@radix-ui/react-progress',
  'recharts',
  'xlsx',
  'heic2any'
];

// Lista de módulos que devem ser otimizados
const optimizeDeps = {
  exclude: ['@capacitor-community/barcode-scanner'],
  include: ['heic2any']
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        external: ['@capacitor-community/barcode-scanner'],
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu'
            ]
          }
        }
      },
      commonjsOptions: {
        include: [/node_modules/],
        extensions: ['.js', '.cjs', '.mjs', '.ts', '.tsx']
      }
    },
    optimizeDeps: optimizeDeps,
    server: {
      port: 8083,
      host: true,
      watch: {
        usePolling: true
      }
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION)
    },
    base: './',
  };
});
