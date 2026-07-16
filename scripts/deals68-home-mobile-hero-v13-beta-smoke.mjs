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

const deadline = Date.now() + Number(process.env.D68_DEPLOY_TIMEOUT_MS || 15 * 60_000);
const requiredBundleTokens = [
  'd68-home-hero-slider-v2',
  'd68-home-hero-media__image',
  'single-active',
];
const requiredCssTokens = [
  'aspect-ratio:3/4!important',
  'minmax(150px,1.7fr)!important',
  'object-position:right center!important',
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
        last.push({ base, status: htmlResponse.status(), scripts: scripts.length, styles: styles.length, missing, missingCss });
        if (htmlResponse.ok() && scripts.length && styles.length && !missing.length && !missingCss.length) return base;
      } catch (error) {
        last.push({ base, error: error?.message || String(error) });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`Homepage Hero V13 Beta was not deployed: ${JSON.stringify(last)}`);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

async function waitForImage(page) {
  const image = page.locator('.d68-home-hero-slider-v2--ready .d68-home-hero-media__image');
  await image.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const node = document.querySelector('.d68-home-hero-slider-v2--ready .d68-home-hero-media__image');
    return node instanceof HTMLImageElement && node.complete && node.naturalWidth > 100 && node.naturalHeight > 100;
  }, { timeout: 30_000 });
}

async function inspectLoading(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  try {
    await page.route('**/rest/v1/site_banners*', async (route) => {
      await gate;
      await route.abort();
    });
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const loading = page.locator('.d68-home-hero-slider-v2--loading');
    await loading.waitFor({ state: 'visible', timeout: 15_000 });
    const state = await loading.evaluate((node) => ({
      text: node.textContent || '',
      images: node.querySelectorAll('img').length,
      dataSvg: node.querySelectorAll('img[src^="data:image/svg+xml"]').length,
      background: getComputedStyle(node).backgroundImage,
    }));
    assert.equal(state.text.trim(), '', 'Loading Hero must not contain text');
    assert.equal(state.images, 0, 'Loading Hero must not render an image');
    assert.equal(state.dataSvg, 0, 'Loading Hero must not render an SVG placeholder');
    assert.notEqual(state.background, 'none', 'Loading Hero needs a neutral background');
  } finally {
    release?.();
    await page.close();
  }
}

