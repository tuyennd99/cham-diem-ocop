import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { renderAppRequest } from './entry-server';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export interface ClientAssetManifest {
  clientEntrySrc: string;
  stylesheetHrefs: string[];
}

export function extractAssetsFromIndexHtml(html: string): ClientAssetManifest {
  const scriptMatch = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i);
  const stylesheetHrefs = Array.from(
    html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi),
    (match) => match[1],
  );
  return {
    clientEntrySrc: scriptMatch?.[1] ?? '/src/main.tsx',
    stylesheetHrefs,
  };
}

export interface StartWebSsrServerOptions {
  port?: number;
  host?: string;
  clientDistDir?: string;
  publicOrigin?: string;
}

export function createNodeSsrHandler(options: StartWebSsrServerOptions = {}) {
  const resolvedRoot = resolve(
    options.clientDistDir
      ? options.clientDistDir
      : fileURLToPath(new URL(import.meta.env.PROD ? '..' : '../dist', import.meta.url)),
  );
  const indexHtmlPath = join(resolvedRoot, 'index.html');
  const assets: ClientAssetManifest = existsSync(indexHtmlPath)
    ? extractAssetsFromIndexHtml(readFileSync(indexHtmlPath, 'utf8'))
    : { clientEntrySrc: '/src/main.tsx', stylesheetHrefs: [] };

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const host = req.headers.host || 'localhost:5173';
      const protocol =
        (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || 'http';
      const requestUrl = new URL(req.url || '/', `${protocol}://${host}`);
      let pathname = requestUrl.pathname;
      try {
        pathname = decodeURIComponent(requestUrl.pathname);
      } catch {
        pathname = requestUrl.pathname;
      }

      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        pathname !== '/' &&
        pathname !== '/index.html' &&
        !pathname.includes('\0')
      ) {
        const candidatePath = resolve(resolvedRoot, '.' + pathname);
        if (
          (candidatePath === resolvedRoot || candidatePath.startsWith(resolvedRoot + sep)) &&
          relative(resolvedRoot, candidatePath).split(sep)[0].toLowerCase() !== 'server'
        ) {
          let isFile = false;
          try {
            isFile = (await stat(candidatePath)).isFile();
          } catch {
            isFile = false;
          }
          if (isFile) {
            const ext = extname(candidatePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            const cacheControl = pathname.startsWith('/assets/')
              ? 'public, max-age=31536000, immutable'
              : 'public, max-age=3600';
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', cacheControl);
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            await pipeline(createReadStream(candidatePath), res);
            return;
          }
        }
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item);
        } else if (typeof value === 'string') {
          headers.set(key, value);
        }
      }

      const webRequest = new Request(requestUrl.toString(), {
        method: req.method || 'GET',
        headers,
      });

      const webResponse = await renderAppRequest(webRequest, {
        origin: options.publicOrigin ?? requestUrl.origin,
        clientEntrySrc: assets.clientEntrySrc,
        stylesheetHrefs: assets.stylesheetHrefs,
      });

      res.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      if (webResponse.body) {
        await pipeline(
          Readable.fromWeb(webResponse.body as unknown as import('node:stream/web').ReadableStream),
          res,
        );
        return;
      }

      const body = Buffer.from(await webResponse.arrayBuffer());
      res.end(body);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.message : 'Internal Server Error');
    }
  };
}

export function createWebSsrServer(options: StartWebSsrServerOptions = {}) {
  return createHttpServer(createNodeSsrHandler(options));
}
