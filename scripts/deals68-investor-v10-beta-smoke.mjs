#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const base = String(
  process.env.D68_BETA_URL || 'https://beta-reference-deals68.netlify.app',
).replace(/\/+$/, '');
const release = String(process.env.D68_RELEASE_SHA || Date.now());
const investorUrl = `${base}/investors/INV-0603?v11=${encodeURIComponent(release)}`;
const assetUrl = `${base}/assets/investor-cover-default.svg?v11=${encodeURIComponent(release)}`;
const deployDeadline = Date.now() + 12 * 60 * 1000;
const diagnosticPath = '/tmp/deals68-investor-v10-beta-diagnostic.json';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function serializeError(error) {
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    stack: error?.stack || '',
  };
}

async function pageSnapshot(page, events = []) {
  const dom = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    rootChildren: document.querySelector('#root')?.childElementCount || 0,
    bodyText: (document.body?.innerText || '').slice(0, 3200),
    bodyHtml: (document.body?.innerHTML || '').slice(0, 7000),
    coverCount: document.querySelectorAll('.d68-id-cover').length,
    errorState: document.querySelector('.d68-id-state h1')?.textContent?.trim() || '',
    h1: document.querySelector('.d68-id-cover h1')?.textContent?.trim() || '',
  })).catch(() => null);
  return { dom, events: events.slice(-50) };
}

