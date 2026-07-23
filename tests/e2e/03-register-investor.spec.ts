import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, gotoAndWait, maybeSkipAuth } from '../helpers/deals68';

test.describe('TC-INV-REGISTER — Investor account creation and validation', () => {
  test('TC-INV-REG-001 Required field validation shows clear error', async ({ page }) => {
    await gotoAndWait(page, '/register/investor');
    await page.getByRole('button', { name: /Tạo tài khoản Nhà đầu tư|Create investor account/i }).click();
    await expect(page.locator('body')).toContainText(/chưa điền|Missing|Vui lòng kiểm tra/i);
    await expectNoHorizontalOverflow(page);
  });
  test('TC-INV-REG-002 Standard is default and Premium reveals payment UI', async ({ page }) => {
    await gotoAndWait(page, '/register/investor');
    const standard = page.getByRole('button', { name: /Nhà đầu tư Tiêu chuẩn|Standard Investor/i });
    const premium = page.getByRole('button', { name: /Nhà đầu tư Nâng cao|Premium Investor/i });

    await expect(standard).toHaveClass(/active/);
    await expect(page.locator('body')).toContainText(/Miễn phí|Free/i);
    await expect(page.locator('body')).not.toContainText(/Chuyển khoản QR|QR bank transfer/i);

    await premium.click();
    await expect(premium).toHaveClass(/active/);
    await expect(page.locator('body')).toContainText(/Báo cáo Phân tích cơ hội đầu tư|Investment Opportunity Analysis Report/i);
    await expect(page.locator('body')).toContainText(/Kỳ hạn|Term/i);
    await expect(page.locator('body')).toContainText(/Tổng thanh toán|Total due/i);
    await expect(page.locator('body')).toContainText(/Chuyển khoản QR|QR bank transfer/i);
  });
  test('TC-INV-REG-003 Happy path signup is gated by env and redirects to OTP login', async ({ page }, testInfo) => {
    if (maybeSkipAuth(testInfo)) test.skip();
    const email = process.env.D68_E2E_INVESTOR_EMAIL || `inv-${Date.now()}@example.com`;
    const password = process.env.D68_E2E_PASSWORD || 'Deals68Test@12345';
    await gotoAndWait(page, '/register/investor');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Mật khẩu|Password/i).fill(password);
    await page.getByLabel(/Tên người phụ trách|Contact name/i).fill('Deals68 QA Investor');
    await page.getByLabel(/Giới thiệu chung|General introduction/i).fill('Nhà đầu tư test quan tâm doanh nghiệp tăng trưởng tại Việt Nam.');
    await page.getByLabel(/Khoản đầu tư|Ticket size/i).first().fill('100000');
    await page.getByRole('button', { name: /Nhà đầu tư Tiêu chuẩn|Standard Investor/i }).click();
    await page.getByLabel(/Đồng ý|agree/i).check();
    await page.getByRole('button', { name: /Tạo tài khoản Nhà đầu tư|Create investor account/i }).click();
    await expect(page).toHaveURL(/login.*otp=1/);
  });
});
