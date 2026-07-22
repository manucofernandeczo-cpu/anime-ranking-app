import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Cachea la app entera para que abra sin conexión tras la primera vez
        navigateFallback: "index.html",
      },
      manifest: {
        name: "Mi Ranking de Anime",
        short_name: "Anime Ranking",
        description: "Lista de anime con orden personalizado",
        theme_color: "#0B0B0F",
        background_color: "#0B0B0F",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
