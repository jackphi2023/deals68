import { test, expect } from '@playwright/test';
import {
  collectConsoleErrors,
  expectNoBadPlaceholders,
  expectNoCriticalConsoleErrors,
  expectNoHorizontalOverflow,
  gotoAndWait,
  annotate,
} from '../helpers/deals68';

test.describe('TC-PRICING — Pricing and registration payment summary', () => {
  test('TC-PRICING-001 Pricing page shows Business/Investor country pricing concepts', async ({ page }, testInfo) => {
    annotate(testInfo, 'spec', 'Pricing must reflect VN/VND and non-VN/USD service package logic.');
    const errors = await collectConsoleErrors(page);
    await gotoAndWait(page, '/pricing');
    await expect(page.locator('body')).toContainText(/Doanh nghiệp|Business/i);
    await expect(page.locator('body')).toContainText(/Nhà đầu tư|Investor/i);
    await expect(page.locator('body')).toContainText(/VNĐ|VND|USD|\$/i);
    await expectNoBadPlaceholders(page);
    await expectNoCriticalConsoleErrors(errors);
  });

  test('TC-PRICING-002 Business register payment UI has term, promo, QR and total', async ({ page }, testInfo) => {
    annotate(testInfo, 'spec', 'Business register must show package, term weeks, promo/referral, QR transfer and total due.');
    await gotoAndWait(page, '/register/business');
    const body = page.locator('body');
    await expect(body).toContainText(/Gói dịch vụ|Service package/i);
    await expect(body).toContainText(/Kỳ hạn|Term/i);
    await expect(body).toContainText(/Mã khuyến mãi|Promo/i);
    await expect(body).toContainText(/Tổng thanh toán|Total due/i);
    await expect(body).toContainText(/Chuyển khoản QR|QR bank transfer/i);
    await expect(body).toContainText(/0011004000713/);
    await expectNoHorizontalOverflow(page);
  });

  test('TC-PRICING-003 Standard Investor is free and Premium uses the updated monthly price', async ({ page }, testInfo) => {
    annotate(
      testInfo,
      'spec',
      'Investor pricing must default to free Standard, disclose the paid analysis report, and pass Premium selection to registration.',
    );
    await gotoAndWait(page, '/pricing');

    const panel = page.locator('.d68-pricing-panel');
    const result = page.locator('.d68-pricing-result');
    await panel.getByRole('button', { name: /^Nhà đầu tư$|^Investor$/i }).click();

    const standard = panel.getByRole('button', { name: /Tiêu chuẩn.*Miễn phí|Standard.*Free/i });
    const premium = panel.getByRole('button', { name: /^Nâng cao$|^Premium$/i });
    await expect(standard).toHaveClass(/active/);
    await expect(result).toContainText(/Miễn phí|Free/i);
    await expect(panel).not.toContainText(/Kỳ hạn|Term/i);
    await expect(page.locator('.d68-pricing-plans')).toContainText(
      /Xem Báo cáo Phân tích đầu tư: 50 triệu đ\/tháng\.|View Investment Analysis Reports: USD 2,500\/month\./i,
    );

    await premium.click();
    await expect(premium).toHaveClass(/active/);
    await expect(panel).toContainText(/Kỳ hạn|Term/i);
    for (const term of ['4', '8', '12', '16', '24']) {
      await expect(panel).toContainText(term);
    }
    await expect(result).toContainText(/50\.000\.000 ₫|\$50,000,000|\$2,500/i);

    await result.getByRole('button', { name: /Đăng ký tài khoản|Register account/i }).click();
    await expect(page).toHaveURL(/register\/investor/);
    await expect(
      page.getByRole('button', { name: /Nhà đầu tư Nâng cao|Premium Investor/i }),
    ).toHaveClass(/active/);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('TC-VALUATION — Valuation scope and benchmark output', () => {
  test('TC-VALUATION-001 Free valuation page uses only 6 user inputs', async ({ page }, testInfo) => {
    annotate(testInfo, 'spec', 'Valuation page must ask only country, industry, latest annual revenue, currency, EBITDA margin and revenue growth.');
    const errors = await collectConsoleErrors(page);
    await gotoAndWait(page, '/valuation');
    const text = await page.locator('body').innerText();
    for (const required of ['Quốc gia', 'Ngành', 'Doanh thu năm', 'Đơn vị', 'EBITDA', 'Tăng trưởng']) {
      expect(text, `Missing valuation input/label: ${required}`).toContain(required);
    }
    await expect(page.getByLabel(/Đơn vị|Currency/i)).toHaveValue('VND');
    expect(text).not.toMatch(/Nợ ròng|net debt/i);
    expect(text).not.toMatch(/Tỷ lệ cổ phần chào|offer stake/i);
    expect(text).not.toMatch(/Số tiền chào|offer amount/i);
    await expect(page.locator('body')).toContainText(/Định giá tham chiếu|Valuation benchmark/i);
    await expectNoBadPlaceholders(page);
    await expectNoHorizontalOverflow(page);
    await expectNoCriticalConsoleErrors(errors);
  });

  test('TC-VALUATION-002 Valuation updates after changing revenue/margin/growth', async ({ page }) => {
    await gotoAndWait(page, '/valuation');
    await page.getByLabel(/^Quốc gia$|^Country$/i).selectOption({ index: 1 });
    await page.getByLabel(/Ngành hàng|Industry \/ sector/i).selectOption({ index: 1 });
    await page.getByLabel(/Doanh thu năm|Latest annual revenue/i).fill('10.000.000.000');
    await page.getByLabel(/EBITDA/i).fill('15');
    await page.getByLabel(/Tăng trưởng|Revenue growth/i).fill('20');
    const resultHeading = page.locator('.d68-val-result h2');
    await expect(resultHeading).not.toHaveText('—');
    const vndResult = await resultHeading.innerText();
    await page.getByLabel(/Đơn vị|Currency/i).selectOption('USD');
    await expect(page.getByLabel(/Đơn vị|Currency/i)).toHaveValue('USD');
    await expect(resultHeading).not.toHaveText(vndResult);
    await expect(page.locator('body')).toContainText(/Thấp|Low/i);
    await expect(page.locator('body')).toContainText(/Trung bình|Midpoint/i);
    await expect(page.locator('body')).toContainText(/Cao|High/i);
  });

  test('TC-VALUATION-003 Business register valuation preview shows self valuation and benchmark', async ({ page }) => {
    await gotoAndWait(page, '/register/business');
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Định giá quy đổi|implied valuation/i);
    expect(text).toMatch(/Định giá tham chiếu|benchmark valuation/i);
    expect(text).not.toMatch(/Nợ ròng|net debt/i);
  });
});
