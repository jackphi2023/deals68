import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow, gotoAndWait, maybeSkipAuth } from '../helpers/deals68';

test.describe('TC-BUS-REGISTER — Business account creation and validation', () => {
  test('TC-BUS-REG-001 Required field validation shows clear red error', async ({ page }) => {
    await gotoAndWait(page, '/register/business');
    await page.getByRole('button', { name: /Tạo tài khoản doanh nghiệp|Create business account/i }).click();
    await expect(page.locator('body')).toContainText(/chưa điền|Missing|Vui lòng kiểm tra/i);
    await expectNoHorizontalOverflow(page);
  });
  test('TC-BUS-REG-002 Form contains required business fields and max 5 files/images copy', async ({ page }) => {
    await gotoAndWait(page, '/register/business');
    const text = await page.locator('body').innerText();
    const required = ['Tên doanh nghiệp','Tỉnh/Thành phố','Doanh thu năm gần nhất','Tỷ suất lợi nhuận','Số tiền gọi vốn','Tỷ lệ cổ phần','Ảnh','File Hồ sơ'];
    for (const label of required) expect(text).toContain(label);
    expect(text).toMatch(/5\s*(ảnh|images|file)/i);
  });
  test('TC-BUS-REG-003 Happy path signup is gated by env and redirects to OTP login', async ({ page }, testInfo) => {
    if (maybeSkipAuth(testInfo)) test.skip();
    const email = process.env.D68_E2E_BUSINESS_EMAIL || `biz-${Date.now()}@example.com`;
    const password = process.env.D68_E2E_PASSWORD || 'Deals68Test@12345';
    await gotoAndWait(page, '/register/business');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Mật khẩu|Password/i).fill(password);
    await page.getByLabel(/Tên người phụ trách|Contact name/i).fill('Deals68 QA Business');
    await page.getByLabel(/Tên doanh nghiệp|Business name/i).fill('QA Business Co');
    await page.getByLabel(/Doanh thu năm|Latest annual revenue/i).fill('10000000000');
    await page.getByLabel(/EBITDA/i).fill('15');
    await page.getByLabel(/Số tiền gọi vốn|desired transaction/i).fill('1000000000');
    await page.getByLabel(/Tỷ lệ cổ phần|Stake/i).fill('10');
    await page.getByLabel(/Tôi đã chuyển khoản|transferred/i).check();
    await page.getByLabel(/Đồng ý|agree/i).check();
    await page.getByRole('button', { name: /Tạo tài khoản doanh nghiệp|Create business account/i }).click();
    await expect(page).toHaveURL(/login.*otp=1/);
  });
});
