import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), "VITE_");
  process.env.LAUNCH_EDITOR ??= "antigravity-ide.cmd";
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      codeInspectorPlugin({
        bundler: 'vite',
        editor: 'code'
      }),
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: { proxy: { "/api": process.env.VITE_API_PROXY || values.VITE_API_PROXY || "http://localhost:3030" } },
  };
});
