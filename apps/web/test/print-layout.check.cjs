// Run with the web dev server running and Playwright available on NODE_PATH:
// node apps/web/test/print-layout.check.cjs
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');
const { chromium } = require('playwright');

const timestamp = '2026-10-26T09:00:00+07:00';
const product = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Sản phẩm kiểm thử bản in OCOP',
  description: 'Dữ liệu minh họa dành riêng cho kiểm tra bố cục, không phải hồ sơ thực tế.',
  status: 'COMPLETED', submittedAt: timestamp, completedAt: timestamp, createdAt: timestamp,
  entityName: 'Hợp tác xã kiểm thử', categoryName: 'Sản phẩm chế biến', groupName: 'Thực phẩm',
  localityName: 'Xã kiểm thử', provinceName: 'Tỉnh kiểm thử', finalScore: 89.99,
  starRating: 4, starLabel: 'Mức điểm 4 sao',
};
const registration = {
  kind: 'REGISTRATION', generatedAt: timestamp, isDraft: false, hasSubmissionSnapshot: true, product,
  registrant: { id: 'owner', fullName: 'Nguyễn Văn Kiểm Thử', email: 'test@example.com', phone: '0900000000' },
  category: { id: 'category', name: product.categoryName, groupName: product.groupName, classificationGroup: '1', classificationSubgroup: null },
  locality: { id: 'locality', code: 'TEST', name: product.localityName, provinceName: product.provinceName, type: 'COMMUNE' },
  formData: {
    entityName: product.entityName, representativeName: 'Nguyễn Văn Kiểm Thử', representativeTitle: 'Giám đốc',
    contactAddress: 'Địa chỉ kiểm thử bố cục phiếu đăng ký', provinceName: product.provinceName,
    registrationType: 'FIRST', assessmentYear: 2026, sampleQuantity: 3, declarationAccepted: true,
  },
  attachments: [
    { id: 'image-1', type: 'IMAGE', fileName: 'anh-san-pham-ten-rat-dai-can-an-khi-in.png', createdAt: timestamp },
    { id: 'image-2', type: 'IMAGE', fileName: 'anh-nhan-hieu-can-an-khi-in.png', createdAt: timestamp },
    { id: 'document', type: 'DOCUMENT', fileName: 'Minh chứng chất lượng.pdf', createdAt: timestamp },
  ],
};
const results = {
  kind: 'PRODUCT_RESULTS', generatedAt: timestamp, product,
  criteriaSet: { id: 'criteria', name: 'Bộ tiêu chí kiểm thử', source: 'QĐ 26/2026/QĐ-TTg', version: '1' },
  evaluations: Array.from({ length: 3 }, (_, index) => ({
    id: `evaluation-${index}`, judgeName: `Thành viên kiểm thử ${index + 1}`, organizationUnitName: 'Đơn vị kiểm thử',
    isPartialScope: false, scopeMaxScore: 100, status: 'SUBMITTED', submittedAt: timestamp, total: 89.99,
  })),
  criteriaSummary: Array.from({ length: 8 }, (_, index) => ({
    criterionId: `criterion-${index}`, code: `A.${index + 1}`, name: `Nội dung tiêu chí kiểm thử ${index + 1}`,
    maxScore: 10, averageScore: 8.5,
  })),
};

async function main() {
  const output = process.env.PRINT_CHECK_OUTPUT || join(require('node:os').tmpdir(), 'ocop-print-layout');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.PRINT_CHECK_BROWSER || 'msedge' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    await context.addInitScript(() => localStorage.setItem('ocop-session', JSON.stringify({
      accessToken: 'local-print-fixture', user: { id: 'test', role: 'ADMIN', fullName: 'Kiểm thử bản in', verified: true },
    })));
    await context.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/registration-print-data')) return route.fulfill({ json: { data: registration } });
      if (path.endsWith('/results/print-data')) return route.fulfill({ json: { data: results } });
      if (path.includes('/attachments/')) return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#eee"/><text x="200" y="125" text-anchor="middle" font-family="sans-serif" font-size="20">Ảnh mẫu kiểm thử</text></svg>',
      });
      return route.fulfill({ json: { data: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => console.error(error.message));
    page.on('requestfailed', request => console.error(request.url(), request.failure()?.errorText));
    const base = process.env.PRINT_CHECK_URL || 'http://127.0.0.1:5173';
    for (const kind of ['registration', 'results']) {
      console.log(`Checking ${kind}`);
      await page.goto(`${base}/print/products/${product.id}/${kind}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.ocop-print-sheet').waitFor();
      console.log(`Rendered ${kind}; waiting for fonts`);
      await page.evaluate(() => document.fonts.ready);
      if (kind === 'registration') {
        await page.locator('.print-image-card img').first().waitFor();
        await page.locator('.print-image-grid').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll('.print-image-card img')].every(img => img.complete && img.naturalWidth));
        const sheet = await page.locator('.ocop-print-sheet').innerText();
        assert.ok(!sheet.includes('can-an-khi-in'), 'image filenames must not appear in printable content');
        assert.ok(sheet.includes('Minh chứng chất lượng.pdf'), 'evidence document names must remain');
        assert.equal(await page.locator('.print-image-card img[alt*=".png"]').count(), 0);
        await page.getByRole('checkbox').first().uncheck();
        assert.equal(await page.locator('.print-image-card').count(), 1);
        await page.getByRole('checkbox').first().check();
        await page.locator('.print-image-card img').first().waitFor();
      }
      for (const width of [320, 375, 414, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        const layout = await page.evaluate(() => {
          const toolbar = document.querySelector('.print-toolbar').getBoundingClientRect();
          const title = document.querySelector('.print-toolbar-title').getBoundingClientRect();
          return { overflow: document.documentElement.scrollWidth > innerWidth, offset: Math.abs(title.x + title.width / 2 - toolbar.x - toolbar.width / 2) };
        });
        if (layout.overflow) {
          console.error(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width }))));
          await page.screenshot({ path: join(output, `${kind}-overflow.png`), fullPage: true });
        }
        assert.equal(layout.overflow, false, `${kind} overflows at ${width}px`);
        assert.ok(layout.offset < 2, `${kind} title is not centered at ${width}px`);
        if (width === 375 || width === 1440) await page.screenshot({ path: join(output, `${kind}-${width}.png`), fullPage: true });
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.print-toolbar').isVisible(), false);
      assert.equal(await page.locator('.print-table-scroll-hint').isVisible(), false);
      const pdf = await page.pdf({ path: join(output, `${kind}.pdf`), preferCSSPageSize: true, printBackground: true });
      assert.equal(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length, 1, `${kind} fixture should fit on one A4 page`);
      await page.emulateMedia({ media: 'screen' });
    }
    results.criteriaSummary = Array.from({ length: 40 }, (_, index) => ({
      criterionId: `long-${index}`, code: `A.${index + 1}`,
      name: `Tiêu chí kiểm thử ngắt trang ${index + 1}: nội dung dài để kiểm tra bảng nhiều trang và hàng tiêu đề lặp lại.`,
      maxScore: 10, averageScore: 8.5,
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('A.40', { exact: true }).waitFor();
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: join(output, 'results-long.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    registration.attachments = [];
    await page.goto(`${base}/print/products/${product.id}/registration`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Chưa có tệp minh chứng đính kèm.', { exact: true }).waitFor();
    assert.equal(await page.locator('.registration-image-picker, .print-image-card').count(), 0);
    console.log(`Print layout checks passed. Screenshots and PDFs: ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
