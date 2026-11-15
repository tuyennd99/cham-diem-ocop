import assert from 'node:assert/strict';
import { createViteSsrTestServer } from './support/vite-ssr-test-server.mjs';

const server = await createViteSsrTestServer();

try {
  const { AxiosError } = await import('axios');
  const { default: baseRequest } = await server.ssrLoadModule('/src/api/base-request.ts');
  const { renderAppRequest } = await server.ssrLoadModule('/src/entry-server.tsx');
  const { createWebSsrServer } = await server.ssrLoadModule('/src/server.ts');

  const originalAdapter = baseRequest.defaults.adapter;

  const productsById = new Map();

  function setProducts(items) {
    productsById.clear();
    for (const item of items) {
      productsById.set(item.id, item);
    }
  }

  try {
    baseRequest.defaults.adapter = async (config) => {
      if (config.url?.startsWith('/products/')) {
        const id = decodeURIComponent(config.url.slice('/products/'.length));
        if (id === 'server-error-500') {
          const response = {
            status: 500,
            statusText: '500',
            data: { message: 'Internal Server Error' },
            headers: {},
            config,
          };
          throw new AxiosError('Internal Server Error', undefined, config, null, response);
        }
        if (id === 'network-timeout') {
          throw new AxiosError('Network Error', 'ECONNREFUSED', config);
        }
        const product = productsById.get(id);
        if (!product || product.status === 'DRAFT' || product.status === 'RETURNED') {
          const response = {
            status: 404,
            statusText: '404',
            data: { message: 'Product not found' },
            headers: {},
            config,
          };
          throw new AxiosError('Not Found', undefined, config, null, response);
        }
        return {
          status: 200,
          statusText: '200',
          data: { data: product },
          headers: {},
          config,
        };
      }
      throw new Error(`Unexpected request URL: ${config.url}`);
    };

    // 1. Eligible products (APPROVED, SCORING, COMPLETED with approvedAt) render full SEO metadata & Open Graph
    setProducts([
      {
        id: 'prod-approved-1',
        name: 'Trà Shan Tuyết Cổ Thụ Suối Giàng',
        description: 'Trà cổ thụ tự nhiên trên đỉnh Suối Giàng.',
        status: 'APPROVED',
        approvedAt: '2026-10-01T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        category: { id: 'cat-drink', name: 'Đồ uống' },
        attachments: [{ id: 'att-tea-1', fileName: 'tea-1.jpg' }],
      },
      {
        id: 'prod-scoring-fallback',
        name: 'Mật Ong Rừng U Minh',
        description: '   ', // blank description -> must use safe Vietnamese fallback
        status: 'SCORING',
        approvedAt: '2026-10-02T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        // Simulate accidental raw score in payload when UNPUBLISHED -> must never leak!
        finalScore: 96.4,
        starRating: 5,
        createdAt: '2026-10-02T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [], // no attachments -> must use absolute fallback og:image
      },
      {
        id: 'prod-completed-published',
        name: 'Cà Phê Đặc Sản Cầu Đất',
        description: 'Hạt cà phê Arabica rang mộc.',
        status: 'COMPLETED',
        approvedAt: '2026-10-03T08:00:00.000Z',
        publicationState: 'PUBLISHED',
        finalScore: 91.25,
        starRating: 4,
        createdAt: '2026-10-03T00:00:00.000Z',
        category: { id: 'cat-drink', name: 'Đồ uống' },
        attachments: [{ id: 'att-coffee-1', fileName: 'coffee.jpg' }],
      },
      {
        id: 'prod-completed-unpublished',
        name: 'Yến Sào Khánh Hòa Cao Cấp',
        description: 'Tổ yến tinh chế nguyên chất.',
        status: 'COMPLETED',
        approvedAt: '2026-10-04T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        // Simulate accidental raw score in payload when UNPUBLISHED -> must never leak in HTML or meta!
        finalScore: 88.75,
        starRating: 4,
        createdAt: '2026-10-04T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [{ id: 'att-yen-1', fileName: 'yen.jpg' }],
      },
      {
        id: 'prod-completed-updating',
        name: 'Sâm Ngọc Linh Kon Tum',
        description: 'Sâm núi tự nhiên.',
        status: 'COMPLETED',
        approvedAt: '2026-10-04T09:00:00.000Z',
        publicationState: 'UPDATING',
        // Simulate accidental raw score in payload when UPDATING -> must never leak in HTML or meta!
        finalScore: 94.2,
        starRating: 5,
        createdAt: '2026-10-04T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
    ]);

    // 1a. APPROVED product with image and description
    const approvedRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-approved-1'),
    );
    assert.equal(approvedRes.status, 200);
    assert.equal(approvedRes.headers.get('cache-control'), 'no-store');
    assert.equal(
      approvedRes.headers.get('x-robots-tag'),
      null,
      'SEO-eligible APPROVED product must not have X-Robots-Tag: noindex',
    );
    const approvedHtml = await approvedRes.text();
    assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(approvedHtml));
    assert.match(approvedHtml, /<title>Trà Shan Tuyết Cổ Thụ Suối Giàng — OCOP Đánh Giá<\/title>/);
    assert.match(
      approvedHtml,
      /<meta[^>]+name="description"[^>]+content="Trà cổ thụ tự nhiên trên đỉnh Suối Giàng\."/i,
    );
    assert.match(
      approvedHtml,
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\/prod-approved-1"/i,
    );
    assert.match(
      approvedHtml,
      /<meta[^>]+property="og:title"[^>]+content="Trà Shan Tuyết Cổ Thụ Suối Giàng — OCOP Đánh Giá"/i,
    );
    assert.match(
      approvedHtml,
      /<meta[^>]+property="og:description"[^>]+content="Trà cổ thụ tự nhiên trên đỉnh Suối Giàng\."/i,
    );
    assert.match(approvedHtml, /<meta[^>]+property="og:type"[^>]+content="website"/i);
    assert.match(
      approvedHtml,
      /<meta[^>]+property="og:url"[^>]+content="https:\/\/ocop\.vn\/products\/prod-approved-1"/i,
    );
    assert.match(
      approvedHtml,
      /<meta[^>]+property="og:image"[^>]+content="https:\/\/ocop\.vn\/api\/products\/prod-approved-1\/attachments\/att-tea-1"/i,
    );
    assert.ok(approvedHtml.includes('Trà Shan Tuyết Cổ Thụ Suối Giàng'));
    assert.ok(approvedHtml.includes('Trà cổ thụ tự nhiên trên đỉnh Suối Giàng.'));
    assert.match(
      approvedHtml,
      /<a[^>]+href="\/products"[^>]*>← Danh sách sản phẩm<\/a>/,
      'Product detail SSR HTML must contain crawlable back link to /products',
    );

    // 1b. SCORING product with approvedAt, missing description & missing image -> uses fallbacks, hides unpublished scores
    const fallbackRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-scoring-fallback'),
    );
    assert.equal(fallbackRes.status, 200);
    assert.equal(fallbackRes.headers.get('x-robots-tag'), null);
    const fallbackHtml = await fallbackRes.text();
    assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(fallbackHtml));
    assert.match(fallbackHtml, /<title>Mật Ong Rừng U Minh — OCOP Đánh Giá<\/title>/);
    assert.match(
      fallbackHtml,
      /<meta[^>]+name="description"[^>]+content="[^"]*Mật Ong Rừng U Minh[^"]*Thực phẩm[^"]*"/i,
    );
    assert.match(
      fallbackHtml,
      /<meta[^>]+property="og:description"[^>]+content="[^"]*Mật Ong Rừng U Minh[^"]*Thực phẩm[^"]*"/i,
    );
    assert.match(
      fallbackHtml,
      /<meta[^>]+property="og:image"[^>]+content="https:\/\/ocop\.vn\/og-default\.png"/i,
    );
    const defaultOgImageRes = await renderAppRequest(
      new Request('https://ocop.vn/og-default.png'),
    );
    assert.equal(defaultOgImageRes.status, 200, '/og-default.png must return 200 OK');
    assert.equal(
      defaultOgImageRes.headers.get('content-type'),
      'image/png',
      '/og-default.png must return Content-Type: image/png',
    );
    const defaultOgBytes = new Uint8Array(await defaultOgImageRes.arrayBuffer());
    assert.deepEqual(
      Array.from(defaultOgBytes.slice(0, 8)),
      [137, 80, 78, 71, 13, 10, 26, 10],
      '/og-default.png must start with valid PNG magic bytes',
    );
    assert.ok(
      !fallbackHtml.includes('96.4') && !fallbackHtml.includes('96,4'),
      'Unpublished score must NEVER leak in HTML or dehydrated state',
    );

    // 1c. COMPLETED product with PUBLISHED results -> displays published score/stars, no fake AggregateRating/Review
    const publishedRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-completed-published'),
    );
    assert.equal(publishedRes.status, 200);
    assert.equal(publishedRes.headers.get('x-robots-tag'), null);
    const publishedHtml = await publishedRes.text();
    assert.ok(
      publishedHtml.includes('91.25 / 100 điểm') || publishedHtml.includes('91,25 / 100 điểm'),
      'Published score must be rendered in COMPLETED PUBLISHED product detail HTML',
    );
    assert.ok(
      publishedHtml.includes('4 sao'),
      'Published starRating must be rendered in COMPLETED PUBLISHED product detail HTML',
    );
    assert.ok(
      !publishedHtml.includes('AggregateRating') && !publishedHtml.includes('"@type":"Review"'),
      'Must NOT generate fake customer review schema from OCOP score',
    );

    // 1d. COMPLETED product with UNPUBLISHED results -> does not leak score/stars in HTML, meta, or dehydrated state
    const unpublishedCompletedRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-completed-unpublished'),
    );
    assert.equal(unpublishedCompletedRes.status, 200);
    assert.equal(unpublishedCompletedRes.headers.get('x-robots-tag'), null);
    const unpublishedCompletedHtml = await unpublishedCompletedRes.text();
    assert.ok(
      !unpublishedCompletedHtml.includes('88.75') && !unpublishedCompletedHtml.includes('88,75'),
      'Unpublished finalScore must NEVER appear in HTML, metadata, or dehydrated query state',
    );
    assert.ok(
      !unpublishedCompletedHtml.includes('4 sao'),
      'Unpublished starRating must NEVER appear in HTML or metadata',
    );
    assert.ok(
      unpublishedCompletedHtml.includes(
        'Hồ sơ đã hoàn tất chấm điểm và đang chờ công bố kết quả chính thức.',
      ),
    );

    // 1e. COMPLETED product with UPDATING results -> does not leak score/stars in HTML, meta, or dehydrated state
    const updatingCompletedRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-completed-updating'),
    );
    assert.equal(updatingCompletedRes.status, 200);
    assert.equal(updatingCompletedRes.headers.get('x-robots-tag'), null);
    const updatingCompletedHtml = await updatingCompletedRes.text();
    assert.ok(
      !updatingCompletedHtml.includes('94.2') && !updatingCompletedHtml.includes('94,2'),
      'UPDATING finalScore must NEVER appear in HTML, metadata, or dehydrated query state',
    );
    assert.ok(
      !updatingCompletedHtml.includes('5 sao'),
      'UPDATING starRating must NEVER appear in HTML or metadata',
    );
    assert.ok(
      updatingCompletedHtml.includes(
        'Kết quả đang được cập nhật sau khi có phiếu chấm bổ sung và chờ công bố lại.',
      ),
    );

    // 1f. Dehydration & hydration of product detail query state across server and client router instances
    const { createAppRouter } = await server.ssrLoadModule('/src/router.tsx');
    const { createMemoryHistory } = await import('@tanstack/react-router');
    const { queryKeys } = await server.ssrLoadModule('/src/constants/query-key.ts');
    const ssrRouter = createAppRouter({ origin: 'https://ocop.vn' });
    ssrRouter.update({
      history: createMemoryHistory({ initialEntries: ['/products/prod-approved-1'] }),
    });
    await ssrRouter.load();
    const dehydratedPayload = ssrRouter.options.dehydrate();
    const clientRouter = createAppRouter({ origin: 'https://ocop.vn' });
    clientRouter.options.hydrate(dehydratedPayload);
    const hydratedProduct = clientRouter.options.context.queryClient.getQueryData(
      queryKeys.publicProducts.detail('prod-approved-1'),
    );
    assert.equal(hydratedProduct?.name, 'Trà Shan Tuyết Cổ Thụ Suối Giàng');

    // 2. Direct access to SUBMITTED product -> HTTP 200 with content AND noindex (HTML meta + HTTP X-Robots-Tag)
    setProducts([
      {
        id: 'prod-submitted-1',
        name: 'Bánh Pía Sóc Trăng Mới Nộp',
        description: 'Hồ sơ vừa nộp chờ Chủ trì duyệt.',
        status: 'SUBMITTED',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-05T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-draft-1',
        name: 'Hồ Sơ Bản Nháp',
        description: 'Không công khai.',
        status: 'DRAFT',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-05T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
    ]);

    const submittedRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-submitted-1'),
    );
    assert.equal(submittedRes.status, 200, 'SUBMITTED product must remain publicly accessible (200)');
    assert.equal(submittedRes.headers.get('x-robots-tag'), 'noindex');
    assert.equal(submittedRes.headers.get('cache-control'), 'no-store');
    const submittedHtml = await submittedRes.text();
    assert.ok(submittedHtml.includes('Bánh Pía Sóc Trăng Mới Nộp'));
    assert.ok(submittedHtml.includes('Hồ sơ vừa nộp chờ Chủ trì duyệt.'));
    assert.match(submittedHtml, /<meta[^>]+name="robots"[^>]+content="noindex"/i);
    assert.ok(
      !/<link[^>]+rel="canonical"/i.test(submittedHtml),
      'Ineligible SUBMITTED product should not emit indexable canonical link',
    );

    // Non-public (DRAFT) and non-existent IDs -> HTTP 404 with noindex and Vietnamese product-not-found UI
    for (const missingId of ['prod-draft-1', 'non-existent-id']) {
      const notFoundRes = await renderAppRequest(
        new Request(`https://ocop.vn/products/${missingId}`),
      );
      assert.equal(notFoundRes.status, 404, `Expected 404 for ${missingId}`);
      assert.equal(notFoundRes.headers.get('x-robots-tag'), 'noindex');
      assert.equal(notFoundRes.headers.get('cache-control'), 'no-store');
      const notFoundHtml = await notFoundRes.text();
      assert.match(notFoundHtml, /<meta[^>]+name="robots"[^>]+content="noindex"/i);
      assert.ok(
        notFoundHtml.includes('Không tìm thấy sản phẩm công khai'),
        '404 product response must render product not found message',
      );
      assert.ok(!notFoundHtml.includes('Hồ Sơ Bản Nháp'));
    }

    // 3. SCORING or COMPLETED without approvedAt -> HTTP 200 with noindex; state transition reflected immediately
    setProducts([
      {
        id: 'prod-scoring-no-approval',
        name: 'Nước Mắm Phú Quốc Cổ Truyền',
        description: 'Đang chấm điểm nhưng thiếu dấu vết duyệt.',
        status: 'SCORING',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-06T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-completed-no-approval',
        name: 'Tỏi Đen Lý Sơn',
        description: 'Hoàn tất chấm nhưng thiếu approvedAt.',
        status: 'COMPLETED',
        approvedAt: null,
        publicationState: 'PUBLISHED',
        finalScore: 85,
        starRating: 4,
        createdAt: '2026-10-06T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
    ]);

    for (const id of ['prod-scoring-no-approval', 'prod-completed-no-approval']) {
      const res = await renderAppRequest(new Request(`https://ocop.vn/products/${id}`));
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get('x-robots-tag'),
        'noindex',
        `${id} without approvedAt must return X-Robots-Tag: noindex`,
      );
      const html = await res.text();
      assert.match(
        html,
        /<meta[^>]+name="robots"[^>]+content="noindex"/i,
        `${id} without approvedAt must render <meta name="robots" content="noindex">`,
      );
    }

    // State transition 1: prod-scoring-no-approval gets approved (approvedAt set) -> next request is indexable!
    productsById.set('prod-scoring-no-approval', {
      ...productsById.get('prod-scoring-no-approval'),
      approvedAt: '2026-10-07T09:00:00.000Z',
    });
    const afterApproveRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-scoring-no-approval'),
    );
    assert.equal(afterApproveRes.status, 200);
    assert.equal(afterApproveRes.headers.get('x-robots-tag'), null);
    const afterApproveHtml = await afterApproveRes.text();
    assert.ok(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(afterApproveHtml));
    assert.match(
      afterApproveHtml,
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\/prod-scoring-no-approval"/i,
    );

    // State transition 2: product is returned (status -> RETURNED) -> next request immediately returns 404 with noindex
    productsById.set('prod-scoring-no-approval', {
      ...productsById.get('prod-scoring-no-approval'),
      status: 'RETURNED',
    });
    const afterReturnRes = await renderAppRequest(
      new Request('https://ocop.vn/products/prod-scoring-no-approval'),
    );
    assert.equal(afterReturnRes.status, 404);
    assert.equal(afterReturnRes.headers.get('x-robots-tag'), 'noindex');

    // 4. Temporary backend error (500 or network error) returns HTTP 500, NEVER 404
    for (const errorId of ['server-error-500', 'network-timeout']) {
      const errRes = await renderAppRequest(new Request(`https://ocop.vn/products/${errorId}`));
      assert.ok(
        errRes.status >= 500,
        `Temporary backend failure (${errorId}) must return 5xx status, got ${errRes.status}`,
      );
      assert.notEqual(errRes.status, 404, 'Temporary backend failure must NOT be turned into 404');
      const errHtml = await errRes.text();
      assert.ok(
        !errHtml.includes('Không tìm thấy sản phẩm công khai'),
        'Temporary backend failure must NOT claim the product does not exist',
      );
    }

    // 5. Special characters (<script>, &, ", ') in product name, description, and category are safely escaped
    setProducts([
      {
        id: 'prod-xss-check',
        name: 'Trà <script>alert("xss")</script> & "Đặc Sản" \'OCOP\'',
        description: 'Mô tả có <b>thẻ HTML</b> & ký tự "nháy kép" cùng \'nháy đơn\'.',
        status: 'APPROVED',
        approvedAt: '2026-10-08T00:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-08T00:00:00.000Z',
        category: { id: 'cat-xss', name: 'Nhóm <Thực Phẩm> & "Đồ Uống"' },
        attachments: [{ id: 'att-xss', fileName: 'xss.jpg' }],
      },
    ]);

    const xssRes = await renderAppRequest(new Request('https://ocop.vn/products/prod-xss-check'));
    assert.equal(xssRes.status, 200);
    const xssHtml = await xssRes.text();
    assert.ok(
      !xssHtml.includes('<script>alert("xss")</script>'),
      'Unescaped <script> tag must never appear in SSR HTML',
    );
    assert.ok(
      xssHtml.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'),
      'Escaped product name must appear in SSR HTML and metadata',
    );
    assert.ok(
      xssHtml.includes(
        'Mô tả có &lt;b&gt;thẻ HTML&lt;/b&gt; &amp; ký tự &quot;nháy kép&quot;',
      ),
      'Escaped product description must appear in SSR HTML and metadata',
    );

    // 6. Real HTTP server integration test for /products/:id (200 eligible, 200 noindex, 404 noindex)
    setProducts([
      {
        id: 'prod-http-ok',
        name: 'Gạo ST25 Sóc Trăng',
        description: 'Gạo thơm đặc sản Sóc Trăng.',
        status: 'APPROVED',
        approvedAt: '2026-10-09T00:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-09T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [{ id: 'att-rice-1', fileName: 'rice.jpg' }],
      },
      {
        id: 'prod-http-submitted',
        name: 'Gạo Lứt Huyết Rồng Mới Nộp',
        description: 'Chờ duyệt.',
        status: 'SUBMITTED',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-09T00:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
    ]);

    const httpServer = createWebSsrServer({ publicOrigin: 'https://ocop.vn' });
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    try {
      const addr = httpServer.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      const okHttpRes = await fetch(`${baseUrl}/products/prod-http-ok`);
      assert.equal(okHttpRes.status, 200);
      assert.equal(okHttpRes.headers.get('cache-control'), 'no-store');
      assert.equal(okHttpRes.headers.get('x-robots-tag'), null);
      const okHttpHtml = await okHttpRes.text();
      assert.ok(okHttpHtml.includes('Gạo ST25 Sóc Trăng'));
      assert.ok(
        okHttpHtml.includes('https://ocop.vn/api/products/prod-http-ok/attachments/att-rice-1'),
      );

      const subHttpRes = await fetch(`${baseUrl}/products/prod-http-submitted`);
      assert.equal(subHttpRes.status, 200);
      assert.equal(subHttpRes.headers.get('x-robots-tag'), 'noindex');

      const nfHttpRes = await fetch(`${baseUrl}/products/does-not-exist`);
      assert.equal(nfHttpRes.status, 404);
      assert.equal(nfHttpRes.headers.get('x-robots-tag'), 'noindex');
    } finally {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    console.log(
      'PASS product-detail-ssr: eligible SEO/OG metadata, fallbacks, SUBMITTED noindex, 404 noindex, missing approvedAt, unpublished score protection, 500 error handling, HTML escaping',
    );
  } finally {
    baseRequest.defaults.adapter = originalAdapter;
  }
} finally {
  await server.close();
}
