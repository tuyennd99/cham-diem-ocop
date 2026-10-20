import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy: { "/api": process.env.VITE_API_PROXY || values.VITE_API_PROXY || "http://localhost:3030" } },
  };
});
