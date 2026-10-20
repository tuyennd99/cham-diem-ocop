import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root, configFile: false, envDir: false, appType: 'custom',
  server: { middlewareMode: true, watch: null, hmr: false },
});
try {
  const { validateProductFile, PRODUCT_FILE_ACCEPT } = await server.ssrLoadModule('/src/lib/attachments.ts');
  assert.equal(typeof validateProductFile, 'function');
  for (const [extension, type] of [
    ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'], ['webp', 'image/webp'], ['pdf', 'application/pdf'],
  ]) {
    assert.doesNotThrow(() => validateProductFile({ name: `a.${extension}`, type, size: 10 * 1024 * 1024 }));
  }
  assert.doesNotThrow(() => validateProductFile({ name: 'a.PDF', type: 'application/pdf', size: 1 }));
  for (const file of [
    { name: 'a.svg', type: 'image/svg+xml', size: 1 },
    { name: 'a.png', type: 'application/pdf', size: 1 },
    { name: 'a.pdf', type: 'application/pdf', size: 0 },
    { name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 },
  ]) assert.throws(() => validateProductFile(file));
  assert.ok(!PRODUCT_FILE_ACCEPT.includes('image/*'));
  const { formatFormEntries } = await server.ssrLoadModule('/src/lib/utils.ts');
  assert.equal(typeof formatFormEntries, 'function');
  assert.deepEqual(formatFormEntries({
    entityName: 'HTX Chè',
    registrationType: 'FIRST',
    sampleQuantity: 2,
    declarationAccepted: true,
    phone: '',
  }), [
    { key: 'entityName', label: 'Tên chủ thể', value: 'HTX Chè' },
    { key: 'registrationType', label: 'Loại đăng ký', value: 'Lần đầu' },
    { key: 'sampleQuantity', label: 'Số lượng mẫu', value: '2' },
    { key: 'declarationAccepted', label: 'Cam kết hồ sơ', value: 'Có' },
    { key: 'phone', label: 'Điện thoại', value: 'Chưa cung cấp' },
  ]);
  console.log('PASS file contract');

  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousFetch = globalThis.fetch;
  const storage = new Map();
  const redirects = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: { replace: (url) => redirects.push(url) },
  } });
  try {
    const { api, apiBlob } = await server.ssrLoadModule('/src/lib/api.ts');
    const { getSession, setSession, validatePasswordBytes } = await server.ssrLoadModule('/src/lib/auth.ts');
    assert.equal(typeof validatePasswordBytes, 'function');
    assert.doesNotThrow(() => validatePasswordBytes('a'.repeat(72)));
    assert.doesNotThrow(() => validatePasswordBytes('ệ'.repeat(24)));
    assert.throws(() => validatePasswordBytes('ệ'.repeat(25)), /72 byte UTF-8/);
    const session = { accessToken: 'test-token', user: {
      id: 'user-1', email: 'a@example.invalid', fullName: 'A', phone: null,
      role: 'REGISTRANT', verified: true,
    } };
    setSession(session);
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    globalThis.fetch = async (_url, init) => {
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-token');
      return Response.json({ statusCode: 200, data: [{ id: 'p1' }], meta });
    };
    assert.deepEqual(await api('/products'), { data: [{ id: 'p1' }], meta });
    globalThis.fetch = async () => Response.json({ statusCode: 201, data: { id: 'p1' } }, { status: 201 });
    assert.deepEqual(await api('/my/products', { method: 'POST', body: '{}' }), { data: { id: 'p1' } });
    globalThis.fetch = async (_url, init) => {
      assert.ok(init.body instanceof FormData);
      assert.equal(new Headers(init.headers).get('Content-Type'), null);
      return Response.json({ data: { id: 'file-1' } }, { status: 201 });
    };
    const form = new FormData(); form.append('file', new Blob(['x']), 'x.pdf');
    await api('/my/products/p1/attachments', { method: 'POST', body: form });
    globalThis.fetch = async () => new Response(new Blob(['binary']));
    assert.equal(await (await apiBlob('/my/products/p1/attachments/f1')).text(), 'binary');
    globalThis.fetch = async () => Response.json({ message: 'Current password is incorrect' }, { status: 401 });
    await assert.rejects(api('/auth/change-password', { method: 'POST' }), { status: 401 });
    assert.ok(getSession()); assert.equal(redirects.length, 0);
    globalThis.fetch = async () => Response.json({ message: 'Authentication required' }, { status: 401 });
    await assert.rejects(api('/auth/me'), { status: 401 });
    assert.equal(getSession(), null);
    assert.equal(storage.has('ocop-session'), false);
    assert.deepEqual(redirects, ['/login']);
    console.log('PASS client: envelope, 201, multipart, blob, 401 session rules');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
} finally {
  await server.close();
}
