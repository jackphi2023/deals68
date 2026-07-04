import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const baseUrl = process.env.D68_BASE_URL || 'http://127.0.0.1:4173';
const outDir = process.env.D68_VISUAL_OUT || 'visual-output/full-flow';
const routes = (process.env.D68_VISUAL_ROUTES || [
  '/', '/businesses', '/investors', '/pricing', '/valuation', '/about', '/terms', '/privacy', '/contact', '/partners',
  '/login?role=business', '/login?role=investor', '/register/business', '/register/investor'
].join(',')).split(',').map(x => x.trim()).filter(Boolean);
const viewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 1000 }
];
const threshold = Number(process.env.D68_VISUAL_THRESHOLD || 0.012);

await fs.mkdir(path.join(outDir, 'current'), { recursive: true });
await fs.mkdir(path.join(outDir, 'baseline'), { recursive: true });
await fs.mkdir(path.join(outDir, 'diff'), { recursive: true });

function safeName(route, vp) { return `${vp.name}-${route.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'home'}.png`; }
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

const browser = await chromium.launch({ headless: true });
const report = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  for (const route of routes) {
    const file = safeName(route, vp);
    const current = path.join(outDir, 'current', file);
    const baseline = path.join(outDir, 'baseline', file);
    const diff = path.join(outDir, 'diff', file);
    await page.goto(baseUrl + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: current, fullPage: true });
    if (!(await exists(baseline))) {
      await fs.copyFile(current, baseline);
      report.push({ route, viewport: vp.name, status: 'baseline-created', ratio: 0 });
      continue;
    }
    const img1 = PNG.sync.read(await fs.readFile(baseline));
    const img2 = PNG.sync.read(await fs.readFile(current));
    const width = Math.min(img1.width, img2.width);
    const height = Math.min(img1.height, img2.height);
    const crop1 = new PNG({ width, height });
    const crop2 = new PNG({ width, height });
    PNG.bitblt(img1, crop1, 0, 0, width, height, 0, 0);
    PNG.bitblt(img2, crop2, 0, 0, width, height, 0, 0);
    const out = new PNG({ width, height });
    const pixels = pixelmatch(crop1.data, crop2.data, out.data, width, height, { threshold: 0.1 });
    PNG.sync.write(out);
    await fs.writeFile(diff, PNG.sync.write(out));
    const ratio = pixels / (width * height);
    report.push({ route, viewport: vp.name, status: ratio > threshold ? 'changed' : 'ok', ratio: Number(ratio.toFixed(5)) });
  }
  await page.close();
}
await browser.close();
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ baseUrl, threshold, generatedAt: new Date().toISOString(), report }, null, 2));
const changed = report.filter(r => r.status === 'changed');
console.table(report);
if (changed.length) {
  console.error(`Visual diff failed: ${changed.length} route/viewport pairs exceeded ${threshold}`);
  process.exit(1);
}
