import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import react from "@vitejs/plugin-react";
import { reactClickToComponent } from "vite-plugin-react-click-to-component";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";

function shouldBypassDevSsr(pathname: string): boolean {
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/__") ||
    pathname.startsWith("/src/") ||
    pathname.startsWith("/node_modules/")
  ) {
    return true;
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/og-default.png") {
    return false;
  }
  return /\.[a-z0-9]+$/i.test(pathname);
}

function ocopDevSsrPlugin(): Plugin {
  return {
    name: "ocop-dev-ssr",
    configureServer(viteServer: ViteDevServer) {
      viteServer.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        try {
          const method = req.method || "GET";
          if (method !== "GET" && method !== "HEAD") return next();

          const rawUrl = req.url || "/";
          const host = req.headers.host || "localhost:5173";
          const protocol =
            (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() ||
            "http";
          const requestUrl = new URL(rawUrl, `${protocol}://${host}`);

          if (shouldBypassDevSsr(requestUrl.pathname)) {
            return next();
          }

          const accept = req.headers.accept || "";
          const isSeoResource =
            requestUrl.pathname === "/robots.txt" ||
            requestUrl.pathname === "/sitemap.xml" ||
            requestUrl.pathname === "/og-default.png";
          if (
            !isSeoResource &&
            accept &&
            !accept.includes("text/html") &&
            !accept.includes("*/*")
          ) {
            return next();
          }

          const { renderAppRequest } = await viteServer.ssrLoadModule("/src/entry-server.tsx");
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const item of value) headers.append(key, item);
            } else if (typeof value === "string") {
              headers.set(key, value);
            }
          }

          const webRequest = new Request(requestUrl.toString(), {
            method,
            headers,
          });
          const webResponse: Response = await renderAppRequest(webRequest, {
            origin: requestUrl.origin,
            clientEntrySrc: "/src/main.tsx",
            stylesheetHrefs: ["/src/styles.css"],
          });

          const contentType = webResponse.headers.get("content-type") || "";
          res.statusCode = webResponse.status;
          webResponse.headers.forEach((value, key) => {
            if (key.toLowerCase() !== "content-length") {
              res.setHeader(key, value);
            }
          });

          if (method === "HEAD") {
            res.end();
            return;
          }

          if (contentType.includes("text/html")) {
            const rawHtml = await webResponse.text();
            const transformedHtml = await viteServer.transformIndexHtml(rawUrl, rawHtml);
            res.end(transformedHtml);
            return;
          }

          const body = Buffer.from(await webResponse.arrayBuffer());
          res.end(body);
        } catch (error) {
          viteServer.ssrFixStacktrace(error as Error);
          next(error);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), "VITE_");
  const apiProxy = process.env.VITE_API_PROXY || values.VITE_API_PROXY || "http://localhost:3030";

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      // codeInspectorPlugin({
      //   bundler: 'vite',
      //   editor: 'code',
      // }),
      react(),
      mode === 'development' ? reactClickToComponent() : null,
      tailwindcss(),
      ocopDevSsrPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@ocop/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": apiProxy,
      },
    },
  };
});
