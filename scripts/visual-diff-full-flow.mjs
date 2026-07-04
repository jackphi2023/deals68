#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromium } from '@playwright/test';

const baseUrl = process.env.D68_BASE_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('visual-output/full-flow');
const routes = (process.env.D68_VISUAL_ROUTES || [
  '/', '/vi', '/en',
  '/businesses', '/vi/businesses', '/en/businesses',
  '/investors', '/vi/investors', '/en/investors',
  '/pricing', '/vi/pricing', '/en/pricing',
  '/valuation', '/vi/valuation', '/en/valuation',
  '/about', '/vi/about', '/en/about',
  '/terms', '/privacy', '/contact', '/partners',
  '/login?role=business', '/login?role=investor',
  '/register/business', '/register/investor'
].join(',')).split(',').map(s => s.trim()).filter(Boolean);
const viewports = [
  { name: 'desktop', width: 1440, height: 1200 },
  { name: 'mobile', width: 390, height: 1200 }
];

function safeName(route) {
  return route.replace(/^\//, 'root-').replace(/[/?&=:#]+/g, '_').replace(/_+$/,'') || 'root';
}
function ensure(p) { fs.mkdirSync(p, { recursive: true }); }
function compare(basePath, currentPath, diffPath) {
  if (!fs.existsSync(basePath)) return { baseline: false, diffPixels: 0, ratio: 0 };
  const a = PNG.sync.read(fs.readFileSync(basePath));
  const b = PNG.sync.read(fs.readFileSync(currentPath));
  if (a.width !== b.width || a.height !== b.height) return { baseline: true, sizeMismatch: true, diffPixels: -1, ratio: 1 };
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return { baseline: true, diffPixels, ratio: diffPixels / (a.width * a.height) };
}

ensure(path.join(outDir, 'current'));
ensure(path.join(outDir, 'baseline'));
ensure(path.join(outDir, 'diff'));
const browser = await chromium.launch({ headless: true });
const report = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  for (const route of routes) {
    const name = `${vp.name}-${safeName(route)}.png`;
    const url = baseUrl + route;
    const currentPath = path.join(outDir, 'current', name);
    const baselinePath = path.join(outDir, 'baseline', name);
    const diffPath = path.join(outDir, 'diff', name);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: currentPath, fullPage: true });
      if (!fs.existsSync(baselinePath)) fs.copyFileSync(currentPath, baselinePath);
      report.push({ route, viewport: vp.name, url, ...compare(baselinePath, currentPath, diffPath) });
    } catch (e) {
      report.push({ route, viewport: vp.name, url, error: e.message });
    }
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.table(report.map(r => ({ route: r.route, viewport: r.viewport, ratio: r.ratio, error: r.error || '' })));
