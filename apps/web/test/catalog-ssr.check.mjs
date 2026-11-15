import assert from 'node:assert/strict';
import { createViteSsrTestServer } from './support/vite-ssr-test-server.mjs';

const server = await createViteSsrTestServer();

try {
  const { default: baseRequest } = await server.ssrLoadModule('/src/api/base-request.ts');
  const { renderAppRequest } = await server.ssrLoadModule('/src/entry-server.tsx');

  const categoriesFixture = [
    { id: 'cat-food', name: 'Thực phẩm' },
    { id: 'cat-drink', name: 'Đồ uống' },
  ];

  // Build 12 SEO-eligible products + 4 ineligible products to test > 1 page pagination (limit = 10)
  const eligibleProducts = Array.from({ length: 12 }, (_, idx) => {
    const num = idx + 1;
    const isDrink = num % 2 === 1;
    const status = num % 3 === 1 ? 'APPROVED' : num % 3 === 2 ? 'SCORING' : 'COMPLETED';
    const isPublished = status === 'COMPLETED';
    return {
      id: `prod-eligible-${String(num).padStart(2, '0')}`,
      codeNumber: num === 1 ? 1234567 : num,
      code: num === 1 ? 'OCOP-1234567' : `OCOP-${String(num).padStart(6, '0')}`,
      name: `Sản Phẩm Đạt Chuẩn Số ${String(num).padStart(2, '0')}`,
      description: `Mô tả công khai cho sản phẩm số ${num}.`,
      status,
      approvedAt: `2026-10-${String(num).padStart(2, '0')}T08:00:00.000Z`,
      publicationState: isPublished ? 'PUBLISHED' : 'UNPUBLISHED',
      // Verify unpublished product does not leak starRating even if present in payload
      finalScore: isPublished ? 91.5 : 88.0,
      starRating: isPublished ? 5 : 4,
      createdAt: `2026-10-${String(num).padStart(2, '0')}T18:30:00.000Z`,
      category: isDrink
        ? { id: 'cat-drink', name: 'Đồ uống' }
        : { id: 'cat-food', name: 'Thực phẩm' },
      attachments: num === 1 ? [{ id: 'att-01', fileName: 'sp1.jpg' }] : [],
    };
  });

  const ineligibleProducts = [
    {
      id: 'prod-submitted-only',
      name: 'Hồ Sơ Mới Nộp Chưa Duyệt',
      description: 'Hồ sơ SUBMITTED không được phép xuất hiện trong danh sách SSR.',
      status: 'SUBMITTED',
      approvedAt: null,
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-20T00:00:00.000Z',
      category: { id: 'cat-drink', name: 'Đồ uống' },
      attachments: [],
    },
    {
      id: 'prod-scoring-no-approval',
      name: 'Hồ Sơ Đang Chấm Thiếu Dấu Vết Duyệt',
      description: 'Hồ sơ SCORING nhưng approvedAt = null không đủ điều kiện SEO.',
      status: 'SCORING',
      approvedAt: null,
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-21T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
    {
      id: 'prod-completed-no-approval',
      name: 'Hồ Sơ Hoàn Tất Thiếu Dấu Vết Duyệt',
      description: 'Hồ sơ COMPLETED nhưng approvedAt = null không đủ điều kiện SEO.',
      status: 'COMPLETED',
      approvedAt: null,
      publicationState: 'PUBLISHED',
      finalScore: 95,
      starRating: 5,
      createdAt: '2026-10-22T00:00:00.000Z',
      category: { id: 'cat-drink', name: 'Đồ uống' },
      attachments: [],
    },
    {
      id: 'prod-returned',
      name: 'Hồ Sơ Bị Trả Lại',
      description: 'Hồ sơ RETURNED không được lập chỉ mục.',
      status: 'RETURNED',
      approvedAt: '2026-10-01T00:00:00.000Z',
      publicationState: 'UNPUBLISHED',
      finalScore: null,
      starRating: null,
      createdAt: '2026-10-23T00:00:00.000Z',
      category: { id: 'cat-food', name: 'Thực phẩm' },
      attachments: [],
    },
  ];

  const allDataset = [...eligibleProducts, ...ineligibleProducts];
  const seenProductRequests = [];
  const originalAdapter = baseRequest.defaults.adapter;

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
        seenProductRequests.push(params);
        const page = Number(params.page ?? 1);
        const limit = Number(params.limit ?? 10);
        const categoryId = params.categoryId;
        const q = params.q ? String(params.q).toLowerCase() : '';

        // Simulate backend filtering by categoryId / q, plus accidentally returning an ineligible record
        // so we verify both backend param `approvedOnly: true` AND frontend defense-in-depth filtering!
        let matchingEligible = eligibleProducts.filter((item) => {
          if (categoryId && item.category.id !== categoryId) return false;
          if (
            q &&
            !item.name.toLowerCase().includes(q) &&
            !item.id.toLowerCase().includes(q) &&
            !(item.code && item.code.toLowerCase().includes(q)) &&
            !item.category.name.toLowerCase().includes(q)
          ) {
            return false;
          }
          return true;
        });

        const total = matchingEligible.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const pageSlice = matchingEligible.slice(start, start + limit);

        // Inject ineligible items into raw payload to ensure frontend also strips any non-eligible records
        const rawData = pageSlice.length > 0 ? [...pageSlice, ...ineligibleProducts] : [];

        return {
          status: 200,
          statusText: '200',
          data: {
            data: rawData,
            meta: {
              page,
              limit,
              total,
              totalPages,
            },
          },
          headers: {},
          config,
        };
      }
      throw new Error(`Unexpected URL: ${config.url}`);
    };

    // 1. Page 1 SSR (`/products`): SEO metadata, canonical, eligible products, and sequential pagination links
    const page1Res = await renderAppRequest(new Request('https://ocop.vn/products'));
    assert.equal(page1Res.status, 200);
    assert.equal(page1Res.headers.get('cache-control'), 'no-store');
    assert.equal(
      page1Res.headers.get('x-robots-tag'),
      null,
      'Unfiltered page 1 must be indexable (no X-Robots-Tag: noindex)',
    );
    const page1Html = await page1Res.text();

    assert.ok(seenProductRequests.length >= 1, 'SSR loader must request /products');
    assert.equal(seenProductRequests[0].approvedOnly, true, 'Catalog query must pass approvedOnly: true');
    assert.equal(seenProductRequests[0].page, 1);
    assert.equal(seenProductRequests[0].limit, 10);

    // Title, description, and canonical on page 1
    assert.match(page1Html, /<title>[^<]*Tra cứu sản phẩm OCOP[^<]*<\/title>/);
    assert.match(page1Html, /<meta[^>]+name="description"[^>]+content="[^"]+OCOP[^"]*"/i);
    assert.match(
      page1Html,
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products"/i,
      'Page 1 canonical must be https://ocop.vn/products without ?page=1',
    );
    assert.doesNotMatch(
      page1Html,
      /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i,
      'Unfiltered page 1 must not emit noindex meta',
    );

    // Requesting `/products?page=1` must also have consistent canonical `https://ocop.vn/products`
    const explicitPage1Res = await renderAppRequest(new Request('https://ocop.vn/products?page=1'));
    const explicitPage1Html = await explicitPage1Res.text();
    assert.match(
      explicitPage1Html,
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products"/i,
      'Requesting /products?page=1 must still canonicalize to https://ocop.vn/products',
    );

    // Verify deterministic date formatting in Asia/Ho_Chi_Minh timezone:
    // '2026-10-01T18:30:00.000Z' is 2026-10-02 01:30:00 in Asia/Ho_Chi_Minh (+07:00) -> '2/10/2026' or '02/10/2026'
    assert.match(
      page1Html,
      /\b0?2\/10\/2026\b/,
      'Created date must be formatted deterministically in Asia/Ho_Chi_Minh timezone',
    );

    // Verify readable product codes (including >6 digits) are rendered in public catalog
    assert.ok(page1Html.includes('OCOP-1234567'), 'Page 1 must display >6 digit code OCOP-1234567');
    assert.ok(page1Html.includes('OCOP-000002'), 'Page 1 must display 6-digit padded code OCOP-000002');

    // Verify unpublished product (prod-eligible-02, SCORING + UNPUBLISHED) does NOT leak starRating
    // while published product (prod-eligible-03, COMPLETED + PUBLISHED) shows 5 sao
    assert.match(page1Html, /5(?:<!-- -->|\s)*sao/, 'Published product starRating must be rendered');
    assert.doesNotMatch(
      page1Html,
      /4(?:<!-- -->|\s)*sao/,
      'Unpublished product starRating must NOT leak in catalog HTML',
    );

    // Verify crawlable sequential pagination `<a href>` links on page 1
    assert.match(
      page1Html,
      /<a[^>]+href="\/products\?page=2"[^>]*>/,
      'Page 1 HTML must contain crawlable <a href="/products?page=2"> link',
    );

    // 2. Direct SSR request to Page 2 (`/products?page=2`)
    const page2Res = await renderAppRequest(new Request('https://ocop.vn/products?page=2'));
    assert.equal(page2Res.status, 200);
    assert.equal(page2Res.headers.get('cache-control'), 'no-store');
    assert.equal(
      page2Res.headers.get('x-robots-tag'),
      null,
      'Unfiltered page 2 must be indexable (no X-Robots-Tag: noindex)',
    );
    const page2Html = await page2Res.text();

    // Canonical of page 2 must point to page 2 itself (`https://ocop.vn/products?page=2`), NOT page 1!
    assert.match(
      page2Html,
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/ocop\.vn\/products\?page=2"/i,
      'Page 2 canonical must point to https://ocop.vn/products?page=2',
    );
    assert.match(
      page2Html,
      /<title>[^<]*Trang 2[^<]*<\/title>/,
      'Page 2 title must reflect page 2',
    );

    // Page 2 HTML must contain crawlable `<a href="/products">` link back to page 1 (without ?page=1)
    assert.match(
      page2Html,
      /<a[^>]+href="\/products"[^>]*>/,
      'Page 2 HTML must contain crawlable <a href="/products"> link back to page 1',
    );

    // 3. Multi-page completeness, no duplicates, and no ineligible leaks across Page 1 and Page 2
    const extractProductIds = (html) => [
      ...new Set(
        [...html.matchAll(/href="\/products\/(prod-[a-z0-9-]+)"/g)].map((m) => m[1]),
      ),
    ];
    const page1Ids = extractProductIds(page1Html);
    const page2Ids = extractProductIds(page2Html);

    assert.equal(page1Ids.length, 10, 'Page 1 must contain 10 eligible product detail links');
    assert.equal(page2Ids.length, 2, 'Page 2 must contain 2 eligible product detail links');

    for (let i = 1; i <= 10; i++) {
      const expectedName = `Sản Phẩm Đạt Chuẩn Số ${String(i).padStart(2, '0')}`;
      assert.ok(page1Html.includes(expectedName), `Page 1 must include ${expectedName}`);
      assert.ok(!page2Html.includes(expectedName), `Page 2 must not duplicate ${expectedName}`);
    }
    for (let i = 11; i <= 12; i++) {
      const expectedName = `Sản Phẩm Đạt Chuẩn Số ${String(i).padStart(2, '0')}`;
      assert.ok(page2Html.includes(expectedName), `Page 2 must include ${expectedName}`);
      assert.ok(!page1Html.includes(expectedName), `Page 1 must not include ${expectedName}`);
    }

    const combinedIds = [...page1Ids, ...page2Ids];
    assert.equal(new Set(combinedIds).size, 12, 'No duplicate eligible product IDs across pages');
    assert.deepEqual(
      combinedIds,
      eligibleProducts.map((p) => p.id),
      'All 12 eligible products must be present across pages in order',
    );

    // Verify NO ineligible products appear on either page
    for (const ineligible of ineligibleProducts) {
      assert.ok(!page1Html.includes(ineligible.id), `Page 1 must not leak ${ineligible.id}`);
      assert.ok(!page1Html.includes(ineligible.name), `Page 1 must not leak ${ineligible.name}`);
      assert.ok(!page2Html.includes(ineligible.id), `Page 2 must not leak ${ineligible.id}`);
      assert.ok(!page2Html.includes(ineligible.name), `Page 2 must not leak ${ineligible.name}`);
    }

    // 4. Search & filter variants (`?q=...`, `?categoryId=...`, `?limit=20`)
    // Must work in SSR, exclude ineligible products, and emit `noindex`
    const searchRes = await renderAppRequest(
      new Request('https://ocop.vn/products?q=Số%2001'),
    );
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.headers.get('x-robots-tag'), 'noindex');
    const searchHtml = await searchRes.text();
    assert.match(
      searchHtml,
      /<meta[^>]+name="robots"[^>]+content="noindex,\s*follow"/i,
      'Search variant must emit <meta name="robots" content="noindex, follow">',
    );
    assert.ok(searchHtml.includes('Sản Phẩm Đạt Chuẩn Số 01'));
    assert.ok(!searchHtml.includes('Sản Phẩm Đạt Chuẩn Số 02'));
    for (const ineligible of ineligibleProducts) {
      assert.ok(!searchHtml.includes(ineligible.id), `Search HTML must not leak ${ineligible.id}`);
      assert.ok(!searchHtml.includes(ineligible.name), `Search HTML must not leak ${ineligible.name}`);
    }

    // Search by readable product code (case-insensitive & substring) and old ID
    for (const codeQuery of ['OCOP-1234567', 'ocop-1234567', 'OCOP-000002', 'prod-eligible-01']) {
      const codeSearchRes = await renderAppRequest(
        new Request(`https://ocop.vn/products?q=${encodeURIComponent(codeQuery)}`),
      );
      assert.equal(codeSearchRes.status, 200);
      assert.equal(codeSearchRes.headers.get('x-robots-tag'), 'noindex');
      const codeSearchHtml = await codeSearchRes.text();
      assert.ok(
        codeSearchHtml.includes('OCOP-1234567') || codeSearchHtml.includes('OCOP-000002'),
        `Catalog search by "${codeQuery}" must render matching product and its code`,
      );
    }

    const categoryFilterRes = await renderAppRequest(
      new Request('https://ocop.vn/products?categoryId=cat-drink'),
    );
    assert.equal(categoryFilterRes.status, 200);
    assert.equal(categoryFilterRes.headers.get('x-robots-tag'), 'noindex');
    const categoryFilterHtml = await categoryFilterRes.text();
    assert.match(
      categoryFilterHtml,
      /<meta[^>]+name="robots"[^>]+content="noindex,\s*follow"/i,
      'Category filter variant must emit <meta name="robots" content="noindex, follow">',
    );
    assert.ok(categoryFilterHtml.includes('Sản Phẩm Đạt Chuẩn Số 01'));
    assert.ok(!categoryFilterHtml.includes('Sản Phẩm Đạt Chuẩn Số 02'));
    for (const ineligible of ineligibleProducts) {
      assert.ok(
        !categoryFilterHtml.includes(ineligible.id),
        `Category filter HTML must not leak ${ineligible.id}`,
      );
    }

    const customLimitRes = await renderAppRequest(
      new Request('https://ocop.vn/products?limit=20'),
    );
    assert.equal(customLimitRes.status, 200);
    assert.equal(customLimitRes.headers.get('x-robots-tag'), 'noindex');

    // 5. Empty search result & empty catalog states
    const emptyFilterRes = await renderAppRequest(
      new Request('https://ocop.vn/products?q=khong-ton-tai-xyz'),
    );
    assert.equal(emptyFilterRes.status, 200);
    const emptyFilterHtml = await emptyFilterRes.text();
    assert.ok(
      emptyFilterHtml.includes('Không tìm thấy sản phẩm phù hợp'),
      'Empty filtered result must render filtered empty state message',
    );

    // Empty unfiltered catalog
    baseRequest.defaults.adapter = async (config) => {
      if (config.url === '/categories') {
        return { status: 200, statusText: '200', data: { data: categoriesFixture }, headers: {}, config };
      }
      return {
        status: 200,
        statusText: '200',
        data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } },
        headers: {},
        config,
      };
    };
    const emptyCatalogRes = await renderAppRequest(new Request('https://ocop.vn/products'));
    assert.equal(emptyCatalogRes.status, 200);
    const emptyCatalogHtml = await emptyCatalogRes.text();
    assert.ok(
      emptyCatalogHtml.includes('Chưa có hồ sơ công khai'),
      'Empty unfiltered catalog must render default empty state message',
    );

    // 6. Categories API failure degrades gracefully while products still render
    const { AxiosError } = await import('axios');
    baseRequest.defaults.adapter = async (config) => {
      if (config.url === '/categories') {
        const response = {
          status: 503,
          statusText: '503',
          data: { message: 'Categories service unavailable' },
          headers: {},
          config,
        };
        throw new AxiosError('Service Unavailable', undefined, config, null, response);
      }
      return {
        status: 200,
        statusText: '200',
        data: {
          data: [eligibleProducts[0]],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        },
        headers: {},
        config,
      };
    };
    const categoryFailRes = await renderAppRequest(new Request('https://ocop.vn/products'));
    assert.equal(categoryFailRes.status, 200);
    const categoryFailHtml = await categoryFailRes.text();
    assert.ok(categoryFailHtml.includes('Sản Phẩm Đạt Chuẩn Số 01'));

    // 7. Products API failure during SSR MUST return 5xx status, NOT a 200 empty catalog
    baseRequest.defaults.adapter = async (config) => {
      if (config.url === '/categories') {
        return { status: 200, statusText: '200', data: { data: categoriesFixture }, headers: {}, config };
      }
      const response = {
        status: 503,
        statusText: '503',
        data: { message: 'Database unavailable' },
        headers: {},
        config,
      };
      throw new AxiosError('Service Unavailable', undefined, config, null, response);
    };

    const errorRes = await renderAppRequest(new Request('https://ocop.vn/products'));
    assert.ok(
      errorRes.status >= 500,
      `Expected 5xx status when /products API fails during SSR, got ${errorRes.status}`,
    );
    const errorHtml = await errorRes.text();
    assert.ok(
      !errorHtml.includes('Chưa có hồ sơ công khai'),
      'Backend API failure must NOT render as a successful empty catalog',
    );

    // 8. Node HTTP SSR server (createWebSsrServer) serves /products and /products?page=2 over real HTTP
    const { createWebSsrServer } = await server.ssrLoadModule('/src/server.ts');
    baseRequest.defaults.adapter = async (config) => {
      if (config.url === '/categories') {
        return { status: 200, statusText: '200', data: { data: categoriesFixture }, headers: {}, config };
      }
      const page = Number(config.params?.page ?? 1);
      const limit = Number(config.params?.limit ?? 10);
      const start = (page - 1) * limit;
      return {
        status: 200,
        statusText: '200',
        data: {
          data: eligibleProducts.slice(start, start + limit),
          meta: { page, limit, total: eligibleProducts.length, totalPages: 2 },
        },
        headers: {},
        config,
      };
    };

    const httpServer = createWebSsrServer({ publicOrigin: 'https://ocop.vn' });
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    try {
      const addr = httpServer.address();
      const httpPage1 = await fetch(`http://127.0.0.1:${addr.port}/products`);
      assert.equal(httpPage1.status, 200);
      assert.equal(httpPage1.headers.get('cache-control'), 'no-store');
      assert.equal(httpPage1.headers.get('x-robots-tag'), null);
      const httpPage1Text = await httpPage1.text();
      assert.ok(httpPage1Text.includes('Sản Phẩm Đạt Chuẩn Số 01'));
      assert.ok(httpPage1Text.includes('href="https://ocop.vn/products"'));
      assert.ok(httpPage1Text.includes('href="/products?page=2"'));

      const httpPage2 = await fetch(`http://127.0.0.1:${addr.port}/products?page=2`);
      assert.equal(httpPage2.status, 200);
      const httpPage2Text = await httpPage2.text();
      assert.ok(httpPage2Text.includes('Sản Phẩm Đạt Chuẩn Số 11'));
      assert.ok(httpPage2Text.includes('href="https://ocop.vn/products?page=2"'));
      assert.ok(httpPage2Text.includes('href="/products"'));
    } finally {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    console.log('PASS catalog-ssr: eligibility, multi-page URLs, sequential links, canonicals, noindex filters, error status');

    // 9. Verify print sheets render consistent product code (>6 digits and 6 digits) and label historical snapshot code as current code
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const {
      EvaluationPrintSheet,
      ProductResultsPrintSheet,
      RegistrationPrintSheet,
    } = await server.ssrLoadModule('/src/components/print/OcopPrintSheets.tsx');

    const evalHtmlHistorical = renderToStaticMarkup(
      createElement(EvaluationPrintSheet, {
        data: {
          kind: 'EVALUATION',
          generatedAt: '2026-10-24T08:00:00.000Z',
          evaluationId: 'eval-1',
          status: 'SUBMITTED',
          isDraft: false,
          provenance: 'SNAPSHOT_V2',
          historicalValuesVerified: true,
          submittedAt: '2026-10-20T09:00:00.000Z',
          product: {
            id: 'prod-old-1',
            codeNumber: 1234567,
            code: 'OCOP-1234567',
            codeFromCurrentProduct: true,
            name: 'Trà Shan Tuyết lịch sử',
            categoryName: 'Chè',
            entityName: 'HTX Trà',
          },
          judge: {
            id: 'judge-1',
            fullName: 'Nguyễn Văn Giám Khảo',
            organizationUnitName: 'Sở Nông nghiệp',
          },
          criteriaSet: {
            id: 'set-1',
            name: 'Bộ tiêu chí Chè',
            source: 'QĐ 26/2026/QĐ-TTg',
            version: '1',
            sourceHash: 'abc',
          },
          isPartialScope: false,
          total: 90,
          scopeMaxScore: 100,
          criteria: [],
        },
      }),
    );
    assert.ok(
      evalHtmlHistorical.includes('Mã hồ sơ hiện tại:') &&
        evalHtmlHistorical.includes('OCOP-1234567'),
      'EvaluationPrintSheet must display "Mã hồ sơ hiện tại: OCOP-1234567" for historical snapshot',
    );

    const regHtmlHistorical = renderToStaticMarkup(
      createElement(RegistrationPrintSheet, {
        attachmentMode: 'owner',
        data: {
          kind: 'REGISTRATION',
          generatedAt: '2026-10-24T08:00:00.000Z',
          isDraft: false,
          hasSubmissionSnapshot: true,
          product: {
            id: 'prod-old-1',
            codeNumber: 1234567,
            code: 'OCOP-1234567',
            codeFromCurrentProduct: true,
            name: 'Trà Shan Tuyết lịch sử',
            description: null,
            status: 'SUBMITTED',
            submittedAt: '2026-10-20T09:00:00.000Z',
            createdAt: '2026-10-19T09:00:00.000Z',
          },
          registrant: {
            id: 'reg-1',
            fullName: 'Chủ thể Trà',
            email: 'tra@ocop.vn',
            phone: '0900000001',
          },
          category: { id: 'cat-1', name: 'Chè' },
          locality: {
            id: 'loc-1',
            code: 'XP1',
            name: 'Xã Suối Giàng',
            provinceName: 'Tỉnh Yên Bái',
          },
          formData: {
            entityName: 'HTX Trà',
            representativeName: 'Chủ thể Trà',
            representativeTitle: 'Giám đốc',
            contactAddress: 'Suối Giàng',
            provinceName: 'Tỉnh Yên Bái',
            registrationType: 'FIRST',
            sampleQuantity: 2,
            assessmentYear: 2026,
            declarationAccepted: true,
          },
          attachments: [],
        },
      }),
    );
    assert.ok(
      regHtmlHistorical.includes('OCOP-1234567') &&
        regHtmlHistorical.includes('(Mã hồ sơ hiện tại)'),
      'RegistrationPrintSheet must display "OCOP-1234567 (Mã hồ sơ hiện tại)" for historical snapshot',
    );

    const resultsHtmlNormal = renderToStaticMarkup(
      createElement(ProductResultsPrintSheet, {
        data: {
          kind: 'PRODUCT_RESULTS',
          generatedAt: '2026-10-24T08:00:00.000Z',
          product: {
            id: 'prod-2',
            codeNumber: 42,
            code: 'OCOP-000042',
            name: 'Mật ong hoa nhãn',
            status: 'COMPLETED',
            submittedAt: '2026-10-20T09:00:00.000Z',
            completedAt: '2026-10-22T09:00:00.000Z',
            entityName: 'HTX Mật ong',
            localityName: 'Xã A',
            provinceName: 'Tỉnh B',
            categoryName: 'Mật ong',
            finalScore: 85,
            starRating: 4,
            starLabel: 'Mức điểm 4 sao',
          },
          criteriaSet: null,
          evaluations: [],
          criteriaSummary: [],
        },
      }),
    );
    assert.ok(
      resultsHtmlNormal.includes('Mã hồ sơ:') &&
        !resultsHtmlNormal.includes('Mã hồ sơ hiện tại:') &&
        resultsHtmlNormal.includes('OCOP-000042'),
      'ProductResultsPrintSheet must display "Mã hồ sơ: OCOP-000042" when code is in snapshot or live',
    );
  } finally {
    baseRequest.defaults.adapter = originalAdapter;
  }
} finally {
  await server.close();
}
