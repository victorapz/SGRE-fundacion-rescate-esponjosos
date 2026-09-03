import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function getDevProxyTarget(mode) {
  const env = loadEnv(mode, process.cwd(), "");
  const rawApiUrl = env.VITE_API_URL || "http://localhost:3000/api";

  try {
    return new URL(rawApiUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: getDevProxyTarget(mode),
        changeOrigin: true,
      },
    },
  },
}));
