import assert from 'node:assert/strict';
import { createViteSsrTestServer } from './support/vite-ssr-test-server.mjs';

const server = await createViteSsrTestServer();

try {
  // 1. SEO eligibility helper & origin helper
  const seo = await server.ssrLoadModule('/src/lib/seo.ts');
  assert.equal(typeof seo.isSeoEligibleProduct, 'function');
  assert.deepEqual(seo.SEO_ELIGIBLE_PRODUCT_STATUSES, ['APPROVED', 'SCORING', 'COMPLETED']);

  assert.equal(
    seo.isSeoEligibleProduct({ status: 'APPROVED', approvedAt: '2026-10-01T00:00:00.000Z' }),
    true,
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'SCORING', approvedAt: '2026-10-01T00:00:00.000Z' }),
    true,
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'COMPLETED', approvedAt: '2026-10-01T00:00:00.000Z' }),
    true,
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'SCORING', approvedAt: null }),
    false,
    'SCORING without approvedAt must NOT be SEO-eligible',
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'COMPLETED', approvedAt: null }),
    false,
    'COMPLETED without approvedAt must NOT be SEO-eligible',
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'SUBMITTED', approvedAt: null }),
    false,
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'RETURNED', approvedAt: '2026-10-01T00:00:00.000Z' }),
    false,
  );
  assert.equal(
    seo.isSeoEligibleProduct({ status: 'DRAFT', approvedAt: null }),
    false,
  );

  // 2. Per-request QueryClient and Router isolation
  const { createQueryClient, queryClient } = await server.ssrLoadModule('/src/lib/query-client.ts');
  const { createAppRouter, router } = await server.ssrLoadModule('/src/router.tsx');
  assert.equal(typeof createQueryClient, 'function');
  assert.equal(typeof createAppRouter, 'function');
  assert.ok(queryClient);
  assert.ok(router);

  const routerA = createAppRouter();
  const routerB = createAppRouter();
  assert.notEqual(routerA, routerB);
  assert.notEqual(routerA.options.context.queryClient, routerB.options.context.queryClient);

  // 3. Selective SSR route configuration
  assert.equal(routerA.routesById['/_auth'].options.ssr, false, '/_auth must set ssr: false');
  assert.equal(routerA.routesById['/_app'].options.ssr, false, '/_app must set ssr: false');
  assert.notEqual(routerA.routesById['__root__'].options.ssr, false, '__root__ must not disable SSR');
  assert.notEqual(routerA.routesById['/_public'].options.ssr, false, '/_public must not disable SSR');
  assert.notEqual(routerA.routesById['/_public/'].options.ssr, false, '/_public/ must not disable SSR');

  // 4. SSR HTTP rendering for Homepage `/`
  const { default: baseRequest } = await server.ssrLoadModule('/src/api/base-request.ts');
  const { renderAppRequest } = await server.ssrLoadModule('/src/entry-server.tsx');
  assert.equal(typeof renderAppRequest, 'function');

  const categoriesFixture = [
    { id: 'cat-food', name: 'Thực phẩm' },
    { id: 'cat-drink', name: 'Đồ uống' },
  ];

  const mixedProductsFixture = [
    {
      id: 'prod-approved',
      name: 'Trà Shan Tuyết Cổ Thụ',
      description: 'Đặc sản trà vùng cao đã được duyệt.',
      status: 'APPROVED',
      approvedAt: '2026-10-01T00:00:00.000Z',
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      category: { id: 'cat-drink', name: 'Đồ uống' },
      attachments: [{ id: 'att-1', fileName: 'tra.jpg' }],
    },
    {
      id: 'prod-scoring-approved',
      name: 'Mật Ong Bạc Hà Hà Giang',
      description: 'Đang chấm điểm sau khi Chủ trì duyệt.',
      status: 'SCORING',
      approvedAt: '2026-10-02T00:00:00.000Z',
      publicationState: 'UNPUBLISHED',
      // Simulate accidental unpublished score to verify frontend also guards against leaking if publicationState !== PUBLISHED
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-02T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
    {
      id: 'prod-completed-published',
      name: 'Cà Phê Đặc Sản Cầu Đất',
      description: 'Đã hoàn tất và công bố kết quả.',
      status: 'COMPLETED',
      approvedAt: '2026-10-03T00:00:00.000Z',
      publicationState: 'PUBLISHED',
      finalScore: 93.5,
      starRating: 5,
      createdAt: '2026-10-03T00:00:00.000Z',
      category: { id: 'cat-drink', name: 'Đồ uống' },
      attachments: [],
    },
    // Ineligible records that must NEVER appear in homepage HTML even if returned
    {
      id: 'prod-submitted-unapproved',
      name: 'Sản Phẩm Mới Nộp Chưa Duyệt',
      description: 'Không được phép xuất hiện trên trang chủ SSR.',
      status: 'SUBMITTED',
      approvedAt: null,
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-04T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
    {
      id: 'prod-scoring-missing-approval',
      name: 'Hồ Sơ Đang Chấm Thiếu Dấu Vết Duyệt',
      description: 'Không có approvedAt nên không đủ điều kiện SEO.',
      status: 'SCORING',
      approvedAt: null,
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-05T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
    {
      id: 'prod-returned',
      name: 'Hồ Sơ Đã Trả Lại',
      description: 'Đã bị trả lại.',
      status: 'RETURNED',
      approvedAt: '2026-10-01T00:00:00.000Z',
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-06T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
  ];

  const seenRequests = [];
  const originalAdapter = baseRequest.defaults.adapter;
  try {
    baseRequest.defaults.adapter = async (config) => {
      seenRequests.push({
        baseURL: config.baseURL,
        url: config.url,
        params: config.params,
        auth: config.headers?.get?.('Authorization'),
      });
      if (config.url === '/categories') {
        return {
          status: 200,
          statusText: '200',
          data: { data: categoriesFixture },
          headers: {},
          config,
        };
      }
      if (config.url === '/products') {
        return {
          status: 200,
          statusText: '200',
          data: {
            data: mixedProductsFixture,
            meta: { page: 1, limit: 6, total: 3, totalPages: 1 },
          },
          headers: {},
          config,
        };
      }
      throw new Error(`Unexpected URL: ${config.url}`);
    };

    const response = await renderAppRequest(new Request('https://ocop.vn/'));
    assert.equal(response.status, 200);
    const html = await response.text();

    // Verify server API calls used absolute baseURL and approvedOnly: true, with no Authorization header
    const productCall = seenRequests.find((req) => req.url === '/products');
    assert.ok(productCall, 'SSR loader must fetch /products');
    assert.match(productCall.baseURL, /^https?:\/\/.+\/api$/);
    assert.equal(productCall.params.approvedOnly, true);
    assert.equal(productCall.params.page, 1);
    assert.equal(productCall.params.limit, 6);
    assert.equal(productCall.auth, undefined);

    // Verify SEO metadata in initial HTML
    assert.match(html, /<title>[^<]*OCOP[^<]*<\/title>/);
    assert.match(html, /<meta[^>]+name="description"[^>]+content="[^"]+OCOP[^"]*"/i);
    assert.match(html, /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/"/i);

    // Verify eligible products appear in initial HTML without executing JS
    assert.ok(html.includes('Trà Shan Tuyết Cổ Thụ'), 'APPROVED product must appear in SSR HTML');
    assert.ok(html.includes('Mật Ong Bạc Hà Hà Giang'), 'SCORING product with approvedAt must appear in SSR HTML');
    assert.ok(html.includes('Cà Phê Đặc Sản Cầu Đất'), 'COMPLETED product with approvedAt must appear in SSR HTML');
    assert.match(
      html,
      /93\.5(?:<!-- -->|\s)*điểm(?:<!-- -->|\s)*·(?:<!-- -->|\s)*5(?:<!-- -->|\s)*sao/,
      'Published score/stars must appear',
    );
    assert.ok(html.includes('/products/prod-approved'), 'Product detail link must appear in SSR HTML');

    // Verify ineligible products NEVER appear in homepage HTML
    assert.ok(!html.includes('Sản Phẩm Mới Nộp Chưa Duyệt'), 'SUBMITTED product must NOT appear in SSR HTML');
    assert.ok(!html.includes('prod-submitted-unapproved'), 'SUBMITTED product ID must NOT appear in SSR HTML');
    assert.ok(!html.includes('Hồ Sơ Đang Chấm Thiếu Dấu Vết Duyệt'), 'SCORING without approvedAt must NOT appear in SSR HTML');
    assert.ok(!html.includes('prod-scoring-missing-approval'), 'SCORING without approvedAt ID must NOT appear in SSR HTML');
    assert.ok(!html.includes('Hồ Sơ Đã Trả Lại'), 'RETURNED product must NOT appear in SSR HTML');

    // Verify SSR header renders anonymous state (no leaked session)
    assert.ok(html.includes('Đăng nhập'));
    assert.ok(html.includes('href="/login"'));

    // 5. Concurrent SSR request isolation & no private session leak
    baseRequest.defaults.adapter = async (config) => {
      const isSlow = config.params?.categoryId === 'slow';
      await new Promise((r) => setTimeout(r, isSlow ? 30 : 5));
      if (config.url === '/categories') {
        return { status: 200, statusText: '200', data: { data: categoriesFixture }, headers: {}, config };
      }
      return {
        status: 200,
        statusText: '200',
        data: {
          data: [mixedProductsFixture[0]],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        },
        headers: {},
        config,
      };
    };

    const [res1, res2] = await Promise.all([
      renderAppRequest(new Request('https://first.ocop.vn/')),
      renderAppRequest(new Request('https://second.ocop.vn/')),
    ]);
    const [html1, html2] = await Promise.all([res1.text(), res2.text()]);
    assert.match(html1, /href="https:\/\/first\.ocop\.vn\/"/);
    assert.match(html2, /href="https:\/\/second\.ocop\.vn\/"/);

    // 6. Backend API failure on homepage SSR must return 5xx error status, NOT 200 empty page
    const { AxiosError } = await import('axios');
    baseRequest.defaults.adapter = async (config) => {
      const response = {
        status: 503,
        statusText: '503',
        data: { message: 'Database unavailable' },
        headers: {},
        config,
      };
      throw new AxiosError('Service Unavailable', undefined, config, null, response);
    };

    const errorResponse = await renderAppRequest(new Request('https://ocop.vn/'));
    assert.ok(
      errorResponse.status >= 500,
      `Expected 5xx status when backend fails during SSR, got ${errorResponse.status}`,
    );
    const errorHtml = await errorResponse.text();
    assert.ok(
      !errorHtml.includes('Chưa có sản phẩm công khai'),
      'Backend failure must NOT render as a successful empty product state',
    );

    // 7. Client-only routes (/login and /my/products) must not fail or redirect to /login on the server
    const loginResponse = await renderAppRequest(new Request('https://ocop.vn/login'));
    assert.equal(loginResponse.status, 200);
    const workspaceRedirect = await renderAppRequest(new Request('https://ocop.vn/my/products'));
    assert.notEqual(
      workspaceRedirect.headers.get('location'),
      '/login',
      '/_app route must not redirect to /login on server when ssr: false',
    );
    const workspaceResponse = await renderAppRequest(
      new Request('https://ocop.vn/my/products?page=1&limit=20&sortBy=submittedAt&sortDirection=desc'),
    );
    assert.equal(workspaceResponse.status, 200);
    const workspaceNewResponse = await renderAppRequest(new Request('https://ocop.vn/my/products/new'));
    assert.equal(workspaceNewResponse.status, 200);

    // 8. Header & session hydration safety (useSession getServerSnapshot returns null, getSession returns synchronous session)
    const { getSession, setSession, useSession } = await server.ssrLoadModule('/src/stores/session-store.ts');
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');

    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const mockStorage = new Map();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (k) => mockStorage.get(k) ?? null,
          setItem: (k, v) => mockStorage.set(k, v),
          removeItem: (k) => mockStorage.delete(k),
        },
      },
    });
    try {
      setSession({
        accessToken: 'hydration-token',
        user: {
          id: 'u-1',
          email: 'chair@ocop.vn',
          fullName: 'Chủ Trì Kiểm Thử',
          phone: null,
          role: 'ADMIN',
          verified: true,
          staffPermissions: ['MANAGE', 'VIEW'],
          organizationUnitId: null,
          organizationUnit: null,
        },
      });
      // Synchronous getSession() for route guards must immediately reflect the stored session
      assert.equal(getSession()?.user.fullName, 'Chủ Trì Kiểm Thử');

      // During server/hydration snapshot (renderToString uses getServerSnapshot in React 19),
      // useSession() must return null so initial hydration HTML matches SSR HTML ("Đăng nhập", not user name)
      function SessionProbe() {
        const current = useSession();
        return createElement('span', null, current ? current.user.fullName : 'Đăng nhập');
      }
      const serverSnapshotHtml = renderToString(createElement(SessionProbe));
      assert.ok(
        serverSnapshotHtml.includes('Đăng nhập'),
        'Server/hydration snapshot of useSession() must render "Đăng nhập" even when client localStorage has a session',
      );
      assert.ok(
        !serverSnapshotHtml.includes('Chủ Trì Kiểm Thử'),
        'Server/hydration snapshot of useSession() must not leak client session user before hydration completes',
      );
    } finally {
      setSession(null);
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else delete globalThis.window;
    }

    // 9. Node HTTP SSR handler (createWebSsrServer) serves homepage over real HTTP
    const { createWebSsrServer } = await server.ssrLoadModule('/src/server.ts');
    baseRequest.defaults.adapter = async (config) => {
      if (config.url === '/categories') {
        return { status: 200, statusText: '200', data: { data: categoriesFixture }, headers: {}, config };
      }
      return {
        status: 200,
        statusText: '200',
        data: {
          data: [mixedProductsFixture[0]],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        },
        headers: {},
        config,
      };
    };
    const httpServer = createWebSsrServer({ publicOrigin: 'https://ocop.vn' });
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    try {
      const addr = httpServer.address();
      const httpRes = await fetch(`http://127.0.0.1:${addr.port}/`);
      assert.equal(httpRes.status, 200);
      assert.equal(httpRes.headers.get('cache-control'), 'no-store');
      const httpText = await httpRes.text();
      assert.ok(httpText.includes('Trà Shan Tuyết Cổ Thụ'));
      assert.ok(httpText.includes('https://ocop.vn/'));
    } finally {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    console.log('PASS home-ssr: eligibility, SSR HTML, metadata, isolation, error status, selective SSR');
  } finally {
    baseRequest.defaults.adapter = originalAdapter;
  }
} finally {
  await server.close();
}
