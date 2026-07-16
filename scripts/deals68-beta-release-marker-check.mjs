#!/usr/bin/env node
import fs from 'node:fs';

const candidates = String(
  process.env.D68_BETA_URLS ||
    'https://beta-reference-deals68.netlify.app,https://beta-reference--deals68.netlify.app',
)
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const release = String(process.env.D68_RELEASE_SHA || Date.now());
const deadline = Date.now() + Number(process.env.D68_DEPLOY_TIMEOUT_MS || 30 * 60_000);
const interval = Number(process.env.D68_DEPLOY_INTERVAL_MS || 20_000);
const diagnosticPath = '/tmp/deals68-beta-release-marker.json';
const requiredTokens = [
  'v14-visibility-independent',
  'd68-home-hero-slider-v2',
  'single-active',
  'investor_register_v14',
  'Nhà đầu tư cá nhân / Thiên thần',
];

function absolute(base, value) {
  return new URL(value, `${base}/`).href;
}

function scriptsFromHtml(html, base) {
  return [...new Set(
    [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => absolute(base, match[1])),
  )];
}

async function text(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'Deals68-Beta-Release-Gate/14',
    },
    signal: AbortSignal.timeout(30_000),
  });
  return { response, body: await response.text() };
}

async function inspect(base) {
  const homepageUrl = `${base}/?release=${encodeURIComponent(release)}&t=${Date.now()}`;
  const { response, body: html } = await text(homepageUrl);
  const scripts = scriptsFromHtml(html, base);
  let bundle = '';
  const assets = [];
  for (const source of scripts) {
    const url = `${source}${source.includes('?') ? '&' : '?'}release=${encodeURIComponent(release)}&t=${Date.now()}`;
    const result = await text(url);
    assets.push({ url: source, status: result.response.status, bytes: result.body.length });
    if (result.response.ok) bundle += result.body;
  }
  const markers = Object.fromEntries(requiredTokens.map((token) => [token, bundle.includes(token)]));
  return {
    base,
    checkedAt: new Date().toISOString(),
    homepageStatus: response.status,
    scripts: scripts.length,
    assets,
    markers,
    ready: response.ok && scripts.length > 0 && Object.values(markers).every(Boolean),
  };
}

let attempt = 0;
let diagnostics = [];
while (Date.now() < deadline) {
  attempt += 1;
  diagnostics = [];
  for (const base of candidates) {
    try {
      diagnostics.push(await inspect(base));
    } catch (error) {
      diagnostics.push({
        base,
        checkedAt: new Date().toISOString(),
        ready: false,
        error: error?.message || String(error),
      });
    }
  }
  const snapshot = { release, attempt, diagnostics };
  fs.writeFileSync(diagnosticPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Beta release gate attempt ${attempt}: ${JSON.stringify(diagnostics)}`);
  const ready = diagnostics.find((item) => item.ready);
  if (ready) {
    console.log(`✓ Exact Netlify Beta deployment is ready: ${ready.base}`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, interval));
}

console.error(`✗ Exact Netlify Beta deployment did not become ready: ${JSON.stringify(diagnostics)}`);
process.exit(1);
