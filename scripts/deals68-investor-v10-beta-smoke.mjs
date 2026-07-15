#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const configuredBases = String(
  process.env.D68_BETA_URLS || process.env.D68_BETA_URL || '',
)
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const baseCandidates = configuredBases.length
  ? [...new Set(configuredBases)]
  : [
      'https://beta-reference-deals68.netlify.app',
      'https://beta-reference--deals68.netlify.app',
    ];

const release = String(process.env.D68_RELEASE_SHA || Date.now());
const deployDeadline = Date.now() + 15 * 60 * 1000;
const diagnosticPath = '/tmp/deals68-investor-v11-beta-diagnostic.json';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deployedBundleTokens = [
  'v11-two-column',
  'investor-public-hero',
  'd68-id-criteria-table',
  'd68-id-market-tags',
];

let base = baseCandidates[0];
let investorUrl = `${base}/investors/INV-0603?v11=${encodeURIComponent(release)}`;
let assetUrl = `${base}/assets/investor-cover-default.svg?v11=${encodeURIComponent(release)}`;

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
    readyState: document.readyState,
    rootChildren: document.querySelector('#root')?.childElementCount || 0,
    bodyText: (document.body?.innerText || '').slice(0, 3200),
    bodyHtml: (document.body?.innerHTML || '').slice(0, 7000),
    layoutMarker: document.querySelector('[data-investor-layout]')?.getAttribute('data-investor-layout') || '',
    coverCount: document.querySelectorAll('.d68-id-cover').length,
    errorState: document.querySelector('.d68-id-state h1')?.textContent?.trim() || '',
    h1: document.querySelector('.d68-id-cover h1')?.textContent?.trim() || '',
  })).catch(() => null);
  return { dom, events: events.slice(-60) };
}

async function writeDiagnostic(payload) {
  fs.writeFileSync(diagnosticPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.error('BETA_SMOKE_DIAGNOSTIC');
  console.error(JSON.stringify(payload, null, 2));
}

function candidateUrls(candidateBase) {
  return {
    base: candidateBase,
    investorUrl: `${candidateBase}/investors/INV-0603?v11=${encodeURIComponent(release)}`,
    assetUrl: `${candidateBase}/assets/investor-cover-default.svg?v11=${encodeURIComponent(release)}`,
  };
}

function absoluteAssetUrl(value, candidateBase) {
  return new URL(value, `${candidateBase}/`).toString();
}

function scriptSources(html, candidateBase) {
  const sources = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    if (match[1]) sources.push(absoluteAssetUrl(match[1], candidateBase));
  }
  return [...new Set(sources)];
}

