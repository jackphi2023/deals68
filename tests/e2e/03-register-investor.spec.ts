import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, gotoAndWait, maybeSkipAuth } from '../helpers/deals68';

test.describe('TC-INV-REGISTER — Investor account creation and validation', () => {
  test('TC-INV-REG-001 Required field validation shows clear error', async ({ page }) => {
    await gotoAndWait(page, '/register/investor');
    await page.getByRole('button', { name: /Tạo tài khoản Nhà đầu tư|Create investor account/i }).click();
    await expect(page.locator('body')).toContainText(/chưa điền|Missing|Vui lòng kiểm tra/i);
    await expectNoHorizontalOverflow(page);
  });
  test('TC-INV-REG-002 Investor form contains general introduction and payment UI', async ({ page }) => {
    await gotoAndWait(page, '/register/investor');
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Thông tin Nhà đầu tư|Investor information/i);
    expect(text).toMatch(/Giới thiệu chung|General introduction/i);
    expect(text).toMatch(/Mô tả khẩu vị đầu tư|Investment appetite/i);
    expect(text).toMatch(/Kỳ hạn|Term/i);
    expect(text).toMatch(/tháng|months/i);
    expect(text).toMatch(/Tổng thanh toán|Total due/i);
    expect(text).toMatch(/Chuyển khoản QR|QR bank transfer/i);
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
    await page.getByLabel(/Tôi đã chuyển khoản|transferred/i).check();
    await page.getByLabel(/Đồng ý|agree/i).check();
    await page.getByRole('button', { name: /Tạo tài khoản Nhà đầu tư|Create investor account/i }).click();
    await expect(page).toHaveURL(/login.*otp=1/);
  });
});
