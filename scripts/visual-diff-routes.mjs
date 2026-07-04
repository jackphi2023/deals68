#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const targetBase = process.env.D68_TARGET_URL || 'http://127.0.0.1:4173';
const referenceBase = process.env.D68_REFERENCE_URL || 'https://glittering-unicorn-afbf10.netlify.app';
const outRoot = process.env.D68_VISUAL_OUT || 'visual-diff';
const maxDiffRatio = Number(process.env.D68_VISUAL_THRESHOLD || 0.03);
const routes = (process.env.D68_VISUAL_ROUTES || '/,/businesses')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);
const viewports = [
  { name: '1440', width: 1440, height: 1600 },
  { name: '768', width: 768, height: 1600 },
  { name: '375', width: 375, height: 1600 },
];

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
function routeName(route) { return route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-'); }
function readPng(buffer) { return PNG.sync.read(buffer); }
function cropToSameSize(a, b) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (src) => { const dst = new PNG({ width, height }); PNG.bitblt(src, dst, 0, 0, width, height, 0, 0); return dst; };
  return [crop(a), crop(b), width, height];
}
async function shoot(page, url, viewport, file) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  return fs.readFile(file);
}
async function compareRoute(page, route) {
  const safe = routeName(route);
  const outDir = path.join(outRoot, safe);
  await ensureDir(outDir);
  const results = [];
  for (const viewport of viewports) {
    const refPath = path.join(outDir, `reference-${viewport.name}.png`);
    const targetPath = path.join(outDir, `target-${viewport.name}.png`);
    const diffPath = path.join(outDir, `diff-${viewport.name}.png`);
    const refBuffer = await shoot(page, `${referenceBase}${route}`, viewport, refPath);
    const targetBuffer = await shoot(page, `${targetBase}${route}`, viewport, targetPath);
    const [ref, target, width, height] = cropToSameSize(readPng(refBuffer), readPng(targetBuffer));
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(ref.data, target.data, diff.data, width, height, { threshold: 0.12 });
    await fs.writeFile(diffPath, PNG.sync.write(diff));
    const diffRatio = diffPixels / (width * height);
    results.push({ route, viewport: viewport.name, diffPixels, comparedPixels: width * height, diffRatio, passed: diffRatio <= maxDiffRatio });
  }
  await fs.writeFile(path.join(outDir, 'visual-report.json'), JSON.stringify({ route, targetBase, referenceBase, threshold: maxDiffRatio, results }, null, 2));
  return results;
}

async function main() {
  await ensureDir(outRoot);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const allResults = [];
  try {
    for (const route of routes) allResults.push(...await compareRoute(page, route));
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(outRoot, 'visual-report.json'), JSON.stringify({ routes, targetBase, referenceBase, threshold: maxDiffRatio, results: allResults }, null, 2));
  console.table(allResults.map(x => ({ route: x.route, viewport: x.viewport, diff: `${(x.diffRatio * 100).toFixed(2)}%`, passed: x.passed })));
  const failed = allResults.filter(x => !x.passed);
  if (failed.length) {
    console.error(`Visual diff failed: ${failed.map(x => `${x.route}@${x.viewport}`).join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
