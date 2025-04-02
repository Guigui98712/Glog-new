import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
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
      external: ['@capacitor-community/barcode-scanner', 'recharts', 'xlsx'],
    }
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ionichwiclbqlfcsmhhy.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvbmljaHdpY2xicWxmY3NtaGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk5OTY5NzAsImV4cCI6MjAyNTU3Mjk3MH0.mYxr5ybj-zJi9wh0g1LQE7lG_4FN2p89UCxXKqgwKGE'),
  },
  base: './',
});
