#!/usr/bin/env node
import fs from 'node:fs';
import { chromium } from '@playwright/test';

// Runs only after the exact Beta deploy smoke has confirmed the release SHA.
const base = String(process.env.D68_BETA_URL || 'https://beta-reference-deals68.netlify.app').replace(/\/$/, '');
const results = {};

async function inspect(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(`${base}/investors/INV-0603`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    await page.locator('.d68-id-cover').waitFor({ state: 'visible', timeout: 30_000 });
    const state = await page.evaluate(() => {
      const cover = document.querySelector('.d68-id-cover');
      const eyebrow = document.querySelector('.d68-id-cover__eyebrow');
      const title = document.querySelector('.d68-id-cover__content h1');
      const image = cover?.querySelector(':scope > img');
      const content = cover?.querySelector('.d68-id-cover__content');
      const badges = cover?.querySelector('.d68-id-cover__badges');
      const firstIcon = document.querySelector('.d68-id-section-title > span');
      const sectorTag = document.querySelector('.d68-id-sector-tags span');
      const timelineRow = document.querySelector('.d68-id-timeline--proposal > div');
      const timelineBullet = timelineRow?.querySelector('i');
      const rect = (node) => node?.getBoundingClientRect();
      const coverRect = rect(cover);
      const eyebrowRect = rect(eyebrow);
      const imageRect = rect(image);
      const contentRect = rect(content);
      const titleRect = rect(title);
      const badgesRect = rect(badges);
      const rowRect = rect(timelineRow);
      const bulletRect = rect(timelineBullet);
      const iconStyle = firstIcon ? getComputedStyle(firstIcon) : null;
      const sectorStyle = sectorTag ? getComputedStyle(sectorTag) : null;
      const lineStyle = timelineRow ? getComputedStyle(timelineRow, '::before') : null;
      return {
        eyebrowTop: coverRect && eyebrowRect ? eyebrowRect.top - coverRect.top : null,
        titleColor: title ? getComputedStyle(title).color : null,
        imageObjectPosition: image ? getComputedStyle(image).objectPosition : null,
        cover: coverRect ? { x: coverRect.x, y: coverRect.y, width: coverRect.width, height: coverRect.height } : null,
        image: imageRect ? { x: imageRect.x, y: imageRect.y, width: imageRect.width, height: imageRect.height } : null,
        content: contentRect ? { x: contentRect.x, y: contentRect.y, width: contentRect.width, height: contentRect.height } : null,
        title: titleRect ? { x: titleRect.x, y: titleRect.y, width: titleRect.width, height: titleRect.height } : null,
        badges: badgesRect ? { x: badgesRect.x, y: badgesRect.y, width: badgesRect.width, height: badgesRect.height, count: badges?.children.length || 0 } : null,
        iconSvgCount: document.querySelectorAll('.d68-id-section-title > span svg').length,
        iconBorder: iconStyle?.borderTopWidth || null,
        iconColor: iconStyle?.color || null,
        sectorBackground: sectorStyle?.backgroundColor || null,
        sectorColor: sectorStyle?.color || null,
        sectorBorder: sectorStyle?.borderTopWidth || null,
        accessParagraphs: Array.from(document.querySelectorAll('.d68-id-access p')).map((node) => node.textContent?.trim() || ''),
        lineLeft: lineStyle ? Number.parseFloat(lineStyle.left) : null,
        bulletCenter: rowRect && bulletRect ? bulletRect.left + bulletRect.width / 2 - rowRect.left : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    results[name] = state;
    console.log(`${name}: ${JSON.stringify(state)}`);
    await page.screenshot({ path: `/tmp/deals68-investor-detail-v13-diagnostic-${name}.png`, fullPage: true });
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await inspect(browser, 'desktop', { width: 1440, height: 1100 });
  await inspect(browser, 'mobile', { width: 390, height: 844 });
  fs.writeFileSync('/tmp/deals68-investor-detail-v13-diagnostic.json', JSON.stringify(results, null, 2));
  console.log('✓ Investor Detail V13 diagnostic captured');
} finally {
  await browser.close();
}