async function writeDiagnostic(payload) {
  fs.writeFileSync(diagnosticPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.error('BETA_SMOKE_DIAGNOSTIC');
  console.error(JSON.stringify(payload, null, 2));
}

async function waitForDeployedAsset(request) {
  let attempt = 0;
  let last = null;
  while (Date.now() < deployDeadline) {
    attempt += 1;
    try {
      const response = await request.get(assetUrl, {
        headers: { 'cache-control': 'no-cache' },
        timeout: 30_000,
      });
      const text = await response.text();
      last = {
        attempt,
        status: response.status(),
        contentType: response.headers()['content-type'] || '',
        length: text.length,
        hasSvg: /^<svg[\s>]/.test(text),
        hasWidth: /width="1600"/.test(text),
        hasHeight: /height="560"/.test(text),
        hasArtwork: /data:image\/webp;base64,/.test(text),
      };
      console.log(`Deploy asset probe ${attempt}: ${JSON.stringify(last)}`);
      if (response.ok() && last.hasSvg && last.hasWidth && last.hasHeight && last.hasArtwork) return last;
    } catch (error) {
      last = { attempt, error: serializeError(error) };
      console.log(`Deploy asset probe ${attempt}: ${error?.message || error}`);
    }
    await delay(10_000);
  }
  const error = new Error('Netlify Beta did not serve the Investor default cover asset within 12 minutes.');
  error.probe = last;
  throw error;
}

async function inspectInvestor(page, viewportName) {
  const events = [];
  page.on('pageerror', (error) => events.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') events.push(`console:${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    events.push(`requestfailed:${request.method()}:${request.url()}:${request.failure()?.errorText || ''}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) events.push(`response:${response.status()}:${response.url()}`);
  });

  const response = await page.goto(investorUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  assert.ok(response, `${viewportName}: navigation returned no response`);
  assert.ok(response.status() < 400, `${viewportName}: HTTP ${response.status()}`);

  await page.waitForFunction(() => (
    Boolean(document.querySelector('.d68-id-cover img')) ||
    Boolean(document.querySelector('.d68-id-state h1'))
  ), null, { timeout: 45_000 });

  const errorState = await page.locator('.d68-id-state h1').count();
  if (errorState) {
    const snapshot = await pageSnapshot(page, events);
    throw Object.assign(new Error(`${viewportName}: Investor page rendered an error state`), { snapshot });
  }

  await page.locator('.d68-id-cover img').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('.d68-id-cover img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }, null, { timeout: 30_000 });

  const state = await page.evaluate(() => {
    const cover = document.querySelector('.d68-id-cover');
    const main = document.querySelector('.d68-id-main');
    const side = document.querySelector('.d68-id-side');
    const image = document.querySelector('.d68-id-cover img');
    const intro = document.querySelector('.d68-id-introduction__copy');
    const coverRect = cover?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const sideRect = side?.getBoundingClientRect();
    const introText = intro?.textContent?.trim() || '';
    const bodyText = document.body?.innerText || '';
    const occurrenceCount = introText ? bodyText.split(introText).length - 1 : 0;
    const orderedSections = Array.from(main?.querySelectorAll(':scope > [data-testid]') || [])
      .map((node) => node.getAttribute('data-testid'));
    return {
      rootChildren: document.querySelector('#root')?.childElementCount || 0,
      h1: document.querySelector('.d68-id-cover h1')?.textContent?.trim() || '',
      eyebrow: document.querySelector('.d68-id-cover__eyebrow')?.textContent?.trim() || '',
      heroParagraphCount: document.querySelectorAll('.d68-id-cover p').length,
      badgeCount: document.querySelectorAll('.d68-id-cover__badges span').length,
      activeBadge: document.querySelector('.d68-id-cover__badges .active')?.textContent?.trim() || '',
      coverWidth: coverRect?.width || 0,
      coverHeight: coverRect?.height || 0,
      mainWidth: mainRect?.width || 0,
      sideWidth: sideRect?.width || 0,
      sideTopDelta: coverRect && sideRect ? Math.abs(coverRect.top - sideRect.top) : 9999,
      sideBelowMain: mainRect && sideRect ? sideRect.top >= mainRect.bottom - 2 : false,
      imageSrc: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
      imageWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
      imageHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
      introTextLength: introText.length,
      descriptionOccurrences: occurrenceCount,
      orderedSections,
      sectionTitles: Array.from(document.querySelectorAll('.d68-id-section h2')).map((node) => node.textContent?.trim() || ''),
      criteriaRows: document.querySelectorAll('[data-testid="investor-criteria"] .d68-id-criteria-row').length,
      sectorTagCount: document.querySelectorAll('[data-testid="investor-criteria"] .d68-id-sector-block .d68-id-tags span').length,
      marketFlagCount: document.querySelectorAll('[data-testid="investor-markets"] .d68-id-market-tags i').length,
      sidebarSend: document.querySelector('.d68-id-cta span')?.textContent?.trim() || '',
      sidebarAccess: document.querySelector('.d68-id-access h3')?.textContent?.trim() || '',
      overviewCount: Array.from(document.querySelectorAll('.d68-id-section h2')).filter((node) => /Tổng quan đầu tư|Investment overview/i.test(node.textContent || '')).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  assert.ok(state.rootChildren > 0, `${viewportName}: React root is empty`);
  assert.ok(state.h1.length > 8, `${viewportName}: Investor title is missing`);
  assert.match(state.eyebrow, /INV-0603/i, `${viewportName}: Investor code is missing from Hero`);
  assert.equal(state.heroParagraphCount, 0, `${viewportName}: Hero contains duplicated description paragraph`);
  assert.equal(state.descriptionOccurrences, 1, `${viewportName}: Introduction description occurrence count ${state.descriptionOccurrences}`);
  assert.ok(state.badgeCount >= 3, `${viewportName}: Cover badges are incomplete`);
  assert.match(state.activeBadge, /hoạt động|active/i, `${viewportName}: Active badge is missing`);
  assert.ok(state.imageWidth > 0 && state.imageHeight > 0, `${viewportName}: Cover image failed to load`);
  assert.equal(state.overviewCount, 0, `${viewportName}: obsolete Investment overview card remains`);
  assert.ok(state.criteriaRows >= 2, `${viewportName}: criteria table is incomplete`);
  assert.ok(state.sectorTagCount >= 1, `${viewportName}: sectors are not nested in criteria`);
  assert.ok(state.marketFlagCount >= 1, `${viewportName}: market flags are missing`);
  assert.match(state.sidebarSend, /Gửi Hồ sơ Doanh nghiệp|Send business profile/i, `${viewportName}: Send Proposal sidebar changed`);
  assert.match(state.sidebarAccess, /Ai được xem gì|Who can see what/i, `${viewportName}: Access sidebar changed`);
  assert.ok(state.overflow <= 2, `${viewportName}: Horizontal overflow ${state.overflow}px`);

  assert.deepEqual(state.orderedSections, [
    'investor-public-hero',
    'investor-introduction',
    'investor-criteria',
    'investor-markets',
    'investor-proposal-history',
    'investor-contact',
  ], `${viewportName}: main-column section order changed`);

  if (viewportName === 'desktop') {
    assert.ok(state.coverWidth >= 650, `desktop: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 300 && state.coverHeight <= 351, `desktop: cover height ${state.coverHeight}`);
    assert.ok(state.sideWidth >= 320 && state.sideWidth <= 340, `desktop: sidebar width ${state.sideWidth}`);
    assert.ok(state.sideTopDelta <= 3, `desktop: sidebar is not aligned with Hero (${state.sideTopDelta}px)`);
  } else {
    assert.ok(state.coverWidth >= 350, `mobile: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 300 && state.coverHeight <= 341, `mobile: cover height ${state.coverHeight}`);
    assert.ok(state.sideBelowMain, 'mobile: sidebar must stack below the full main column');
  }

  const pageErrors = events.filter((event) => event.startsWith('pageerror:'));
  assert.equal(pageErrors.length, 0, `${viewportName}: page errors: ${pageErrors.join(' | ')}`);
  return { ...state, events };
}

const browser = await chromium.launch({ headless: true });
let assetProbe = null;
try {
  const deployContext = await browser.newContext();
  assetProbe = await waitForDeployedAsset(deployContext.request);
  await deployContext.close();

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    extraHTTPHeaders: { 'cache-control': 'no-cache' },
  });
  const desktopPage = await desktopContext.newPage();
  let desktop;
  try {
    desktop = await inspectInvestor(desktopPage, 'desktop');
    await desktopPage.screenshot({ path: '/tmp/deals68-investor-v10-beta-desktop.png', fullPage: true });
  } catch (error) {
    await desktopPage.screenshot({ path: '/tmp/deals68-investor-v10-beta-failure.png', fullPage: true }).catch(() => undefined);
    const snapshot = error?.snapshot || await pageSnapshot(desktopPage).catch(() => null);
    await writeDiagnostic({ phase: 'desktop', release, base, investorUrl, assetProbe, error: serializeError(error), snapshot });
    throw error;
  } finally {
    await desktopContext.close();
  }

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { 'cache-control': 'no-cache' },
  });
  const mobilePage = await mobileContext.newPage();
  let mobile;
  try {
    mobile = await inspectInvestor(mobilePage, 'mobile');
    await mobilePage.screenshot({ path: '/tmp/deals68-investor-v10-beta-mobile.png', fullPage: true });
  } catch (error) {
    await mobilePage.screenshot({ path: '/tmp/deals68-investor-v10-beta-failure.png', fullPage: true }).catch(() => undefined);
    const snapshot = error?.snapshot || await pageSnapshot(mobilePage).catch(() => null);
    await writeDiagnostic({ phase: 'mobile', release, base, investorUrl, assetProbe, error: serializeError(error), snapshot });
    throw error;
  } finally {
    await mobileContext.close();
  }

  console.log(JSON.stringify({ assetProbe, desktop, mobile }, null, 2));
  console.log('✓ Netlify Beta Investor Profile V11 public layout smoke: PASS');
} catch (error) {
  if (!fs.existsSync(diagnosticPath)) {
    await writeDiagnostic({ phase: 'deploy', release, base, investorUrl, assetUrl, assetProbe, error: serializeError(error), probe: error?.probe || null });
  }
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
