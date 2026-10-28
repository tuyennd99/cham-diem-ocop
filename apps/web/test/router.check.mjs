import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  envDir: false,
  appType: 'custom',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  ssr: { noExternal: ['lodash'], optimizeDeps: { include: ['lodash'] } },
  server: { middlewareMode: true, watch: null, hmr: false },
});

try {
  const { router } = await server.ssrLoadModule('/src/router.tsx');
  const { routeTree } = await server.ssrLoadModule('/src/routeTree.gen.ts');
  assert.equal(router.options.routeTree, routeTree);
  assert.equal(router.options.defaultPreload, 'intent');
  assert.equal(router.options.scrollRestoration, true);
  const normalize = (path) => path === '/' ? path : path.replace(/\/$/, '');
  const paths = Object.values(router.routesById)
    .filter((route) => route.options.path)
    .map((route) => normalize(route.fullPath));
  const expected = [
    '/', '/403', '/404', '/products', '/products/$id',
    '/login', '/register', '/forgot-password', '/verify-otp',
    '/account', '/account/password', '/admin', '/admin/reports',
    '/admin/product-groups', '/admin/scoring-forms', '/admin/assignments',
    '/admin/users', '/admin/judges', '/admin/products', '/admin/products/$id',
    '/admin/registrations', '/admin/registrations/new',
    '/admin/registrations/$id', '/admin/registrations/$id/edit',
    '/judge', '/judge/products/$id', '/my/products', '/my/products/new',
    '/my/products/$id', '/my/products/$id/edit', '/print/criteria-sets/$id',
    '/print/evaluations/$id', '/print/judge/products/$id',
    '/print/products/$id/registration', '/print/products/$id/results',
  ];
  assert.deepEqual([...new Set(paths)].sort(), expected.sort());

  const matches = (path) => router.matchRoutes(path)
    .map((match) => router.routesById[match.routeId]);
  const leaf = (path) => matches(path).at(-1);
  for (const [path, id] of [
    ['/account/password', '/_app/account/password'],
    ['/my/products/product-1/edit', '/_app/my/products/$id/edit'],
    ['/admin/registrations/product-1/edit', '/_app/admin/registrations/$id/edit'],
  ]) {
    for (const url of [path, `${path}/`]) {
      assert.deepEqual(matches(url).map((route) => route.id), ['__root__', '/_app', id]);
    }
  }
  assert.equal(router.matchRoutes('/products/product-1').at(-1).params.id, 'product-1');

  const session = (role, staffPermissions = []) => ({
    accessToken: 'routing-check',
    user: {
      id: 'user-1', email: 'routing@example.invalid', fullName: 'Routing check',
      phone: null, role, verified: true, staffPermissions,
      organizationUnitId: null, organizationUnit: null,
    },
  });
  const owner = session('REGISTRANT');
  const viewer = session('VIEWER', ['VIEW']);
  const manager = session('ADMIN', ['MANAGE']);
  const judge = session('JUDGE', ['SCORE']);
  const checkGuards = (path, value) => {
    const context = { getSession: () => value, queryClient: router.options.context.queryClient };
    for (const route of matches(path)) route.options.beforeLoad?.({ context });
  };
  const redirectsTo = (to) => (error) => error?.options?.to === to;
  assert.throws(() => checkGuards('/account/password', null), redirectsTo('/login'));
  assert.doesNotThrow(() => checkGuards('/account/password', owner));
  assert.doesNotThrow(() => checkGuards('/my/products/product-1/edit', owner));
  assert.throws(() => checkGuards('/my/products/product-1/edit', manager), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/registrations/product-1/edit', manager));
  assert.throws(() => checkGuards('/admin/registrations/product-1/edit', viewer), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/products', viewer));
  assert.throws(() => checkGuards('/admin/products', owner), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/judge', judge));
  assert.throws(() => checkGuards('/judge', viewer), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/scoring-forms', judge));
  assert.doesNotThrow(() => checkGuards('/print/products/product-1/registration', owner));
  assert.throws(() => checkGuards('/print/products/product-1/results', null), redirectsTo('/login'));
  assert.throws(() => checkGuards('/login', manager), redirectsTo('/admin/products'));
  assert.throws(() => checkGuards('/admin/judges', manager), (error) => {
    assert.equal(error.options.to, '/admin/users');
    assert.deepEqual(error.options.search, { permission: 'SCORE' });
    assert.equal(error.options.replace, true);
    return true;
  });
  for (const path of ['/admin/products', '/admin/registrations']) {
    const validate = leaf(path).options.validateSearch;
    const search = validate({ page: '2', limit: '20', q: ' Chè ' });
    assert.equal(search.page, 2);
    assert.equal(search.limit, 20);
    assert.equal(search.q, 'Chè');
    assert.throws(() => validate({ localityId: 'locality-1', unmappedLocality: true }));
    assert.equal(typeof leaf(path).options.errorComponent, 'function');
  }
  console.log('PASS router: generated tree, 35 URLs, ancestry, guards, search, redirect');
} finally {
  await server.close();
}
