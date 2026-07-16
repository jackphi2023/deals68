#!/usr/bin/env node
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const base = String(process.env.D68_BETA_URL || 'https://deploy-preview-23--deals68.netlify.app').replace(/\/$/, '');
const results = {};

async function goto(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
}

async function inspectHome(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await goto(page, '/');
    const image = page.locator('.d68-home-hero-slider-v2--ready .d68-home-hero-media__image');
    await image.waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => {
      const node = document.querySelector('.d68-home-hero-slider-v2--ready .d68-home-hero-media__image');
      return node instanceof HTMLImageElement && node.complete && node.naturalWidth > 100 && node.naturalHeight > 100;
    }, { timeout: 30_000 });

    const state = await page.evaluate(() => {
      const hero = document.querySelector('.d68-home-hero');
      const slider = document.querySelector('.d68-home-hero-slider-v2--ready');
      const media = slider?.querySelector('.d68-home-hero-media');
      const imageNode = slider?.querySelector('.d68-home-hero-media__image');
      const stats = document.querySelector('.d68-home-hero-stats');
      const metric = document.querySelector('.d68-home-hero-stats > div:nth-child(3) b');
      if (!(hero instanceof HTMLElement) || !(metric instanceof HTMLElement)) throw new Error('Hero or metric missing');
      metric.textContent = '300.000 tỷ ₫';
      const heroRect = hero.getBoundingClientRect();
      const statsRect = stats?.getBoundingClientRect();
      const metricRect = metric.getBoundingClientRect();
      const metricStyle = getComputedStyle(metric);
      const statsStyle = stats ? getComputedStyle(stats) : null;
      const imageStyle = imageNode ? getComputedStyle(imageNode) : null;
      return {
        layout: slider?.getAttribute('data-hero-layout') || '',
        slides: slider?.querySelectorAll('.d68-hero-slide').length || 0,
        variant: media?.getAttribute('data-hero-variant') || '',
        imageSource: imageNode instanceof HTMLImageElement ? imageNode.currentSrc || imageNode.src : '',
        naturalWidth: imageNode instanceof HTMLImageElement ? imageNode.naturalWidth : 0,
        naturalHeight: imageNode instanceof HTMLImageElement ? imageNode.naturalHeight : 0,
        imageObjectFit: imageStyle?.objectFit || '',
        hero: { width: heroRect.width, height: heroRect.height, ratioHeightToWidth: heroRect.height / heroRect.width },
        stats: statsRect ? { width: statsRect.width, height: statsRect.height, display: statsStyle?.display || '', gridTemplateColumns: statsStyle?.gridTemplateColumns || '' } : null,
        metric: {
          text: metric.textContent,
          width: metricRect.width,
          height: metricRect.height,
          clientWidth: metric.clientWidth,
          scrollWidth: metric.scrollWidth,
          lineHeight: Number.parseFloat(metricStyle.lineHeight),
          whiteSpace: metricStyle.whiteSpace,
          fontSize: metricStyle.fontSize,
        },
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    results[`home-${width}`] = state;
    console.log(`home-${width}: ${JSON.stringify(state)}`);
  } finally {
    await page.close();
  }
}

async function inspectInvestorHover(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await goto(page, '/investors/INV-0603');
    const title = page.locator('.d68-id-cover__content h1');
    await title.waitFor({ state: 'visible', timeout: 30_000 });
    const before = await title.evaluate((node) => getComputedStyle(node).color);
    await title.hover();
    await page.waitForTimeout(250);
    const after = await title.evaluate((node) => getComputedStyle(node).color);
    results.investorTitleHover = { before, after, unchanged: before === after };
    console.log(`investor-title-hover: ${JSON.stringify(results.investorTitleHover)}`);
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 390, 430, 768]) await inspectHome(browser, width);
  await inspectInvestorHover(browser);
  fs.writeFileSync('/tmp/deals68-home-v13-diagnostic.json', JSON.stringify(results, null, 2));
  console.log('✓ Homepage V13 diagnostic captured');
} finally {
  await browser.close();
}
