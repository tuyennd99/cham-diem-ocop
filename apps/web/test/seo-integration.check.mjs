import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViteSsrTestServer } from './support/vite-ssr-test-server.mjs';

const server = await createViteSsrTestServer();

try {
  const { AxiosError } = await import('axios');
  const { default: baseRequest } = await server.ssrLoadModule('/src/api/base-request.ts');
  const { renderAppRequest } = await server.ssrLoadModule('/src/entry-server.tsx');
  const { createWebSsrServer } = await server.ssrLoadModule('/src/server.ts');
  const { createAppRouter, router } = await server.ssrLoadModule('/src/router.tsx');
  const { getSession, setSession } = await server.ssrLoadModule('/src/stores/session-store.ts');

  const originalAdapter = baseRequest.defaults.adapter;

  const categoriesFixture = [
    { id: 'cat-food', name: 'Thực phẩm' },
    { id: 'cat-drink', name: 'Đồ uống' },
  ];

  function createUnifiedDataset() {
    // 11 SEO-eligible products (spanning > 1 catalog page with default limit=10, and > 1 sitemap page when page size is small)
    const eligibleProducts = [
      {
        id: 'prod-approved-01',
        name: 'Trà Shan Tuyết Cổ Thụ Suối Giàng',
        description: 'Đặc sản trà vùng cao Yên Bái đã được Chủ trì duyệt.',
        status: 'APPROVED',
        approvedAt: '2026-10-01T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-01T10:00:00.000Z',
        category: { id: 'cat-drink', name: 'Đồ uống' },
        attachments: [{ id: 'att-tea-01', fileName: 'tea-01.jpg' }],
      },
      {
        id: 'prod-scoring-02',
        name: 'Mật Ong Bạc Hà Hà Giang',
        description: 'Đang chấm điểm sau khi duyệt, chưa công bố kết quả.',
        status: 'SCORING',
        approvedAt: '2026-10-02T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        // Internal raw score/stars that MUST NOT leak anywhere in HTML, meta, or sitemap
        finalScore: 97.65,
        starRating: 5,
        createdAt: '2026-10-02T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-completed-published-03',
        name: 'Cà Phê Đặc Sản Cầu Đất',
        description: 'Hoàn tất chấm điểm và đã công bố kết quả chính thức.',
        status: 'COMPLETED',
        approvedAt: '2026-10-03T08:00:00.000Z',
        publicationState: 'PUBLISHED',
        finalScore: 92.5,
        starRating: 4,
        createdAt: '2026-10-03T10:00:00.000Z',
        category: { id: 'cat-drink', name: 'Đồ uống' },
        attachments: [{ id: 'att-coffee-03', fileName: 'coffee-03.jpg' }],
      },
      {
        id: 'prod-completed-updating-04',
        name: 'Sâm Ngọc Linh Kon Tum',
        description: 'Đã hoàn tất nhưng đang cập nhật kết quả chấm bổ sung.',
        status: 'COMPLETED',
        approvedAt: '2026-10-04T08:00:00.000Z',
        publicationState: 'UPDATING',
        // Internal updating score/stars that MUST NOT leak anywhere
        finalScore: 89.4,
        starRating: 4,
        createdAt: '2026-10-04T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      // Product ID with XML/URL special characters (`&`, `'`) to test XML escaping & URL encoding in sitemap
      {
        id: "prod-xml-escape-05&'special",
        name: 'Gạo ST25 & Đặc Sản Sóc Trăng',
        description: 'Mô tả có ký tự đặc biệt & < > " \'.',
        status: 'APPROVED',
        approvedAt: '2026-10-05T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-05T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      ...Array.from({ length: 7 }, (_, i) => {
        const num = i + 6;
        return {
          id: `prod-approved-${String(num).padStart(2, '0')}`,
          name: `Sản Phẩm Chuẩn OCOP Số ${String(num).padStart(2, '0')}`,
          description: `Mô tả công khai cho sản phẩm số ${num}.`,
          status: 'APPROVED',
          approvedAt: `2026-10-${String(num).padStart(2, '0')}T08:00:00.000Z`,
          publicationState: 'UNPUBLISHED',
          finalScore: null,
          starRating: null,
          createdAt: `2026-10-${String(num).padStart(2, '0')}T10:00:00.000Z`,
          category: num % 2 === 0 ? { id: 'cat-food', name: 'Thực phẩm' } : { id: 'cat-drink', name: 'Đồ uống' },
          attachments: [],
        };
      }),
    ];

    const ineligibleProducts = [
      {
        id: 'prod-draft-ineligible',
        name: 'Hồ Sơ Bản Nháp Đang Soạn',
        description: 'Không công khai, không lập chỉ mục.',
        status: 'DRAFT',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-15T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-submitted-ineligible',
        name: 'Bánh Pía Sóc Trăng Mới Nộp Chờ Duyệt',
        description: 'Truy cập trực tiếp công khai được nhưng phải có noindex và không nằm trong danh sách hay sitemap.',
        status: 'SUBMITTED',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-16T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-returned-ineligible',
        name: 'Hồ Sơ Đã Bị Chủ Trì Trả Lại',
        description: 'Trả 404 và không xuất hiện trong danh sách hay sitemap.',
        status: 'RETURNED',
        approvedAt: '2026-10-01T08:00:00.000Z',
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-17T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-legacy-scoring-no-approval',
        name: 'Nước Mắm Cổ Truyền Đang Chấm Thiếu Dấu Vết Duyệt',
        description: 'Hồ sơ cũ SCORING nhưng approvedAt=null -> không đủ điều kiện SEO.',
        status: 'SCORING',
        approvedAt: null,
        publicationState: 'UNPUBLISHED',
        finalScore: null,
        starRating: null,
        createdAt: '2026-10-18T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
      {
        id: 'prod-legacy-completed-no-approval',
        name: 'Tỏi Đen Lý Sơn Hoàn Tất Thiếu Dấu Vết Duyệt',
        description: 'Hồ sơ cũ COMPLETED nhưng approvedAt=null -> không đủ điều kiện SEO.',
        status: 'COMPLETED',
        approvedAt: null,
        publicationState: 'PUBLISHED',
        finalScore: 86.0,
        starRating: 4,
        createdAt: '2026-10-19T10:00:00.000Z',
        category: { id: 'cat-food', name: 'Thực phẩm' },
        attachments: [],
      },
    ];

    return [...eligibleProducts, ...ineligibleProducts];
  }

  let dataset = createUnifiedDataset();
  let maxSitemapPageSize = 5; // Force /sitemap.xml to iterate across 3 pages for 12 eligible items
  let injectDuplicateAndIneligibleInList = true;
  let failOnListPage = null;

  try {
    baseRequest.defaults.adapter = async (config) => {
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
        const params = config.params ?? {};
        const page = Number(params.page ?? 1);
        const requestedLimit = Number(params.limit ?? 10);
        // If requestedLimit is large (e.g. 100 from sitemap), cap by maxSitemapPageSize so we test multi-page sitemap iteration!
        const effectiveLimit = requestedLimit > 20 ? maxSitemapPageSize : requestedLimit;
        const categoryId = params.categoryId;
        const q = params.q ? String(params.q).toLowerCase() : '';

        if (failOnListPage !== null && page === failOnListPage) {
          const response = {
            status: 503,
            statusText: '503',
            data: { message: 'Upstream database unavailable on page ' + page },
            headers: {},
            config,
          };
          throw new AxiosError('Service Unavailable', undefined, config, null, response);
        }

        const eligiblePool = dataset.filter(
          (item) =>
            Boolean(item.approvedAt) &&
            ['APPROVED', 'SCORING', 'COMPLETED'].includes(item.status),
        );
        const filteredPool = eligiblePool.filter((item) => {
          if (categoryId && item.category.id !== categoryId) return false;
          if (
            q &&
            !item.name.toLowerCase().includes(q) &&
            !item.id.toLowerCase().includes(q) &&
            !item.category.name.toLowerCase().includes(q)
          ) {
            return false;
          }
          return true;
        });

        const total = filteredPool.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / effectiveLimit);
        const start = (page - 1) * effectiveLimit;
        let slice = filteredPool.slice(start, start + effectiveLimit);

        // Inject a duplicate eligible item and an ineligible item to verify defense-in-depth filtering & deduplication
        if (injectDuplicateAndIneligibleInList && slice.length > 0) {
          const ineligibleSample = dataset.find((item) => item.status === 'SUBMITTED');
          const legacyNoApprovalSample = dataset.find(
            (item) => item.status === 'SCORING' && !item.approvedAt,
          );
          slice = [
            ...slice,
            slice[0], // duplicate
            ...(ineligibleSample ? [ineligibleSample] : []),
            ...(legacyNoApprovalSample ? [legacyNoApprovalSample] : []),
          ];
        }

        return {
          status: 200,
          statusText: '200',
          data: {
            data: slice,
            meta: {
              page,
              limit: effectiveLimit,
              total,
              totalPages,
            },
          },
          headers: {},
          config,
        };
      }

      if (config.url?.startsWith('/products/')) {
        const id = decodeURIComponent(config.url.slice('/products/'.length));
        const product = dataset.find((item) => item.id === id);
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

    const httpServer = createWebSsrServer({ publicOrigin: 'https://ocop.vn' });
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

    try {
      const addr = httpServer.address();
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      // -------------------------------------------------------------------------
      // 1. Verify /robots.txt & /og-default.png over HTTP
      // -------------------------------------------------------------------------
      const ogDefaultRes = await fetch(`${baseUrl}/og-default.png`);
      assert.equal(ogDefaultRes.status, 200, '/og-default.png must return 200 OK over HTTP');
      assert.equal(
        ogDefaultRes.headers.get('content-type'),
        'image/png',
        '/og-default.png must return Content-Type: image/png over HTTP',
      );
      const ogDefaultBytes = new Uint8Array(await ogDefaultRes.arrayBuffer());
      assert.deepEqual(
        Array.from(ogDefaultBytes.slice(0, 8)),
        [137, 80, 78, 71, 13, 10, 26, 10],
        '/og-default.png must be a valid PNG image',
      );

      const robotsRes = await fetch(`${baseUrl}/robots.txt`);
      assert.equal(robotsRes.status, 200, '/robots.txt must return 200 OK');
      assert.match(
        robotsRes.headers.get('content-type') ?? '',
        /^text\/plain;\s*charset=utf-8$/i,
        '/robots.txt must have text/plain; charset=utf-8 content-type',
      );
      assert.equal(
        robotsRes.headers.get('cache-control'),
        'no-store',
        '/robots.txt must have Cache-Control: no-store',
      );
      const robotsText = await robotsRes.text();
      assert.match(robotsText, /User-agent:\s*\*/i);
      assert.match(robotsText, /Allow:\s*\/\s*$/m);
      assert.match(
        robotsText,
        /Sitemap:\s*https:\/\/ocop\.vn\/sitemap\.xml/i,
        '/robots.txt must point to Sitemap: https://ocop.vn/sitemap.xml',
      );
      assert.doesNotMatch(
        robotsText,
        /Disallow:\s*\/products/i,
        '/robots.txt must NOT Disallow /products so crawlers can read noindex on unapproved product pages',
      );

      // -------------------------------------------------------------------------
      // 2. Verify /sitemap.xml over HTTP (multi-page fetch, deduplication, XML escaping, eligibility)
      // -------------------------------------------------------------------------
      const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
      assert.equal(sitemapRes.status, 200, '/sitemap.xml must return 200 OK');
      assert.match(
        sitemapRes.headers.get('content-type') ?? '',
        /^application\/xml;\s*charset=utf-8$/i,
        '/sitemap.xml must have application/xml; charset=utf-8 content-type',
      );
      assert.equal(
        sitemapRes.headers.get('cache-control'),
        'no-store',
        '/sitemap.xml must have Cache-Control: no-store',
      );
      const sitemapXml = await sitemapRes.text();

      assert.match(
        sitemapXml,
        /^<\?xml version="1\.0" encoding="UTF-8"\?>/,
        'Sitemap must start with XML declaration',
      );
      assert.match(
        sitemapXml,
        /<urlset[^>]+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/,
        'Sitemap must contain standard urlset xmlns',
      );

      const locMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      assert.equal(
        locMatches.length,
        new Set(locMatches).size,
        'Sitemap must not contain any duplicate <loc> URLs',
      );

      // Must include homepage and public catalog
      assert.ok(
        locMatches.includes('https://ocop.vn/'),
        'Sitemap must include homepage URL https://ocop.vn/',
      );
      assert.ok(
        locMatches.includes('https://ocop.vn/products'),
        'Sitemap must include public catalog URL https://ocop.vn/products',
      );

      // Must include ALL 12 eligible products across all 3 pages (page 1: 5, page 2: 5, page 3: 2)
      const eligibleIds = dataset
        .filter(
          (item) =>
            Boolean(item.approvedAt) &&
            ['APPROVED', 'SCORING', 'COMPLETED'].includes(item.status),
        )
        .map((item) => item.id);
      assert.equal(eligibleIds.length, 12);

      const { escapeXml } = await server.ssrLoadModule('/src/lib/sitemap.ts');
      assert.equal(typeof escapeXml, 'function');
      assert.equal(
        escapeXml(`https://ocop.vn/products?a=1&b=2<>"'`),
        'https://ocop.vn/products?a=1&amp;b=2&lt;&gt;&quot;&apos;',
      );

      for (const id of eligibleIds) {
        const expectedLoc = escapeXml(`https://ocop.vn/products/${encodeURIComponent(id)}`);
        assert.ok(
          locMatches.includes(expectedLoc),
          `Sitemap must include XML-escaped eligible product URL ${expectedLoc}`,
        );
      }

      // Must NOT include any ineligible products, private routes, or search/filter variants
      for (const ineligibleId of [
        'prod-draft-ineligible',
        'prod-submitted-ineligible',
        'prod-returned-ineligible',
        'prod-legacy-scoring-no-approval',
        'prod-legacy-completed-no-approval',
      ]) {
        assert.ok(
          !sitemapXml.includes(ineligibleId),
          `Sitemap must NOT include ineligible product ID ${ineligibleId}`,
        );
      }
      for (const privateSegment of ['/admin', '/my', '/judge', '/login', '/register', '/print', '?q=', '?categoryId=']) {
        assert.ok(
          !sitemapXml.includes(privateSegment),
          `Sitemap must NOT include private route or filter variant ${privateSegment}`,
        );
      }

      // -------------------------------------------------------------------------
      // 3. Verify consistent SEO eligibility & metadata across /, /products, /products?page=2, /products?q=..., /products/:id
      // -------------------------------------------------------------------------
      const [homeRes, catPage1Res, catPage2Res, catSearchRes] = await Promise.all([
        fetch(`${baseUrl}/`),
        fetch(`${baseUrl}/products`),
        fetch(`${baseUrl}/products?page=2`),
        fetch(`${baseUrl}/products?q=Tr%C3%A0`),
      ]);

      assert.equal(homeRes.status, 200);
      assert.equal(catPage1Res.status, 200);
      assert.equal(catPage2Res.status, 200);
      assert.equal(catSearchRes.status, 200);
      assert.equal(catSearchRes.headers.get('x-robots-tag'), 'noindex');

      const [homeHtml, catPage1Html, catPage2Html, catSearchHtml] = await Promise.all([
        homeRes.text(),
        catPage1Res.text(),
        catPage2Res.text(),
        catSearchRes.text(),
      ]);

      // Canonical URLs on /, /products, /products?page=2
      assert.match(homeHtml, /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/"/i);
      assert.match(catPage1Html, /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products"/i);
      assert.match(
        catPage2Html,
        /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\?page=2"/i,
      );

      // Sequential HTML pagination links
      assert.match(catPage1Html, /<a[^>]+href="\/products\?page=2"[^>]*>/);
      assert.match(catPage2Html, /<a[^>]+href="\/products"[^>]*>/);

      // Eligible items on page 1 vs page 2
      assert.ok(homeHtml.includes('Trà Shan Tuyết Cổ Thụ Suối Giàng'));
      assert.ok(catPage1Html.includes('Trà Shan Tuyết Cổ Thụ Suối Giàng'));
      assert.ok(catPage2Html.includes('Sản Phẩm Chuẩn OCOP Số 11'));
      assert.ok(catPage2Html.includes('Sản Phẩm Chuẩn OCOP Số 12'));

      // Unpublished scores (97.65 for SCORING, 89.4 for UPDATING) must NEVER leak on /, /products, or /products/:id
      for (const html of [homeHtml, catPage1Html, catPage2Html, catSearchHtml]) {
        assert.ok(!html.includes('97.65') && !html.includes('97,65'), 'Unpublished SCORING score must not leak');
        assert.ok(!html.includes('89.4') && !html.includes('89,4'), 'UPDATING score must not leak');
        for (const ineligible of [
          'Hồ Sơ Bản Nháp Đang Soạn',
          'Bánh Pía Sóc Trăng Mới Nộp Chờ Duyệt',
          'Hồ Sơ Đã Bị Chủ Trì Trả Lại',
          'Nước Mắm Cổ Truyền Đang Chấm Thiếu Dấu Vết Duyệt',
          'Tỏi Đen Lý Sơn Hoàn Tất Thiếu Dấu Vết Duyệt',
        ]) {
          assert.ok(!html.includes(ineligible), `Ineligible product "${ineligible}" must not appear in indexable HTML`);
        }
      }

      // Product detail pages across all statuses in the unified dataset
      // (a) Eligible APPROVED product -> 200, indexable, canonical + OG
      const detailApprovedRes = await fetch(`${baseUrl}/products/prod-approved-01`);
      assert.equal(detailApprovedRes.status, 200);
      assert.equal(detailApprovedRes.headers.get('x-robots-tag'), null);
      const detailApprovedHtml = await detailApprovedRes.text();
      assert.match(
        detailApprovedHtml,
        /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\/prod-approved-01"/i,
      );
      assert.match(
        detailApprovedHtml,
        /<meta[^>]+property="og:image"[^>]+content="https:\/\/ocop\.vn\/api\/products\/prod-approved-01\/attachments\/att-tea-01"/i,
      );

      // (b) Eligible COMPLETED + PUBLISHED -> 200, indexable, shows 92.5 score & 4 stars
      const detailPublishedRes = await fetch(`${baseUrl}/products/prod-completed-published-03`);
      assert.equal(detailPublishedRes.status, 200);
      assert.equal(detailPublishedRes.headers.get('x-robots-tag'), null);
      const detailPublishedHtml = await detailPublishedRes.text();
      assert.ok(detailPublishedHtml.includes('92.5') || detailPublishedHtml.includes('92,5'));
      assert.ok(detailPublishedHtml.includes('4 sao'));

      // (c) Eligible SCORING (UNPUBLISHED) & COMPLETED (UPDATING) -> 200, indexable, scores hidden
      for (const [id, secretScore] of [
        ['prod-scoring-02', '97.65'],
        ['prod-completed-updating-04', '89.4'],
      ]) {
        const res = await fetch(`${baseUrl}/products/${id}`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('x-robots-tag'), null);
        const html = await res.text();
        assert.ok(!html.includes(secretScore), `Unpublished score ${secretScore} must not leak on /products/${id}`);
      }

      // (d) SUBMITTED & Legacy SCORING/COMPLETED without approvedAt -> 200, accessible, but noindex!
      for (const unapprovedId of [
        'prod-submitted-ineligible',
        'prod-legacy-scoring-no-approval',
        'prod-legacy-completed-no-approval',
      ]) {
        const res = await fetch(`${baseUrl}/products/${unapprovedId}`);
        assert.equal(res.status, 200, `${unapprovedId} must remain directly accessible with 200`);
        assert.equal(
          res.headers.get('x-robots-tag'),
          'noindex',
          `${unapprovedId} must have X-Robots-Tag: noindex`,
        );
        const html = await res.text();
        assert.match(html, /<meta[^>]+name="robots"[^>]+content="noindex"/i);
        assert.doesNotMatch(html, /<link[^>]+rel="canonical"/i);
      }

      // (e) DRAFT, RETURNED, and non-existent ID -> 404 with noindex
      for (const notFoundId of [
        'prod-draft-ineligible',
        'prod-returned-ineligible',
        'prod-does-not-exist-999',
      ]) {
        const res = await fetch(`${baseUrl}/products/${notFoundId}`);
        assert.equal(res.status, 404, `${notFoundId} must return 404`);
        assert.equal(res.headers.get('x-robots-tag'), 'noindex');
      }

      // -------------------------------------------------------------------------
      // 4. Live State Transitions (Approval & Return reflected immediately without stale cache)
      // -------------------------------------------------------------------------
      // Transition A: Chair approves `prod-submitted-ineligible` -> status becomes APPROVED, approvedAt set,
      // and move it to the front of dataset so it appears on `/` and `/products` page 1 as well as `/sitemap.xml`.
      const newlyApproved = {
        ...dataset.find((item) => item.id === 'prod-submitted-ineligible'),
        status: 'APPROVED',
        approvedAt: '2026-10-25T09:00:00.000Z',
      };
      dataset = [
        newlyApproved,
        ...dataset.filter((item) => item.id !== 'prod-submitted-ineligible'),
      ];

      const [homeAfterApprove, catAfterApprove, detailAfterApprove, sitemapAfterApprove] =
        await Promise.all([
          fetch(`${baseUrl}/`).then((r) => r.text()),
          fetch(`${baseUrl}/products`).then((r) => r.text()),
          fetch(`${baseUrl}/products/prod-submitted-ineligible`),
          fetch(`${baseUrl}/sitemap.xml`).then((r) => r.text()),
        ]);

      assert.ok(
        homeAfterApprove.includes('Bánh Pía Sóc Trăng Mới Nộp Chờ Duyệt'),
        'Newly approved product must immediately appear on homepage `/`',
      );
      assert.ok(
        catAfterApprove.includes('Bánh Pía Sóc Trăng Mới Nộp Chờ Duyệt'),
        'Newly approved product must immediately appear on `/products`',
      );
      assert.equal(detailAfterApprove.status, 200);
      assert.equal(
        detailAfterApprove.headers.get('x-robots-tag'),
        null,
        'Newly approved product detail must immediately remove X-Robots-Tag: noindex',
      );
      const detailAfterApproveHtml = await detailAfterApprove.text();
      assert.match(
        detailAfterApproveHtml,
        /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\/prod-submitted-ineligible"/i,
      );
      assert.ok(
        sitemapAfterApprove.includes('https://ocop.vn/products/prod-submitted-ineligible'),
        'Newly approved product must immediately appear in /sitemap.xml',
      );

      // Transition B: Chair returns `prod-approved-01` -> status becomes RETURNED
      dataset = dataset.map((item) =>
        item.id === 'prod-approved-01' ? { ...item, status: 'RETURNED' } : item,
      );

      const [homeAfterReturn, catAfterReturn, detailAfterReturn, sitemapAfterReturn] =
        await Promise.all([
          fetch(`${baseUrl}/`).then((r) => r.text()),
          fetch(`${baseUrl}/products`).then((r) => r.text()),
          fetch(`${baseUrl}/products/prod-approved-01`),
          fetch(`${baseUrl}/sitemap.xml`).then((r) => r.text()),
        ]);

      assert.ok(
        !homeAfterReturn.includes('Trà Shan Tuyết Cổ Thụ Suối Giàng'),
        'Returned product must immediately disappear from homepage `/`',
      );
      assert.ok(
        !catAfterReturn.includes('Trà Shan Tuyết Cổ Thụ Suối Giàng'),
        'Returned product must immediately disappear from `/products`',
      );
      assert.equal(
        detailAfterReturn.status,
        404,
        'Returned product detail must immediately return 404',
      );
      assert.equal(detailAfterReturn.headers.get('x-robots-tag'), 'noindex');
      assert.ok(
        !sitemapAfterReturn.includes('prod-approved-01'),
        'Returned product must immediately disappear from /sitemap.xml',
      );

      // -------------------------------------------------------------------------
      // 5. Sitemap API failure handling (must return 5xx error, NEVER 200 empty sitemap)
      // -------------------------------------------------------------------------
      failOnListPage = 2; // Fail on page 2 while page 1 succeeds!
      try {
        const failedSitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
        assert.ok(
          failedSitemapRes.status >= 500,
          `Expected 5xx when backend fails on page 2 of sitemap fetch, got ${failedSitemapRes.status}`,
        );
        assert.equal(failedSitemapRes.headers.get('cache-control'), 'no-store');
        const failedBody = await failedSitemapRes.text();
        assert.ok(
          !failedBody.includes('<urlset'),
          'Failed sitemap response must NOT return a partial or empty <urlset>',
        );
      } finally {
        failOnListPage = null;
      }

      // -------------------------------------------------------------------------
      // 6. Auth, Role/Permission Guards, and Concurrent Session Isolation
      // -------------------------------------------------------------------------
      // Include registration-unit settings alongside the existing page routes.
      const routePaths = Object.values(router.routesById)
        .filter((route) => route.options.path)
        .map((route) => (route.fullPath === '/' ? '/' : route.fullPath.replace(/\/$/, '')));
      assert.equal(new Set(routePaths).size, 37, 'Router must preserve exact 37 unique page route paths');
      assert.ok(routePaths.includes('/my/settings'));

      // Verify client-mode auth & workspace routes render shell with 200 on SSR without server redirect
      for (const clientPath of ['/login', '/my/products', '/admin/products', '/judge']) {
        const res = await fetch(`${baseUrl}${clientPath}`);
        assert.equal(res.status, 200, `${clientPath} must return 200 client shell on SSR`);
      }

      // Verify two concurrent router/session instances with different roles (Người dùng vs Giám khảo/Chủ trì)
      // do not leak session or query cache across requests
      const registrantSession = {
        accessToken: 'token-registrant',
        user: {
          id: 'u-reg',
          email: 'registrant@ocop.vn',
          fullName: 'Người Dùng OCOP',
          phone: null,
          role: 'REGISTRANT',
          verified: true,
          staffPermissions: [],
          organizationUnitId: null,
          organizationUnit: null,
        },
      };
      const chairSession = {
        accessToken: 'token-chair',
        user: {
          id: 'u-chair',
          email: 'chair@ocop.vn',
          fullName: 'Chủ Trì OCOP',
          phone: null,
          role: 'ADMIN',
          verified: true,
          staffPermissions: ['MANAGE', 'VIEW'],
          organizationUnitId: null,
          organizationUnit: null,
        },
      };
      const judgeSession = {
        accessToken: 'token-judge',
        user: {
          id: 'u-judge',
          email: 'judge@ocop.vn',
          fullName: 'Giám Khảo OCOP',
          phone: null,
          role: 'JUDGE',
          verified: true,
          staffPermissions: ['SCORE'],
          organizationUnitId: null,
          organizationUnit: null,
        },
      };

      const checkRouteGuards = (targetRouter, path) => {
        const matchedRoutes = targetRouter
          .matchRoutes(path)
          .map((m) => targetRouter.routesById[m.routeId]);
        for (const r of matchedRoutes) {
          r.options.beforeLoad?.({ context: targetRouter.options.context });
        }
      };

      const registrantRouter = createAppRouter({ getSession: () => registrantSession });
      const chairRouter = createAppRouter({ getSession: () => chairSession });
      const judgeRouter = createAppRouter({ getSession: () => judgeSession });
      const anonRouter = createAppRouter({ getSession: () => null });

      assert.doesNotThrow(() => checkRouteGuards(registrantRouter, '/my/products'));
      assert.doesNotThrow(() => checkRouteGuards(registrantRouter, '/my/products/prod-1/edit'));
      assert.throws(
        () => checkRouteGuards(registrantRouter, '/admin/products'),
        (err) => err?.options?.to === '/403',
      );
      assert.doesNotThrow(() => checkRouteGuards(chairRouter, '/admin/products'));
      assert.doesNotThrow(() => checkRouteGuards(judgeRouter, '/judge'));
      assert.throws(
        () => checkRouteGuards(judgeRouter, '/my/products/prod-1/edit'),
        (err) => err?.options?.to === '/403',
      );
      assert.throws(
        () => checkRouteGuards(anonRouter, '/my/products'),
        (err) => err?.options?.to === '/login',
      );

      // Concurrent SSR requests while a client session is active in sessionStore must NOT leak user name/token into SSR HTML or sitemap
      setSession(chairSession);
      try {
        const [concurrentHome1, concurrentHome2, concurrentSitemap] = await Promise.all([
          renderAppRequest(new Request('https://alpha.ocop.vn/')),
          renderAppRequest(new Request('https://beta.ocop.vn/')),
          renderAppRequest(new Request('https://alpha.ocop.vn/sitemap.xml')),
        ]);
        const [h1, h2, sm] = await Promise.all([
          concurrentHome1.text(),
          concurrentHome2.text(),
          concurrentSitemap.text(),
        ]);
        assert.ok(!h1.includes('Chủ Trì OCOP') && !h1.includes('token-chair'));
        assert.ok(!h2.includes('Chủ Trì OCOP') && !h2.includes('token-chair'));
        assert.match(h1, /href="https:\/\/alpha\.ocop\.vn\/"/);
        assert.match(h2, /href="https:\/\/beta\.ocop\.vn\/"/);
        assert.ok(sm.includes('<loc>https://alpha.ocop.vn/</loc>'));
      } finally {
        setSession(null);
      }

      // -------------------------------------------------------------------------
      // 7. Static asset boundary & path traversal protection in createWebSsrServer
      // -------------------------------------------------------------------------
      const tmpParent = mkdtempSync(join(tmpdir(), 'ocop-ssr-static-'));
      const distDir = join(tmpParent, 'dist');
      const siblingDir = join(tmpParent, 'dist-sibling');
      mkdirSync(distDir, { recursive: true });
      mkdirSync(siblingDir, { recursive: true });
      writeFileSync(join(tmpParent, 'package.json'), '{"name":"secret-root-pkg"}');
      writeFileSync(join(siblingDir, 'secret.txt'), 'TOP_SECRET_SIBLING_DATA');
      writeFileSync(join(distDir, 'allowed.txt'), 'PUBLIC_STATIC_ASSET');

      const staticTestServer = createWebSsrServer({
        clientDistDir: distDir,
        publicOrigin: 'https://ocop.vn',
      });
      await new Promise((resolve) => staticTestServer.listen(0, '127.0.0.1', resolve));
      try {
        const staticPort = staticTestServer.address().port;
        const staticBase = `http://127.0.0.1:${staticPort}`;

        for (const traversalPath of [
          '/../package.json',
          '/%2e%2e/package.json',
          '/../dist-sibling/secret.txt',
          '/%2e%2e/dist-sibling/secret.txt',
        ]) {
          const res = await fetch(`${staticBase}${traversalPath}`);
          const text = await res.text();
          assert.ok(
            !text.includes('secret-root-pkg') && !text.includes('TOP_SECRET_SIBLING_DATA'),
            `Path traversal ${traversalPath} must never serve files outside clientDistDir`,
          );
        }
      } finally {
        await new Promise((resolve) => staticTestServer.close(resolve));
        rmSync(tmpParent, { recursive: true, force: true });
      }

      // -------------------------------------------------------------------------
      // 8. Client hydration consistency (main.tsx & __root.tsx)
      // -------------------------------------------------------------------------
      const mainTsxSource = readFileSync(
        fileURLToPath(new URL('../src/main.tsx', import.meta.url)),
        'utf8',
      );
      const rootRouteSource = readFileSync(
        fileURLToPath(new URL('../src/routes/__root.tsx', import.meta.url)),
        'utf8',
      );
      assert.ok(
        !mainTsxSource.includes('QueryClientProvider'),
        'main.tsx must not wrap RouterProvider in a duplicate outer QueryClientProvider',
      );
      assert.ok(
        rootRouteSource.includes('<HeadContent />'),
        '__root.tsx shellComponent must render <HeadContent /> for both SSR and client hydration',
      );

      console.log(
        'PASS seo-integration: /robots.txt, multi-page /sitemap.xml, XML escaping, unified eligibility across /, /products, /products/:id, live approval/return transitions, 5xx on sitemap API failure, guards & concurrent isolation',
      );
    } finally {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  } finally {
    baseRequest.defaults.adapter = originalAdapter;
  }
} finally {
  await server.close();
}
