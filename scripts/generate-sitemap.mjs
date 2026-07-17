#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
if (fs.existsSync('scripts/session6-apply.py')) {
  execFileSync('python', ['scripts/session6-apply.py'], { stdio: 'inherit' });
}

const SITE_URL = 'https://deals68.com';
const outputDir = path.resolve(process.argv[2] || 'dist');
const outputFile = path.join(outputDir, 'sitemap.xml');

const staticViPaths = [
  '/',
  '/businesses',
  '/businesses/featured',
  '/businesses/fundraising',
  '/businesses/sale',
  '/businesses/debt',
  '/investors',
  '/investors/active',
  '/investors/funds',
  '/investors/strategic',
  '/pricing',
  '/pricing/business',
  '/pricing/investor',
  '/valuation',
  '/valuation/rules',
  '/about',
  '/how-it-works',
  '/faq',
  '/contact',
  '/partners',
  '/market-partner',
  '/terms',
  '/privacy',
  '/market-intelligence',
  '/localization',
];

const staticEnPaths = [
  '/en',
  '/en/businesses',
  '/en/investors',
  '/en/pricing',
  '/en/valuation',
  '/en/about',
  '/en/terms',
  '/en/privacy',
  '/en/contact',
  '/en/partners',
  '/en/market-partner',
];

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchRows(table, select, filters = '') {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  if (!url || !key) return [];

  const endpoint =
    `${url.replace(/\/+$/, '')}/rest/v1/${table}` +
    `?select=${encodeURIComponent(select)}${filters}`;

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) return [];
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function entry(urlPath, lastmod = '') {
  const location = `${SITE_URL}${urlPath === '/' ? '/' : urlPath}`;
  return `  <url>
    <loc>${xml(location)}</loc>${
      lastmod ? `\n    <lastmod>${xml(lastmod.slice(0, 10))}</lastmod>` : ''
    }
  </url>`;
}

async function main() {
  const urls = new Map();

  for (const item of [...staticViPaths, ...staticEnPaths]) {
    urls.set(item, '');
  }

  const businesses = await fetchRows(
    'businesses',
    'slug,updated_at',
    '&visible=eq.true&status=eq.active&public_snapshot_json=not.is.null&slug=not.is.null',
  ).catch(() => []);

  for (const row of businesses) {
    const slug = String(row.slug || '').trim();
    if (!slug) continue;
    const encoded = encodeURIComponent(slug);
    urls.set(`/businesses/${encoded}`, row.updated_at || '');
    urls.set(`/en/businesses/${encoded}`, row.updated_at || '');
  }

  const investors = await fetchRows(
    'investors',
    'code,updated_at',
    '&visible=eq.true&code=not.is.null',
  ).catch(() => []);

  for (const row of investors) {
    const code = String(row.code || '').trim();
    if (!code) continue;
    const encoded = encodeURIComponent(code);
    urls.set(`/investors/${encoded}`, row.updated_at || '');
    urls.set(`/en/investors/${encoded}`, row.updated_at || '');
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const body = Array.from(urls.entries())
    .map(([urlPath, lastmod]) => entry(urlPath, lastmod))
    .join('\n');

  fs.writeFileSync(
    outputFile,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`,
    'utf8',
  );

  console.log(`Generated ${outputFile} with ${urls.size} URLs.`);
}

main().catch((error) => {
  console.error('Sitemap generation failed:', error);
  process.exit(1);
});
