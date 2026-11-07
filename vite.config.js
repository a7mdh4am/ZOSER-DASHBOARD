import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at the admin subdomain's root (e.g. admin.zoser.shop) — split out
// of the legacy _admin/frontend/spa into _frontend/admin, see _frontend/README.md.
export default defineConfig(({ command, mode }) => {
  // The dummy API (src/lib/mock) answers in the dev server and is off in
  // builds; VITE_MOCK_API=true|false overrides that, as in src/lib/api.js.
  // When it's off, "dummy-api" is a stub, so neither the dummy data nor its
  // images get into the build.
  const flag =
    process.env.VITE_MOCK_API ?? loadEnv(mode, process.cwd()).VITE_MOCK_API;
  const dummyApi = flag ? flag === "true" : command === "serve";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "dummy-api": fileURLToPath(
          new URL(
            dummyApi ? "./src/lib/mock/index.js" : "./src/lib/mock/off.js",
            import.meta.url,
          ),
        ),
      },
    },
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
  };
});
