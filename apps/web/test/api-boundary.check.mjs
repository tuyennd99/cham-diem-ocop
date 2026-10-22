import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

for (const path of walk(root)) {
  const name = relative(root, path).replaceAll('\\', '/');
  if (name.startsWith('api/')) continue;
  const code = readFileSync(path, 'utf8');
  for (const match of code.matchAll(/^\s*import\s+(?:type\s+)?([^;]+?)\s+from\s*["']([^"']+)["']/gm)) {
    const [, bindings, source] = match;
    assert.ok(source !== 'axios' && !/(?:^|\/)api\/base-request$/.test(source), name);
    assert.ok(!/(?:^|\/)lib\/api$/.test(source) && !(name.startsWith('lib/') && source === './api'), name);
    assert.ok(!(/(?:^|\/)constants\/api$/.test(source) && /\bAPI\b/.test(bindings)), name);
  }
  assert.ok(!/\b(?:fetch|axios|baseRequest|api|apiBlob|requestJson|requestBlob)\s*(?:<[^;\n]*>)?\s*\(/.test(code), name);
}

assert.equal(existsSync(join(root, 'lib/api.ts')), false);
assert.equal(existsSync(join(root, 'api/system.ts')), false);
console.log('PASS API boundaries');
