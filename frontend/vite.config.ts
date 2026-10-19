import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api to the Express server during development so the browser sees one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
