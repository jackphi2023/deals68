#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const candidates = String(
  process.env.D68_BETA_URLS ||
    'https://beta-reference-deals68.netlify.app,https://beta-reference--deals68.netlify.app',
)
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const release = String(process.env.D68_RELEASE_SHA || Date.now());
const deadline = Date.now() + Number(process.env.D68_DEPLOY_TIMEOUT_MS || 15 * 60_000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function absolute(base, value) {
  return new URL(value, `${base}/`).href;
}

function scriptSources(html, base) {
  return [...new Set(
    [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => absolute(base, match[1])),
  )];
}

async function deployedBase(request) {
  let diagnostics = [];
  while (Date.now() < deadline) {
    diagnostics = [];
    for (const base of candidates) {
      try {
        const response = await request.get(`${base}/register/investor?v14=${encodeURIComponent(release)}`, {
          headers: { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache' },
          timeout: 25_000,
        });
        const html = await response.text();
        const scripts = scriptSources(html, base);
        let bundle = '';
        for (const source of scripts) {
          const asset = await request.get(`${source}${source.includes('?') ? '&' : '?'}v14=${encodeURIComponent(release)}`, {
            headers: { 'cache-control': 'no-cache, no-store, max-age=0', pragma: 'no-cache' },
            timeout: 40_000,
          });
          if (asset.ok()) bundle += await asset.text();
        }
        const markers = {
          registration: bundle.includes('investor_register_v14'),
          canonicalProfile: bundle.includes('Tên hiển thị công khai (VN)'),
          taxonomy: bundle.includes('Nhà đầu tư cá nhân / Thiên thần'),
        };
        diagnostics.push({ base, status: response.status(), scripts: scripts.length, markers });
        if (response.ok() && scripts.length && Object.values(markers).every(Boolean)) return base;
      } catch (error) {
        diagnostics.push({ base, error: error?.message || String(error) });
      }
    }
    await delay(10_000);
  }
  throw new Error(`Investor Workflow V14 bundle was not deployed: ${JSON.stringify(diagnostics)}`);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

async function inspectVietnamese(browser, base, viewport, name) {
  const page = await browser.newPage({ viewport });
  try {
    await goto(page, `${base}/register/investor?v14=${encodeURIComponent(release)}`);
    await page.getByRole('heading', { name: 'Tạo hồ sơ Nhà đầu tư', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });

    for (const text of [
      'Loại hình nhà đầu tư',
      'Giai đoạn phù hợp',
      'Khu vực đầu tư',
      'Thị trường quan tâm',
      'Ngành quan tâm',
      'Loại giao dịch quan tâm',
      'Nhà đầu tư cá nhân / Thiên thần',
      'Giai đoạn tăng trưởng',
      'Đầu tư',
    ]) {
      assert.ok(await page.getByText(text, { exact: true }).count(), `${name}: missing Vietnamese text ${text}`);
    }

    const state = await page.evaluate(() => {
      const active = Array.from(document.querySelectorAll('.d68-taxonomy-picker__tags button.active'))
        .map((node) => node.textContent?.trim() || '')
        .filter(Boolean);
      const text = document.body.innerText;
      return {
        active,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        hasEnglishInvestorType: /\bInvestor type\b/.test(text),
        hasEnglishPreferredStages: /\bPreferred stages\b/.test(text),
        qrCount: document.querySelectorAll('.d68-bizreg-qrbox img').length,
        submitText: document.querySelector('.d68-auth-submit')?.textContent?.trim() || '',
      };
    });

    assert.ok(state.active.some((value) => value.includes('Nhà đầu tư cá nhân')), `${name}: default Investor type is not active`);
    assert.ok(state.active.some((value) => value.includes('Giai đoạn tăng trưởng')), `${name}: default stage is not active`);
    assert.ok(state.active.includes('Đầu tư'), `${name}: default deal type is not active`);
    assert.equal(state.hasEnglishInvestorType, false, `${name}: English Investor type leaked into Vietnamese UI`);
    assert.equal(state.hasEnglishPreferredStages, false, `${name}: English stage label leaked into Vietnamese UI`);
    assert.equal(state.qrCount, 1, `${name}: QR payment block missing`);
    assert.equal(state.submitText, 'Tạo tài khoản Nhà đầu tư', `${name}: submit wording`);
    assert.ok(state.overflow <= 2, `${name}: horizontal overflow ${state.overflow}`);

    await page.screenshot({ path: `/tmp/deals68-investor-v14-register-${name}.png`, fullPage: true });
  } finally {
    await page.close();
  }
}

async function inspectEnglish(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  try {
    await goto(page, `${base}/en/register/investor?v14=${encodeURIComponent(release)}`);
    await page.getByRole('heading', { name: 'Create your Investor profile', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    for (const text of ['Investor type', 'Preferred stages', 'Investment regions', 'Target markets', 'Preferred industries', 'Preferred deal types']) {
      assert.ok(await page.getByText(text, { exact: true }).count(), `English registration missing ${text}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `English registration horizontal overflow ${overflow}`);
    await page.screenshot({ path: '/tmp/deals68-investor-v14-register-en-desktop.png', fullPage: true });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const probe = await browser.newContext();
  const base = await deployedBase(probe.request);
  await probe.close();
  console.log(`Investor Workflow V14 Beta: ${base}`);
  await inspectVietnamese(browser, base, { width: 390, height: 844 }, 'vi-mobile');
  await inspectVietnamese(browser, base, { width: 1280, height: 1000 }, 'vi-desktop');
  await inspectEnglish(browser, base);
  console.log('✓ Deals68 Investor Workflow V14 real Beta registration smoke: PASS');
} finally {
  await browser.close();
}