async function inspectHomeMobile(browser, base, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await goto(page, `${base}/`);
    await waitForImage(page);
    const state = await page.evaluate(() => {
      const hero = document.querySelector('.d68-home-hero');
      const slider = document.querySelector('.d68-home-hero-slider-v2--ready');
      const media = slider?.querySelector('.d68-home-hero-media');
      const image = slider?.querySelector('.d68-home-hero-media__image');
      const metric = document.querySelector('.d68-home-hero-stats > div:nth-child(3) b');
      if (!(hero instanceof HTMLElement) || !(metric instanceof HTMLElement)) throw new Error('Hero or metric missing');
      metric.textContent = '300.000 tỷ ₫';
      const heroRect = hero.getBoundingClientRect();
      const metricStyle = getComputedStyle(metric);
      const metricRect = metric.getBoundingClientRect();
      return {
        layout: slider?.getAttribute('data-hero-layout') || '',
        slides: slider?.querySelectorAll('.d68-hero-slide').length || 0,
        variant: media?.getAttribute('data-hero-variant') || '',
        source: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
        naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
        naturalHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
        heroRatio: heroRect.height / heroRect.width,
        whiteSpace: metricStyle.whiteSpace,
        metricWidth: metric.clientWidth,
        metricScrollWidth: metric.scrollWidth,
        metricHeight: metricRect.height,
        lineHeight: Number.parseFloat(metricStyle.lineHeight),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    assert.equal(state.layout, 'single-active', `${width}: Hero layout`);
    assert.equal(state.slides, 1, `${width}: active slide count`);
    assert.equal(state.variant, 'mobile', `${width}: mobile image variant`);
    assert.ok(state.source && !state.source.startsWith('data:image/svg+xml'), `${width}: real Hero source`);
    assert.ok(state.naturalWidth > 100 && state.naturalHeight > 100, `${width}: image dimensions`);
    assert.ok(state.heroRatio >= 1.30 && state.heroRatio <= 1.36, `${width}: 3:4 Hero ratio ${state.heroRatio}`);
    assert.equal(state.whiteSpace, 'nowrap', `${width}: deal value nowrap`);
    assert.ok(state.metricScrollWidth <= state.metricWidth + 1, `${width}: deal value overflow`);
    assert.ok(state.metricHeight <= state.lineHeight * 1.25, `${width}: deal value wraps`);
    assert.ok(state.overflow <= 1, `${width}: page horizontal overflow`);

    if (width === 390) {
      await page.screenshot({ path: '/tmp/deals68-home-mobile-hero-v13-390.png', fullPage: true });
    }
  } finally {
    await page.close();
  }
}

async function inspectTablet(browser, base) {
  const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
  try {
    await goto(page, `${base}/`);
    await waitForImage(page);
    const state = await page.evaluate(() => {
      const hero = document.querySelector('.d68-home-hero');
      const stats = document.querySelector('.d68-home-hero-stats');
      const rect = hero?.getBoundingClientRect();
      return {
        display: stats ? getComputedStyle(stats).display : '',
        ratio: rect ? rect.width / rect.height : 0,
      };
    });
    assert.equal(state.display, 'flex', 'Tablet statistics layout must remain unchanged');
    assert.ok(state.ratio > 2.3, `Tablet Hero ratio changed: ${state.ratio}`);
  } finally {
    await page.close();
  }
}

async function inspectInvestorDetailMobile(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await goto(page, `${base}/investors/INV-0603`);
    const cover = page.locator('.d68-id-cover');
    const title = page.locator('.d68-id-cover__content h1');
    await cover.waitFor({ state: 'visible', timeout: 30_000 });
    await title.waitFor({ state: 'visible', timeout: 30_000 });

    const beforeColor = await title.evaluate((node) => getComputedStyle(node).color);
    await title.hover();
    await page.waitForTimeout(250);
    const afterColor = await title.evaluate((node) => getComputedStyle(node).color);
    assert.equal(afterColor, beforeColor, 'Static Investor Detail title must not change on hover');

    const state = await page.evaluate(() => {
      const cover = document.querySelector('.d68-id-cover');
      const image = cover?.querySelector(':scope > img');
      const content = cover?.querySelector('.d68-id-cover__content');
      const titleNode = content?.querySelector('h1');
      const badges = content?.querySelector('.d68-id-cover__badges');
      const coverRect = cover?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      const titleRect = titleNode?.getBoundingClientRect();
      const badgeRect = badges?.getBoundingClientRect();
      return {
        objectPosition: image ? getComputedStyle(image).objectPosition : '',
        fullHeight: !!coverRect && !!imageRect && Math.abs(coverRect.height - imageRect.height) <= 2,
        rightAligned: !!coverRect && !!imageRect && Math.abs(coverRect.right - imageRect.right) <= 2,
        contentLeft: !!coverRect && !!contentRect && contentRect.left - coverRect.left <= 22,
        contentBottom: !!coverRect && !!contentRect && coverRect.bottom - contentRect.bottom <= 2,
        titleLeft: !!contentRect && !!titleRect && Math.abs(contentRect.left - titleRect.left) <= 2,
        badgesLeft: !!contentRect && !!badgeRect && Math.abs(contentRect.left - badgeRect.left) <= 2,
        badgeCount: badges?.children.length || 0,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    assert.match(state.objectPosition, /100%|right/i, `Investor cover object-position: ${state.objectPosition}`);
    assert.ok(state.fullHeight, 'Investor cover image must fill Hero height');
    assert.ok(state.rightAligned, 'Investor cover image must anchor to the right');
    assert.ok(state.contentLeft && state.contentBottom, 'Investor content must stay bottom-left');
    assert.ok(state.titleLeft && state.badgesLeft, 'Investor title and badges must align left');
    assert.equal(state.badgeCount, 3, 'Investor type, country and active badges must display');
    assert.ok(state.overflow <= 1, `Investor Detail mobile overflow ${state.overflow}`);

    await page.screenshot({ path: '/tmp/deals68-investor-detail-mobile-v13.png', fullPage: true });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const base = await deployedCandidate(context.request);
  await context.close();
  console.log(`Homepage Hero V13 Beta: ${base}`);

  await inspectLoading(browser, base);
  for (const width of [375, 390, 430]) await inspectHomeMobile(browser, base, width);
  await inspectTablet(browser, base);
  await inspectInvestorDetailMobile(browser, base);
  console.log('✓ Deals68 Homepage Hero and Investor mobile V13 Beta smoke: PASS');
} finally {
  await browser.close();
}