async function probeCandidate(request, candidateBase) {
  const urls = candidateUrls(candidateBase);
  const headers = {
    'cache-control': 'no-cache, no-store, max-age=0',
    pragma: 'no-cache',
  };

  const [assetResponse, htmlResponse] = await Promise.all([
    request.get(urls.assetUrl, { headers, timeout: 30_000 }),
    request.get(urls.investorUrl, { headers, timeout: 30_000 }),
  ]);

  const [assetText, html] = await Promise.all([
    assetResponse.text(),
    htmlResponse.text(),
  ]);

  const sources = scriptSources(html, candidateBase);
  const bundleChecks = [];
  const foundTokens = new Set();

  for (const source of sources) {
    const response = await request.get(
      `${source}${source.includes('?') ? '&' : '?'}v11=${encodeURIComponent(release)}`,
      { headers, timeout: 45_000 },
    );
    const text = await response.text();
    const matched = deployedBundleTokens.filter((token) => text.includes(token));
    matched.forEach((token) => foundTokens.add(token));
    bundleChecks.push({
      source,
      status: response.status(),
      length: text.length,
      matched,
    });
  }

  const result = {
    ...urls,
    asset: {
      status: assetResponse.status(),
      contentType: assetResponse.headers()['content-type'] || '',
      length: assetText.length,
      hasSvg: /^<svg[\s>]/.test(assetText),
      hasWidth: /width="1600"/.test(assetText),
      hasHeight: /height="560"/.test(assetText),
      hasArtwork: /data:image\/webp;base64,/.test(assetText),
    },
    html: {
      status: htmlResponse.status(),
      contentType: htmlResponse.headers()['content-type'] || '',
      length: html.length,
      hasHtml: /<html[\s>]/i.test(html),
      hasRoot: /id=["']root["']/i.test(html),
      scriptCount: sources.length,
    },
    foundTokens: [...foundTokens],
    bundleChecks,
  };

  result.ready = Boolean(
    assetResponse.ok() &&
      result.asset.hasSvg &&
      result.asset.hasWidth &&
      result.asset.hasHeight &&
      result.asset.hasArtwork &&
      htmlResponse.ok() &&
      result.html.hasHtml &&
      result.html.hasRoot &&
      sources.length > 0 &&
      deployedBundleTokens.every((token) => foundTokens.has(token)),
  );

  return result;
}

async function waitForDeployedV11(request) {
  let attempt = 0;
  let last = null;

  while (Date.now() < deployDeadline) {
    attempt += 1;
    const probes = [];

    for (const candidateBase of baseCandidates) {
      try {
        const result = await probeCandidate(request, candidateBase);
        probes.push(result);
        console.log(`Deploy probe ${attempt} ${candidateBase}: ${JSON.stringify(result)}`);
        if (result.ready) return { attempt, candidates: probes, selected: result };
      } catch (error) {
        const result = {
          base: candidateBase,
          ready: false,
          error: serializeError(error),
        };
        probes.push(result);
        console.log(`Deploy probe ${attempt} ${candidateBase}: ${error?.message || error}`);
      }
    }

    last = { attempt, candidates: probes };
    await delay(10_000);
  }

  const error = new Error(
    'No configured Netlify Beta candidate served the exact V11 Investor bundle and cover within 15 minutes.',
  );
  error.probe = last;
  throw error;
}

async function navigateToInvestor(page, viewportName, events) {
  let lastError = null;
  let lastSnapshot = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      events.push(`navigation-attempt:${attempt}`);
      const response = await page.goto(investorUrl, {
        waitUntil: 'commit',
        timeout: 60_000,
      });
      assert.ok(response, `${viewportName}: navigation returned no response`);
      assert.ok(response.status() < 400, `${viewportName}: HTTP ${response.status()}`);

      await page.waitForFunction(() => (
        document.readyState !== 'loading' &&
        (
          Boolean(document.querySelector('.d68-id-cover img')) ||
          Boolean(document.querySelector('.d68-id-state h1'))
        )
      ), null, { timeout: 60_000 });

      return response;
    } catch (error) {
      lastError = error;
      lastSnapshot = await pageSnapshot(page, events).catch(() => null);
      events.push(`navigation-failed:${attempt}:${error?.message || error}`);
      if (attempt < 3) {
        await page.goto('about:blank', { waitUntil: 'commit', timeout: 10_000 }).catch(() => undefined);
        await delay(5_000);
      }
    }
  }

  throw Object.assign(
    new Error(`${viewportName}: Investor navigation failed after 3 attempts: ${lastError?.message || lastError}`),
    { snapshot: lastSnapshot },
  );
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

  await navigateToInvestor(page, viewportName, events);

  const errorState = await page.locator('.d68-id-state h1').count();
  if (errorState) {
    const snapshot = await pageSnapshot(page, events);
    throw Object.assign(new Error(`${viewportName}: Investor page rendered an error state`), { snapshot });
  }

  await page.locator('.d68-id-cover img').waitFor({ state: 'visible', timeout: 20_000 });
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
    const title = document.querySelector('.d68-id-cover h1');
    const badges = document.querySelector('.d68-id-cover__badges');
    const countryBadge = document.querySelector('.d68-id-cover__badges span:nth-child(2)');
    const layout = document.querySelector('.d68-id-layout');
    const coverRect = cover?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const sideRect = side?.getBoundingClientRect();
    const badgesRect = badges?.getBoundingClientRect();
    const introText = intro?.textContent?.trim() || '';
    const bodyText = document.body?.innerText || '';
    const occurrenceCount = introText ? bodyText.split(introText).length - 1 : 0;
    const orderedSections = Array.from(main?.querySelectorAll(':scope > [data-testid]') || [])
      .map((node) => node.getAttribute('data-testid'));
    return {
      layoutMarker: document.querySelector('[data-investor-layout]')?.getAttribute('data-investor-layout') || '',
      rootChildren: document.querySelector('#root')?.childElementCount || 0,
      h1: title?.textContent?.trim() || '',
      eyebrow: document.querySelector('.d68-id-cover__eyebrow')?.textContent?.trim() || '',
      heroParagraphCount: document.querySelectorAll('.d68-id-cover p').length,
      badgeCount: document.querySelectorAll('.d68-id-cover__badges span').length,
      activeBadge: document.querySelector('.d68-id-cover__badges .active')?.textContent?.trim() || '',
      countryBadge: countryBadge?.textContent?.trim() || '',
      coverWidth: coverRect?.width || 0,
      coverHeight: coverRect?.height || 0,
      mainWidth: mainRect?.width || 0,
      sideWidth: sideRect?.width || 0,
      sideTopDelta: coverRect && sideRect ? Math.abs(coverRect.top - sideRect.top) : 9999,
      sideBelowMain: mainRect && sideRect ? sideRect.top >= mainRect.bottom - 2 : false,
      titleClipped: title instanceof HTMLElement ? title.scrollHeight > title.clientHeight + 2 : true,
      badgesClipped: coverRect && badgesRect ? badgesRect.bottom > coverRect.bottom + 2 : true,
      gridTemplateColumns: layout ? getComputedStyle(layout).gridTemplateColumns : '',
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

  assert.equal(state.layoutMarker, 'v11-two-column', `${viewportName}: wrong deployed layout marker`);
  assert.ok(state.rootChildren > 0, `${viewportName}: React root is empty`);
  assert.ok(state.h1.length > 8, `${viewportName}: Investor title is missing`);
  assert.match(state.eyebrow, /INV-0603/i, `${viewportName}: Investor code is missing from Hero`);
  assert.equal(state.heroParagraphCount, 0, `${viewportName}: Hero contains duplicated description paragraph`);
  assert.equal(state.descriptionOccurrences, 1, `${viewportName}: Introduction description occurrence count ${state.descriptionOccurrences}`);
  assert.ok(state.badgeCount >= 3, `${viewportName}: Cover badges are incomplete`);
  assert.match(state.activeBadge, /hoạt động|active/i, `${viewportName}: Active badge is missing`);
  assert.ok(state.countryBadge && !state.countryBadge.includes('📍'), `${viewportName}: country badge still uses a location pin`);
  assert.equal(state.titleClipped, false, `${viewportName}: Hero title is clipped`);
  assert.equal(state.badgesClipped, false, `${viewportName}: Hero badges are clipped`);
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
    assert.notEqual(state.gridTemplateColumns, 'none', 'desktop: grid columns are missing');
  } else if (viewportName === 'tablet') {
    assert.ok(state.coverWidth >= 700, `tablet: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 300 && state.coverHeight <= 341, `tablet: cover height ${state.coverHeight}`);
    assert.ok(state.sideBelowMain, 'tablet: sidebar must stack below the full main column');
  } else {
    assert.ok(state.coverWidth >= 350, `mobile: cover width ${state.coverWidth}`);
    assert.ok(state.coverHeight >= 300 && state.coverHeight <= 341, `mobile: cover height ${state.coverHeight}`);
    assert.ok(state.sideBelowMain, 'mobile: sidebar must stack below the full main column');
  }

  const pageErrors = events.filter((event) => event.startsWith('pageerror:'));
  assert.equal(pageErrors.length, 0, `${viewportName}: page errors: ${pageErrors.join(' | ')}`);
  return { ...state, events };
}

async function runViewport(browser, viewportName, viewport, screenshotPath) {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: { 'cache-control': 'no-cache, no-store, max-age=0' },
  });
  const page = await context.newPage();
  try {
    const result = await inspectInvestor(page, viewportName);
    if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
    return result;
  } catch (error) {
    await page.screenshot({ path: '/tmp/deals68-investor-v11-beta-failure.png', fullPage: true }).catch(() => undefined);
    const snapshot = error?.snapshot || await pageSnapshot(page).catch(() => null);
    await writeDiagnostic({ phase: viewportName, release, baseCandidates, base, investorUrl, deployProbe, error: serializeError(error), snapshot });
    throw error;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
let deployProbe = null;
try {
  const deployContext = await browser.newContext();
  deployProbe = await waitForDeployedV11(deployContext.request);
  await deployContext.close();

  base = deployProbe.selected.base;
  investorUrl = deployProbe.selected.investorUrl;
  assetUrl = deployProbe.selected.assetUrl;
  console.log(`Selected Netlify Beta candidate: ${base}`);

  const desktop = await runViewport(
    browser,
    'desktop',
    { width: 1440, height: 1100 },
    '/tmp/deals68-investor-v11-beta-desktop.png',
  );
  const tablet = await runViewport(
    browser,
    'tablet',
    { width: 820, height: 1180 },
    '/tmp/deals68-investor-v11-beta-tablet.png',
  );
  const mobile = await runViewport(
    browser,
    'mobile',
    { width: 390, height: 844 },
    '/tmp/deals68-investor-v11-beta-mobile.png',
  );

  console.log(JSON.stringify({ deployProbe, selectedBase: base, desktop, tablet, mobile }, null, 2));
  console.log('✓ Netlify Beta Investor Profile V11 desktop/tablet/mobile smoke: PASS');
} catch (error) {
  if (!fs.existsSync(diagnosticPath)) {
    await writeDiagnostic({
      phase: 'deploy',
      release,
      baseCandidates,
      base,
      investorUrl,
      assetUrl,
      deployProbe,
      error: serializeError(error),
      probe: error?.probe || null,
    });
  }
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
