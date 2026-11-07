import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at the admin subdomain's root (e.g. admin.zoser.shop) — split out
// of the legacy _admin/frontend/spa into _frontend/admin, see _frontend/README.md.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Local dev: `npm run dev` (from _backend/) serves the Node API on :4000.
      // Uploaded media is served from the same origin at /media/files — API
      // responses already return it as an absolute PUBLIC_API_URL, so this
      // entry is only needed if PUBLIC_API_URL is set to a relative path.
      "/api": "http://127.0.0.1:4000",
      "/media": "http://127.0.0.1:4000",
    },
  },
});
