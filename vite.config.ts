import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/porci-control-app/',
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "PorciControl",
        short_name: "PorciControl",
        description: "Control de madres cerdas y sus ciclos",
        lang: "es",
        display: "standalone",
        orientation: "portrait",
        start_url: "/porci-control-app/",
        scope: "/porci-control-app/",
        theme_color: "#2E7D32",
        background_color: "#F5F5DC",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "/porci-control-app/index.html",
        // Supabase nunca pasa por el caché: la sincronización siempre va a la red.
        navigateFallbackDenylist: [/supabase\.co/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith("supabase.co"),
            handler: "NetworkOnly",
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
