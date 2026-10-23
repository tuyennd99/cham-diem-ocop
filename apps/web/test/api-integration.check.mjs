import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root, configFile: false, envDir: false, appType: 'custom',
  ssr: { optimizeDeps: { include: ['react', 'react-dom', 'zustand', '@tanstack/react-query', '@tanstack/react-form', 'axios', 'lodash'] } },
  server: { middlewareMode: true, watch: null, hmr: false },
});
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let restoreAxiosAdapter = () => {};
const storage = new Map();
const redirects = [];
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  location: { replace: (url) => redirects.push(url) },
} });
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
  const authConstants = await server.ssrLoadModule('/src/constants/auth.ts');
  const { DEFAULT_PAGE_SIZE } = await server.ssrLoadModule('/src/constants/consts.ts');
  assert.equal(authConstants.SESSION_STORAGE_KEY, 'ocop-session');
  assert.equal(authConstants.PENDING_EMAIL_STORAGE_KEY, 'ocop.pendingEmail');
  assert.equal(DEFAULT_PAGE_SIZE, 20);
  assert.deepEqual(Object.keys(authConstants).sort(), [
    'PENDING_EMAIL_STORAGE_KEY', 'SESSION_STORAGE_KEY',
  ]);
  console.log('PASS file contract');

  {
    const { ApiError, messageOf, errorText } = await server.ssrLoadModule('/src/lib/api-error.ts');
    assert.equal(messageOf(new ApiError('failure', 400)), 'failure');
    assert.equal(errorText(null), '');
    const { getSession, setSession, validatePasswordBytes } = await server.ssrLoadModule('/src/lib/auth.ts');
    const { queryClient } = await server.ssrLoadModule('/src/lib/query-client.ts');
    const { queryKeys } = await server.ssrLoadModule('/src/constants/query-key.ts');
    const { API } = await server.ssrLoadModule('/src/constants/api.ts');
    assert.equal(API.my.attachment('a/b', 'c'), '/my/products/a%2Fb/attachments/c');
    assert.equal(typeof validatePasswordBytes, 'function');
    assert.doesNotThrow(() => validatePasswordBytes('a'.repeat(72)));
    assert.doesNotThrow(() => validatePasswordBytes('ệ'.repeat(24)));
    assert.throws(() => validatePasswordBytes('ệ'.repeat(25)), /72 byte UTF-8/);
    const session = { accessToken: 'test-token', user: {
      id: 'user-1', email: 'a@example.invalid', fullName: 'A', phone: null,
      role: 'REGISTRANT', verified: true,
    } };
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list)?.length, 1);
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    const form = new FormData(); form.append('file', new Blob(['x']), 'x.pdf');
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    redirects.length = 0;
    const { default: baseRequest, requestJson, requestBlob } =
      await server.ssrLoadModule('/src/api/base-request.ts');
    const { AxiosError } = await import('axios');
    const originalAdapter = baseRequest.defaults.adapter;
    restoreAxiosAdapter = () => { baseRequest.defaults.adapter = originalAdapter; };
    function reply(status, data, inspect = () => {}) {
      baseRequest.defaults.adapter = async (config) => {
        inspect(config);
        const response = { status, statusText: String(status), data, headers: {}, config };
        if (status >= 400) throw new AxiosError('HTTP failure', undefined, config, null, response);
        return response;
      };
    }
    reply(201, { statusCode: 201, data: { id: 'p1' } }, (config) => {
      assert.equal(config.baseURL, '/api');
      assert.equal(config.headers.get('Authorization'), 'Bearer test-token');
    });
    assert.deepEqual(await requestJson({ url: '/my/products', method: 'POST', data: {} }),
      { data: { id: 'p1' } });
    reply(200, { data: [{ id: 'p1' }], meta });
    assert.deepEqual(await requestJson({ url: '/products' }), { data: [{ id: 'p1' }], meta });
    reply(200, new Blob(['binary']), (config) => assert.equal(config.responseType, 'blob'));
    assert.equal(await (await requestBlob('/my/products/p1/attachments/f1')).text(), 'binary');
    reply(401, new Blob([JSON.stringify({ message: 'Authentication required' })]));
    await assert.rejects(requestBlob('/my/products/p1/attachments/f1'), { status: 401 });
    assert.equal(getSession(), null);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
    setSession(session);
    reply(201, { data: { id: 'file-1' } }, (config) => {
      assert.ok(config.data instanceof FormData);
      assert.ok(!config.headers.getContentType());
    });
    await requestJson({ url: '/my/products/p1/attachments', method: 'POST', data: form });
    for (const status of [403, 409, 413, 415, 429, 500]) {
      setSession(session);
      reply(status, { message: `failure-${status}` });
      await assert.rejects(requestJson({ url: '/my/products/p1' }),
        { status, message: `failure-${status}` });
      assert.ok(getSession());
    }
    setSession(session);
    redirects.length = 0;
    reply(401, { message: 'Current password is incorrect' });
    await assert.rejects(requestJson({ url: '/auth/change-password', method: 'POST' }),
      { status: 401 });
    assert.ok(getSession());
    assert.equal(redirects.length, 0);
    setSession(null);
    reply(401, { message: 'Invalid credentials' });
    await assert.rejects(requestJson({ url: '/auth/login', method: 'POST' }), { status: 401 });
    assert.equal(redirects.length, 0);
    baseRequest.defaults.adapter = async () => { throw new Error('Network Error'); };
    await assert.rejects(requestJson({ url: '/my/products' }), (error) =>
      !(error instanceof ApiError) && error.message === 'Network Error');
    reply(204, '');
    assert.deepEqual(await requestJson({ url: '/my/products/p1', method: 'DELETE' }), { data: null });
    reply(500, '<html>proxy error</html>');
    await assert.rejects(requestJson({ url: '/products' }),
      { status: 500, message: 'Request failed (500)' });
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    redirects.length = 0;
    reply(401, { message: 'Authentication required' });
    await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
    assert.equal(getSession(), null);
    assert.equal(storage.has('ocop-session'), false);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
    assert.deepEqual(redirects, ['/login']);
    setSession(session);
    redirects.length = 0;
    reply(401, { message: 'Old token expired' }, () => {
      setSession({ ...session, accessToken: 'new-token' });
    });
    await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
    assert.equal(getSession().accessToken, 'new-token');
    assert.equal(redirects.length, 0);
    const retry = queryClient.getDefaultOptions().queries.retry;
    assert.equal(typeof retry, 'function');
    assert.equal(retry(0, new ApiError('conflict', 409)), false);
    assert.equal(retry(0, new ApiError('server', 500)), true);
    assert.equal(retry(0, new Error('network')), true);
    assert.equal(retry(1, new Error('network')), false);
    const { authApi, productsApi, myProductsApi, judgeApi, adminApi } =
      await server.ssrLoadModule('/src/api/index.ts');
    setSession(null);
    const loginResult = { accessToken: 'test-token', user: session.user };
    reply(200, { data: loginResult }, (config) => {
      assert.equal(config.url, '/auth/login');
      assert.equal(config.method, 'post');
      assert.deepEqual(JSON.parse(config.data), { email: 'a@example.invalid', password: 'secret' });
      assert.equal(config.headers.get('Authorization'), undefined);
    });
    assert.deepEqual(await authApi.login({ email: 'a@example.invalid', password: 'secret' }),
      { data: loginResult });
    setSession(session);
    reply(201, { data: { id: 'p1' } }, (config) => {
      assert.equal(config.url, '/my/products');
      assert.equal(config.method, 'post');
      assert.deepEqual(JSON.parse(config.data), {
        name: 'Chè', categoryId: 'c1', formData: {},
      });
    });
    assert.deepEqual(await myProductsApi.create({ name: 'Chè', categoryId: 'c1', formData: {} }),
      { data: { id: 'p1' } });
    reply(200, { data: [], meta }, (config) => {
      assert.equal(config.url, '/products');
      assert.deepEqual(config.params, { page: 2, limit: 20, q: 'chè & trà' });
    });
    assert.deepEqual(await productsApi.list({ page: 2, limit: 20, q: 'chè & trà' }),
      { data: [], meta });
    const productInput = { name: 'Chè', categoryId: 'c1', formData: { assessmentYear: 2026 } };
    reply(200, { data: { id: 'p1' } }, (config) => {
      assert.equal(config.url, '/my/products/p1');
      assert.equal(config.method, 'put');
      assert.deepEqual(JSON.parse(config.data), productInput);
    });
    await myProductsApi.update('p1', productInput);
    const assignmentInput = [{ judgeId: 'j1', categoryId: 'c1', criterionIds: [] }];
    reply(200, { data: [] }, (config) => {
      assert.equal(config.url, '/admin/assignments');
      assert.equal(config.method, 'put');
      assert.deepEqual(JSON.parse(config.data), { assignments: assignmentInput });
    });
    await adminApi.replaceAssignments(assignmentInput);
    const judgeCalls = [];
    baseRequest.defaults.adapter = async (config) => {
      judgeCalls.push({ url: config.url, method: config.method, data: config.data === undefined ? undefined : JSON.parse(config.data) });
      const data = config.url.endsWith('/submit')
        ? { data: { id: 'e1', status: 'SUBMITTED', total: 42 } }
        : { data: { id: 'e1', status: 'DRAFT', scores: [{ subCriterionId: 's1', optionId: 'o1', note: 'Giải trình' }] } };
      return { status: 200, statusText: '200', data, headers: {}, config };
    };
    const scores = [{ subCriterionId: 's1', optionId: 'o1', note: 'Giải trình' }];
    await judgeApi.save('p1', { scores });
    await judgeApi.submit('p1');
    assert.deepEqual(judgeCalls, [
      { url: '/judge/products/p1/evaluation', method: 'put', data: { scores } },
      { url: '/judge/products/p1/evaluation/submit', method: 'post', data: undefined },
    ]);
    setSession(session);
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    reply(201, { data: { id: 'f1' } }, (config) => {
      assert.equal(config.url, '/my/products/a%2Fb/attachments');
      assert.deepEqual([...config.data.keys()], ['file']);
      assert.equal(config.data.get('file').name, 'proof.pdf');
    });
    await myProductsApi.upload('a/b', proof);
    reply(200, new Blob(['private']), (config) => {
      assert.equal(config.url, '/my/products/a%2Fb/attachments/f1');
      assert.equal(config.responseType, 'blob');
      assert.equal(config.headers.get('Authorization'), 'Bearer test-token');
    });
    assert.equal(await (await myProductsApi.attachment('a/b', 'f1')).text(), 'private');
    console.log('PASS client: envelope, 201, multipart, blob, 401 session rules');
  }
} finally {
  restoreAxiosAdapter();
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
  await server.close();
}
