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
const deadline = Date.now() + Number(process.env.D68_DEPLOY_TIMEOUT_MS || 12 * 60_000);
const requiredBundleTokens = [
  'd68-id-sector-tags',
  'Doanh nghiệp đã đăng nhập có thể gửi Hồ sơ DN/Proposal',
];
const requiredCssTokens = [
  '--d68-investor-meta-line-limit:2',
  '-webkit-line-clamp:2',
];

function absolute(base, value) {
  return new URL(value, `${base}/`).href;
}

async function deployedCandidate(request) {
  let last = [];
  while (Date.now() < deadline) {
    last = [];
    for (const base of candidates) {
      try {
        const htmlResponse = await request.get(`${base}/`, {
          headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
          timeout: 20_000,
        });
        const html = await htmlResponse.text();
        const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
          .map((match) => absolute(base, match[1]));
        const styles = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css(?:\?[^"']*)?)["']/gi)]
          .map((match) => absolute(base, match[1]));
        let bundle = '';
        let cssBundle = '';
        for (const script of scripts) {
          const response = await request.get(script, {
            headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
            timeout: 20_000,
          });
          if (response.ok()) bundle += await response.text();
        }
        for (const style of styles) {
          const response = await request.get(style, {
            headers: { 'cache-control': 'no-cache, no-store, max-age=0' },
            timeout: 20_000,
          });
          if (response.ok()) cssBundle += await response.text();
        }
        const compactCss = cssBundle.replace(/\s+/g, '');
        const missing = requiredBundleTokens.filter((token) => !bundle.includes(token));
        const missingCss = requiredCssTokens.filter((token) => !compactCss.includes(token.replace(/\s+/g, '')));
        last.push({
          base,
          status: htmlResponse.status(),
          scripts: scripts.length,
          styles: styles.length,
          missing,
          missingCss,
        });
        if (htmlResponse.ok() && scripts.length && styles.length && !missing.length && !missingCss.length) return base;
      } catch (error) {
        last.push({ base, error: error?.message || String(error) });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`V12 Beta bundle was not deployed: ${JSON.stringify(last)}`);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

function rgb(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

async function settleHover(page) {
  await page.waitForTimeout(250);
}

async function inspectHome(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await goto(page, `${base}/`);
    await page.locator('.d68-home-role-card').first().waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator('.d68-home-investor-card h3').first().waitFor({ state: 'visible', timeout: 30_000 });

    const roleBackground = await page.locator('.d68-home-role-card').first().evaluate((node) => getComputedStyle(node).backgroundColor);
    const investorBackground = await page.locator('.d68-home-investor-card').first().evaluate((node) => getComputedStyle(node).backgroundColor);
    assert.equal(rgb(roleBackground), 'rgb(248,253,250)', 'Homepage role card background');
    assert.equal(rgb(investorBackground), 'rgb(255,254,248)', 'Homepage investor card background');

    const investorCard = page.locator('.d68-home-investor-card').first();
    await investorCard.hover();
    await settleHover(page);
    const investorTitleColor = await investorCard.locator('h3').evaluate((node) => getComputedStyle(node).color);
    assert.equal(rgb(investorTitleColor), 'rgb(27,173,234)', 'Homepage investor name hover color');

    const businessCard = page.locator('.d68-home-business-card').first();
    if (await businessCard.locator('h3').count()) {
      await businessCard.hover();
      await settleHover(page);
      const businessTitleColor = await businessCard.locator('h3').evaluate((node) => getComputedStyle(node).color);
      assert.equal(rgb(businessTitleColor), 'rgb(27,173,234)', 'Homepage business name hover color');
    }

    await page.screenshot({ path: '/tmp/deals68-entity-ui-v12-home.png', fullPage: true });
  } finally {
    await page.close();
  }
}

async function inspectListings(browser, base) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  try {
    await goto(page, `${base}/investors`);
    const investorCard = page.locator('.d68-investor-card:not(.d68-investor-card--loading)').first();
    await investorCard.waitFor({ state: 'visible', timeout: 30_000 });
    const description = investorCard.locator('.d68-investor-card__body > p');
    const clamp = await description.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        lineClamp: style.getPropertyValue('-webkit-line-clamp'),
        overflow: style.overflow,
        lineHeight: parseFloat(style.lineHeight),
        height: node.getBoundingClientRect().height,
      };
    });
    assert.equal(clamp.lineClamp.trim(), '3', 'Investor description must clamp at three lines');
    assert.equal(clamp.overflow, 'hidden', 'Investor description overflow');
    assert.ok(clamp.height <= clamp.lineHeight * 3 + 2, `Investor description height ${clamp.height}`);

    const pageMarker = await page.locator('.d68-investors-page').evaluate((node) =>
      getComputedStyle(node).getPropertyValue('--d68-investor-meta-line-limit').trim(),
    );
    assert.equal(pageMarker, '2', 'Investor metadata V12 CSS marker');

    const industryMeta = page
      .locator('.d68-investor-card__meta > span')
      .filter({ hasText: /^(Ngành|Industries):/i })
      .first();
    await industryMeta.waitFor({ state: 'visible', timeout: 30_000 });
    const industryClamp = await industryMeta.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        lineClamp: style.getPropertyValue('-webkit-line-clamp'),
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        lineHeight: parseFloat(style.lineHeight),
        height: node.getBoundingClientRect().height,
      };
    });
    assert.equal(industryClamp.lineClamp.trim(), '2', 'Investor industries must clamp at two lines');
    assert.equal(industryClamp.overflow, 'hidden', 'Investor industries overflow');
    assert.equal(industryClamp.textOverflow, 'ellipsis', 'Investor industries ellipsis');
    assert.ok(
      industryClamp.height <= industryClamp.lineHeight * 2 + 2,
      `Investor industries height ${industryClamp.height}`,
    );

    await investorCard.hover();
    await settleHover(page);
    const hoverBackground = await investorCard.evaluate((node) => getComputedStyle(node).backgroundColor);
    assert.equal(rgb(hoverBackground), 'rgb(255,254,248)', 'Investor list hover background');

    const investorTitle = investorCard.locator('.d68-investor-card__title-link');
    await investorTitle.hover();
    await settleHover(page);
    const investorTitleColor = await investorTitle.evaluate((node) => getComputedStyle(node).color);
    assert.equal(rgb(investorTitleColor), 'rgb(27,173,234)', 'Investor list title hover color');

    await goto(page, `${base}/businesses`);
    const businessCard = page.locator('.d68-business-card').filter({ has: page.locator('h3') }).first();
    await businessCard.waitFor({ state: 'visible', timeout: 30_000 });
    await businessCard.hover();
    await settleHover(page);
    const businessTitleColor = await businessCard.locator('h3').evaluate((node) => getComputedStyle(node).color);
    assert.equal(rgb(businessTitleColor), 'rgb(27,173,234)', 'Business list title hover color');

    await page.screenshot({ path: '/tmp/deals68-entity-ui-v12-listings.png', fullPage: true });
  } finally {
    await page.close();
  }
}

