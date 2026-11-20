import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWebSsrServer, extractAssetsFromIndexHtml } from '../dist/server/server.js';

const assets = extractAssetsFromIndexHtml(
  readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8'),
);
const server = createWebSsrServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const path of [assets.clientEntrySrc, ...assets.stylesheetHrefs, '/og-default.png']) {
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, `${path} must be served by the built server`);
    assert.equal(
      response.headers.get('cache-control'),
      path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    );
    assert.ok((await response.arrayBuffer()).byteLength > 0);
    const head = await fetch(new URL(path, origin), { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
  for (const path of ['/server/server.js', '/SERVER/server.js', '/server%5Cserver.js']) {
    const response = await fetch(new URL(path, origin));
    assert.notEqual(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.ok(!(await response.text()).includes('createNodeSsrHandler'));
  }
  console.log('PASS built-server: default assets, HEAD, server bundle protection');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
