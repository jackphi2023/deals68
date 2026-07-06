import { test, expect } from '@playwright/test';
import { publicRoutes, privateRoutes, collectConsoleErrors, expectInternalLinksHealthy, expectNoBadPlaceholders, expectNoCriticalConsoleErrors, expectNoHorizontalOverflow, expectPageHasMeaningfulContent, gotoAndWait, annotate } from '../helpers/deals68';

test.describe('TC-SMOKE — public routes, links, wording, mobile overflow', () => {
  for (const route of publicRoutes) {
    test(`TC-SMOKE-PUBLIC ${route}`, async ({ page }, testInfo) => {
      annotate(testInfo, 'spec', 'Public route must load, not crash, not leak placeholders, and not overflow horizontally.');
      const errors = await collectConsoleErrors(page);
      const started = Date.now();
      const response = await gotoAndWait(page, route);
      const duration = Date.now() - started;
      expect(response?.status(), `HTTP status for ${route}`).toBeLessThan(500);
      expect(duration, `Route ${route} should not be extremely slow`).toBeLessThan(Number(process.env.D68_MAX_ROUTE_MS || 8000));
      await expectPageHasMeaningfulContent(page);
      await expectNoBadPlaceholders(page);
      await expectNoHorizontalOverflow(page);
      await expectNoCriticalConsoleErrors(errors);
      await expectInternalLinksHealthy(page, 25);
    });
  }
  for (const route of privateRoutes) {
    test(`TC-SMOKE-PRIVATE-GUARD ${route}`, async ({ page }, testInfo) => {
      annotate(testInfo, 'spec', 'Private route must redirect/guard unauthenticated users without a blank page.');
      const errors = await collectConsoleErrors(page);
      await gotoAndWait(page, route);
      await expect(page.locator('body')).toContainText(/Đăng nhập|Login|Access|Dashboard|Admin|mật khẩu|password/i);
      await expectNoBadPlaceholders(page);
      await expectNoHorizontalOverflow(page);
      await expectNoCriticalConsoleErrors(errors);
    });
  }
});

test.describe('TC-LANG — language separation', () => {
  test('TC-LANG-001 Vietnamese home should not show English-only navigation labels', async ({ page }) => { await gotoAndWait(page, '/'); const text = await page.locator('body').innerText(); expect(text).toContain('Doanh nghiệp'); expect(text).toContain('Nhà đầu tư'); });
  test('TC-LANG-002 English home should show English navigation labels', async ({ page }) => { await gotoAndWait(page, '/en'); const text = await page.locator('body').innerText(); expect(text).toMatch(/Businesses|Investors|Valuation|Pricing/); });
});
