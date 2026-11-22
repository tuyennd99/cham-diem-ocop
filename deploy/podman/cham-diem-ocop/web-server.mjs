import http from 'node:http';
import { createNodeSsrHandler } from '/home/dev/Desktop/cham-diem-ocop/apps/web/dist/server/server.js';

const PORT = Number(process.env.PORT || 5173);
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.API_PORT || 3030);

const ssrHandler = createNodeSsrHandler({
  clientDistDir: '/home/dev/Desktop/cham-diem-ocop/apps/web/dist',
});

function resolveClientIp(req) {
  const remote = req.socket?.remoteAddress;
  if (!remote) return undefined;
  return remote.startsWith('::ffff:') ? remote.slice(7) : remote;
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
    const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
    if (!headers['x-forwarded-for']) {
      const clientIp = resolveClientIp(req);
      if (clientIp) headers['x-forwarded-for'] = clientIp;
    }

    const proxyReq = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        path: url,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      },
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ statusCode: 502, message: `API proxy error: ${err.message}` }));
    });

    req.on('aborted', () => {
      proxyReq.destroy();
    });

    req.pipe(proxyReq, { end: true });
    return;
  }

  ssrHandler(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ocop-web] SSR + /api proxy listening on http://0.0.0.0:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
