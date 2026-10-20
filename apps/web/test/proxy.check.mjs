import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), 'ocop-proxy-'));
const previousCwd = process.cwd();
const previousProxy = process.env.VITE_API_PROXY;
async function target() {
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' }, configFile, fixture, 'silent', undefined, 'native',
  );
  assert.ok(loaded);
  return loaded.config.server.proxy['/api'];
}
try {
  process.chdir(fixture);
  delete process.env.VITE_API_PROXY;
  assert.equal(await target(), 'http://localhost:3030');
  writeFileSync(join(fixture, '.env.local'), 'VITE_API_PROXY=http://127.0.0.1:3131\n');
  assert.equal(await target(), 'http://127.0.0.1:3131');
  process.env.VITE_API_PROXY = 'http://127.0.0.1:3232';
  assert.equal(await target(), 'http://127.0.0.1:3232');
  console.log('PASS proxy: default, file env, process override');
} finally {
  process.chdir(previousCwd);
  if (previousProxy === undefined) delete process.env.VITE_API_PROXY;
  else process.env.VITE_API_PROXY = previousProxy;
  rmSync(fixture, { recursive: true, force: true });
}