async function inspectInvestorDetail(browser, base, viewport, name) {
  const page = await browser.newPage({ viewport });
  try {
    await goto(page, `${base}/investors/INV-0603`);
    const cover = page.locator('.d68-id-cover');
    await cover.waitFor({ state: 'visible', timeout: 30_000 });
    const state = await page.evaluate(() => {
      const cover = document.querySelector('.d68-id-cover');
      const eyebrow = document.querySelector('.d68-id-cover__eyebrow');
      const firstIcon = document.querySelector('.d68-id-section-title > span');
      const sectorTag = document.querySelector('.d68-id-sector-tags span');
      const timelineRow = document.querySelector('.d68-id-timeline--proposal > div');
      const timelineBullet = timelineRow?.querySelector('i');
      const coverRect = cover?.getBoundingClientRect();
      const eyebrowRect = eyebrow?.getBoundingClientRect();
      const iconStyle = firstIcon ? getComputedStyle(firstIcon) : null;
      const sectorStyle = sectorTag ? getComputedStyle(sectorTag) : null;
      const beforeStyle = timelineRow ? getComputedStyle(timelineRow, '::before') : null;
      const rowRect = timelineRow?.getBoundingClientRect();
      const bulletRect = timelineBullet?.getBoundingClientRect();
      return {
        eyebrowTop: coverRect && eyebrowRect ? eyebrowRect.top - coverRect.top : -1,
        iconSvgCount: document.querySelectorAll('.d68-id-section-title > span svg').length,
        iconBorder: iconStyle?.borderTopWidth || '',
        iconColor: iconStyle?.color || '',
        sectorBackground: sectorStyle?.backgroundColor || '',
        sectorColor: sectorStyle?.color || '',
        sectorBorder: sectorStyle?.borderTopWidth || '',
        accessParagraphs: Array.from(document.querySelectorAll('.d68-id-access p')).map((node) => node.textContent?.trim() || ''),
        lineLeft: beforeStyle ? parseFloat(beforeStyle.left) : null,
        bulletCenter: rowRect && bulletRect ? bulletRect.left + bulletRect.width / 2 - rowRect.left : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    const expectedTop = name === 'mobile' ? [18, 27] : [20, 31];
    assert.ok(state.eyebrowTop >= expectedTop[0] && state.eyebrowTop <= expectedTop[1], `${name}: eyebrow top ${state.eyebrowTop}`);
    assert.ok(state.iconSvgCount >= 5, `${name}: line icons missing`);
    assert.equal(state.iconBorder, '0px', `${name}: icon circle border remains`);
    assert.equal(rgb(state.iconColor), 'rgb(242,181,29)', `${name}: icon color`);
    assert.equal(rgb(state.sectorBackground), 'rgb(231,246,253)', `${name}: sector background`);
    assert.equal(rgb(state.sectorColor), 'rgb(21,150,204)', `${name}: sector color`);
    assert.equal(state.sectorBorder, '0px', `${name}: sector border remains`);
    assert.equal(state.accessParagraphs.length, 3, `${name}: access rule count`);
    assert.match(state.accessParagraphs.join(' '), /Doanh nghiệp đã đăng nhập|Signed-in businesses/i);
    assert.match(state.accessParagraphs.join(' '), /SĐT, Email|phone and email/i);
    if (state.lineLeft !== null && state.bulletCenter !== null) {
      assert.ok(Math.abs(state.lineLeft - state.bulletCenter) <= 1.5, `${name}: timeline line ${state.lineLeft}, bullet ${state.bulletCenter}`);
    }
    assert.ok(state.overflow <= 2, `${name}: horizontal overflow ${state.overflow}`);

    await page.screenshot({ path: `/tmp/deals68-entity-ui-v12-detail-${name}.png`, fullPage: true });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const requestContext = await browser.newContext();
  const base = await deployedCandidate(requestContext.request);
  await requestContext.close();
  console.log(`Entity UI V12 Beta: ${base}`);

  await inspectHome(browser, base);
  await inspectListings(browser, base);
  await inspectInvestorDetail(browser, base, { width: 1440, height: 1100 }, 'desktop');
  await inspectInvestorDetail(browser, base, { width: 390, height: 844 }, 'mobile');
  console.log('✓ Deals68 Entity UI V12 real Beta smoke: PASS');
} finally {
  await browser.close();
}
