import { test, expect } from '@playwright/test';
import { gotoAndWait, login, maybeSkipAuth } from '../helpers/deals68';

test.describe('TC-DASHBOARD-ADMIN — dashboard and admin workflows', () => {
  test('TC-DASH-BIZ-001 Business dashboard loads for configured test user', async ({ page }, testInfo) => {
    if (maybeSkipAuth(testInfo, 'Set D68_E2E_RUN_AUTH=1 D68_E2E_BUSINESS_LOGIN_EMAIL and D68_E2E_PASSWORD.')) test.skip();
    await login(page, process.env.D68_E2E_BUSINESS_LOGIN_EMAIL!, process.env.D68_E2E_PASSWORD!, 'business');
    await gotoAndWait(page, '/dashboard/business');
    await expect(page.locator('body')).toContainText(/Business Quality Score|Tổng quan|Hồ sơ|Tài liệu/i);
    await expect(page.locator('body')).toContainText(/Định giá|valuation|Nhà đầu tư quan tâm|Proposal/i);
  });
  test('TC-DASH-INV-001 Investor dashboard loads for configured test user', async ({ page }, testInfo) => {
    if (maybeSkipAuth(testInfo, 'Set D68_E2E_RUN_AUTH=1 D68_E2E_INVESTOR_LOGIN_EMAIL and D68_E2E_PASSWORD.')) test.skip();
    await login(page, process.env.D68_E2E_INVESTOR_LOGIN_EMAIL!, process.env.D68_E2E_PASSWORD!, 'investor');
    await gotoAndWait(page, '/dashboard/investor');
    await expect(page.locator('body')).toContainText(/Nhà đầu tư|Investor|Proposal|Doanh nghiệp/i);
  });
  test('TC-ADMIN-001 Admin dashboard and valuation config load for configured admin', async ({ page }, testInfo) => {
    if (maybeSkipAuth(testInfo, 'Set D68_E2E_RUN_AUTH=1 D68_E2E_ADMIN_EMAIL and D68_E2E_ADMIN_PASSWORD.')) test.skip();
    await login(page, process.env.D68_E2E_ADMIN_EMAIL!, process.env.D68_E2E_ADMIN_PASSWORD!, 'admin');
    await gotoAndWait(page, '/admin');
    await expect(page.locator('body')).toContainText(/Admin|Doanh nghiệp|Nhà đầu tư/i);
    await gotoAndWait(page, '/admin/valuation');
    await expect(page.locator('body')).toContainText(/Cấu hình định giá|Valuation Config|valuation_config/i);
  });
});
