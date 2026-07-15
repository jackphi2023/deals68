#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = String(
  process.env.D68_BETA_URL || 'https://beta-reference-deals68.netlify.app',
).replace(/\/+$/, '');
const release = String(process.env.D68_RELEASE_SHA || Date.now());
const investorUrl = `${base}/investors/INV-0603?v10=${encodeURIComponent(release)}`;
const deadline = Date.now() + 20 * 60 * 1000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSnapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.title,
    rootChildren: document.querySelector('#root')?.childElementCount || 0,
    bodyText: (document.body?.innerText || '').slice(0, 1800),
    coverCount: document.querySelectorAll('.d68-id-cover').length,
    h1: document.querySelector('.d68-id-cover h1')?.textContent?.trim() || '',
  }));
}

async function inspectInvestor(page, viewportName) {
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });

  const response = await page.goto(investorUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  assert.ok(response, `${viewportName}: navigation returned no response`);
  assert.ok(response.status() < 400, `${viewportName}: HTTP ${response.status()}`);

  await page.locator('.d68-id-cover img').waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await page.waitForFunction(() => {
    const image = document.querySelector('.d68-id-cover img');
    return image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0;
  }, null, { timeout: 30_000 });

  const state = await page.evaluate(() => {
    const cover = document.querySelector('.d68-id-cover');
    const image = document.querySelector('.d68-id-cover img');
    const rect = cover?.getBoundingClientRect();
    return {
      rootChildren: document.querySelector('#root')?.childElementCount || 0,
      h1: document.querySelector('.d68-id-cover h1')?.textContent?.trim() || '',
      badgeCount: document.querySelectorAll('.d68-id-cover__badges span').length,
      activeBadge: document.querySelector('.d68-id-cover__badges .active')?.textContent?.trim() || '',
      coverWidth: rect?.width || 0,
      coverHeight: rect?.height || 0,
      imageSrc: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
      imageWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
      imageHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
      sectionTitles: Array.from(document.querySelectorAll('.d68-id-section h2')).map((node) => node.textContent?.trim() || ''),
      sideExists: Boolean(document.querySelector('.d68-id-side')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  assert.ok(state.rootChildren > 0, `${viewportName}: React root is empty`);
  assert.ok(state.h1.length > 8, `${viewportName}: Investor title is missing`);
  assert.ok(state.badgeCount >= 3, `${viewportName}: Cover badges are incomplete`);
  assert.match(state.activeBadge, /hoạt động|active/i, `${viewportName}: Active badge is missing`);
  assert.ok(state.imageWidth > 0 && state.imageHeight > 0, `${viewportName}: Cover image failed to load`);
  assert.ok(state.sideExists, `${viewportName}: Investor CTA sidebar is missing`);
  assert.ok(state.overflow <= 2, `${viewportName}: Horizontal overflow ${state.overflow}px`);
  for (const expected of [
    /Tổng quan đầu tư|Investment overview/i,
    /Giới thiệu|Introduction/i,
    /Tiêu chí đầu tư|Investment criteria/i,
    /Thị trường quan tâm|Target investment markets/i,
    /Proposal/i,
    /Thông tin liên hệ|Contact information/i,
  ]) {
    assert.ok(
      state.sectionTitles.some((title) => expected.test(title)),
      `${viewportName}: missing section ${expected}`,
    );
  }

  if (viewportName === 'desktop') {
    assert.ok(state.coverWidth >= 900, `desktop: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 300, `desktop: cover height ${state.coverHeight}`);
  } else {
    assert.ok(state.coverWidth >= 350, `mobile: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 400, `mobile: cover height ${state.coverHeight}`);
  }

  assert.equal(
    browserErrors.length,
    0,
    `${viewportName}: browser errors: ${browserErrors.join(' | ')}`,
  );
  return state;
}

const browser = await chromium.launch({ headless: true });
let lastError = null;
let attempt = 0;

try {
  while (Date.now() < deadline) {
    attempt += 1;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      extraHTTPHeaders: { 'cache-control': 'no-cache' },
    });
    const page = await context.newPage();
    try {
      console.log(`Beta smoke attempt ${attempt}: ${investorUrl}`);
      const desktop = await inspectInvestor(page, 'desktop');

      const assetResponse = await context.request.get(
        `${base}/assets/investor-cover-default.svg?v10=${encodeURIComponent(release)}`,
        { headers: { 'cache-control': 'no-cache' } },
      );
      assert.ok(assetResponse.ok(), `Default cover asset HTTP ${assetResponse.status()}`);
      const assetText = await assetResponse.text();
      assert.match(assetText, /^<svg[\s>]/, 'Default cover asset is not SVG');
      assert.match(assetText, /width="1600"/, 'Default cover width is not 1600');
      assert.match(assetText, /height="560"/, 'Default cover height is not 560');
      assert.match(assetText, /data:image\/webp;base64,/, 'Founder cover artwork is not embedded');

      await page.screenshot({
        path: '/tmp/deals68-investor-v10-beta-desktop.png',
        fullPage: true,
      });
      await context.close();

      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        extraHTTPHeaders: { 'cache-control': 'no-cache' },
      });
      const mobilePage = await mobileContext.newPage();
      const mobile = await inspectInvestor(mobilePage, 'mobile');
      await mobilePage.screenshot({
        path: '/tmp/deals68-investor-v10-beta-mobile.png',
        fullPage: true,
      });
      await mobileContext.close();

      console.log(JSON.stringify({ desktop, mobile }, null, 2));
      console.log('✓ Netlify Beta Investor Profile V10 real public smoke: PASS');
      process.exit(0);
    } catch (error) {
      lastError = error;
      const snapshot = await pageSnapshot(page).catch(() => null);
      console.log(`Attempt ${attempt} not ready: ${error?.message || error}`);
      if (snapshot) console.log(JSON.stringify(snapshot));
      await context.close();
      await delay(10_000);
    }
  }
} finally {
  await browser.close();
}

console.error('✗ Netlify Beta Investor Profile V10 smoke timed out.');
console.error(lastError?.stack || lastError || 'Unknown error');
process.exit(1);
