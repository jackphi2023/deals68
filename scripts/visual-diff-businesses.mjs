#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const targetBase = process.env.D68_TARGET_URL || 'http://127.0.0.1:4173';
const referenceBase = process.env.D68_REFERENCE_URL || 'https://glittering-unicorn-afbf10.netlify.app';
const outDir = process.env.D68_VISUAL_OUT || 'visual-diff/businesses';
const thresholds = { maxDiffRatio: Number(process.env.D68_VISUAL_THRESHOLD || 0.03) };
const viewports = [
  { name: '1440', width: 1440, height: 1600 },
  { name: '768', width: 768, height: 1600 },
  { name: '375', width: 375, height: 1600 },
];

async function ensureDir(dir) { await fs.mkdir(dir, { recursive: true }); }
function readPng(buffer) { return PNG.sync.read(buffer); }
function cropToSameSize(a, b) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  function crop(src) {
    const dst = new PNG({ width, height });
    PNG.bitblt(src, dst, 0, 0, width, height, 0, 0);
    return dst;
  }
  return [crop(a), crop(b), width, height];
}

async function shoot(page, url, viewport, file) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  return await fs.readFile(file);
}

async function main() {
  await ensureDir(outDir);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  try {
    for (const viewport of viewports) {
      const refPath = path.join(outDir, `reference-${viewport.name}.png`);
      const targetPath = path.join(outDir, `target-${viewport.name}.png`);
      const diffPath = path.join(outDir, `diff-${viewport.name}.png`);
      const refBuffer = await shoot(page, `${referenceBase}/businesses`, viewport, refPath);
      const targetBuffer = await shoot(page, `${targetBase}/businesses`, viewport, targetPath);
      const [ref, target, width, height] = cropToSameSize(readPng(refBuffer), readPng(targetBuffer));
      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(ref.data, target.data, diff.data, width, height, { threshold: 0.12 });
      PNG.sync.write(diff);
      await fs.writeFile(diffPath, PNG.sync.write(diff));
      const ratio = diffPixels / (width * height);
      results.push({ viewport: viewport.name, diffPixels, comparedPixels: width * height, diffRatio: ratio, passed: ratio <= thresholds.maxDiffRatio });
    }
  } finally {
    await browser.close();
  }
  const report = { route: '/businesses', targetBase, referenceBase, threshold: thresholds.maxDiffRatio, results };
  await fs.writeFile(path.join(outDir, 'visual-report.json'), JSON.stringify(report, null, 2));
  const failed = results.filter(x => !x.passed);
  console.table(results.map(x => ({ viewport: x.viewport, diff: `${(x.diffRatio * 100).toFixed(2)}%`, passed: x.passed })));
  if (failed.length) {
    console.error(`Visual diff failed for /businesses: ${failed.map(x => x.viewport).join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
