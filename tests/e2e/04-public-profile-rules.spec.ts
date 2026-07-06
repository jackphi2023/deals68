import { test, expect } from '@playwright/test';
import { collectConsoleErrors, expectNoBadPlaceholders, expectNoCriticalConsoleErrors, expectNoHorizontalOverflow, gotoAndWait } from '../helpers/deals68';

async function firstInternalLinkMatching(page: any, pattern: RegExp) {
  const hrefs = await page.locator('a[href]').evaluateAll((nodes: Element[]) => nodes.map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''));
  return hrefs.find((href: string) => pattern.test(href) && !href.includes('?')) || null;
}

test.describe('TC-PUBLIC-RULES — public profile permission rules', () => {
  test('TC-BIZ-PUBLIC-001 Guest sees public business teaser, locked contacts/docs, quality score summary', async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    await gotoAndWait(page, '/businesses');
    const link = await firstInternalLinkMatching(page, /^\/businesses\/[^/]+/);
    test.skip(!link, 'No public business profile available in current dataset.');
    await gotoAndWait(page, link!);
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Business Quality Score|Điểm/i);
    expect(text).toMatch(/Chỉ nhà đầu tư đã đăng nhập|Only logged-in investors|Đăng nhập nhà đầu tư/i);
    expect(text).toMatch(/🔒|Mở sau kết nối|Unlock after connection|Yêu cầu tài liệu/i);
    expect(text).not.toMatch(/Public page chỉ dùng dữ liệu/i);
    await expectNoBadPlaceholders(page);
    await expectNoHorizontalOverflow(page);
    await expectNoCriticalConsoleErrors(errors);
  });
  test('TC-INV-PUBLIC-001 Guest sees anonymous investor profile and locked contact information', async ({ page }) => {
    const errors = await collectConsoleErrors(page);
    await gotoAndWait(page, '/investors');
    const link = await firstInternalLinkMatching(page, /^\/investors\/[^/]+/);
    test.skip(!link, 'No public investor profile available in current dataset.');
    await gotoAndWait(page, link!);
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Thông tin Nhà đầu tư|Investor information/i);
    expect(text).toMatch(/Tiêu chí đầu tư|Investment criteria/i);
    expect(text).toMatch(/Thông tin liên hệ|Contact information/i);
    expect(text).toMatch(/Chỉ Doanh nghiệp đã kết nối|Only businesses connected/i);
    expect(text).toMatch(/🔒/);
    await expectNoBadPlaceholders(page);
    await expectNoHorizontalOverflow(page);
    await expectNoCriticalConsoleErrors(errors);
  });
});
