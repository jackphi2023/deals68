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

test.describe('TC-HOME-MOBILE-HERO — canonical banner and statistics', () => {
  test('TC-HOME-HERO-001 loading state must not show the legacy Deals68 placeholder text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    let releaseBannerRequest: (() => void) | undefined;
    const bannerGate = new Promise<void>((resolve) => {
      releaseBannerRequest = resolve;
    });

    await page.route('**/rest/v1/site_banners*', async (route) => {
      await bannerGate;
      await route.abort();
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.d68-home-hero-slider-v2--loading')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Upload active Hero banners in Admin');
    await expect(page.locator('body')).not.toContainText('Deals68 hero placeholder');
    releaseBannerRequest?.();
  });

  for (const width of [375, 390, 430]) {
    test(`TC-HOME-HERO-002-${width} mobile banner and large deal value stay inside one row`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWait(page, '/');

      const slider = page.locator('.d68-home-hero-slider-v2--ready');
      await expect(slider).toHaveAttribute('data-hero-layout', 'single-active');
      await expect(slider.locator('.d68-hero-slide')).toHaveCount(1);

      const image = slider.locator('.d68-home-hero-media__image');
      await expect(image).toBeVisible();
      await expect.poll(async () => image.evaluate((node: HTMLImageElement) => ({
        complete: node.complete,
        width: node.naturalWidth,
        height: node.naturalHeight,
      }))).toMatchObject({ complete: true });
      await expect(slider.locator('.d68-home-hero-media')).toHaveAttribute('data-hero-variant', 'mobile');

      const dealValue = page.locator('.d68-home-hero-stats > div:nth-child(3) b');
      await dealValue.evaluate((node) => {
        node.textContent = '300.000 tỷ ₫';
      });

      const layout = await dealValue.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          text: node.textContent,
          whiteSpace: style.whiteSpace,
          clientWidth: (node as HTMLElement).clientWidth,
          scrollWidth: (node as HTMLElement).scrollWidth,
          height: rect.height,
          lineHeight: Number.parseFloat(style.lineHeight),
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });

      expect(layout.text).toBe('300.000 tỷ ₫');
      expect(layout.whiteSpace).toBe('nowrap');
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.height).toBeLessThanOrEqual(layout.lineHeight * 1.25);
      expect(layout.pageOverflow).toBeLessThanOrEqual(1);
    });
  }
});
