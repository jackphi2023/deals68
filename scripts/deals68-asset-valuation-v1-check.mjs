import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const engineSource = read('src/lib/valuationEngine.ts');
const valuationSource = read('src/pages/Valuation.tsx');
const registerSource = read('src/pages/Register.tsx');
const businessDetailSource = read('src/pages/BusinessDetail.tsx');

const staticChecks = [
  ['v1.2 has P/B multiple and three weights', engineSource.includes('pb?: number') && engineSource.includes('w?: [number, number, number]')],
  ['all 23 industries have v1.2 weights', (engineSource.match(/pb:\s*[0-9.]+,\s*w:\s*\[/g) || []).length === 23],
  ['weights are renormalized for available methods', engineSource.includes('normalizedWeight = method.weight / availableWeightTotal')],
  ['P/B only uses country factor', engineSource.includes('const adjPb = Number(ind.pb') && engineSource.includes('* countryFactor;')],
  ['universal tangible asset floor exists', engineSource.includes('const netTangibleBook = bookEquity !== null ? bookEquity - intangibles : null') && engineSource.includes('Math.max(central, floor)')],
  ['RNAV revaluation exists', engineSource.includes('propertyMarketValue - propertyBookValue')],
  ['surplus assets are added after the floor', engineSource.includes('core + surplusAssetValue')],
  ['existing valuation page inputs are unchanged', valuationSource.includes("'Giá trị tài sản chính'") && valuationSource.includes('assetCurrency: currency')],
  ['existing register inputs and storage are unchanged', registerSource.includes('setKeyAssetValue') && registerSource.includes('setNetDebt') && registerSource.includes('asset_inputs: benchmarkAssetInputs')],
  ['private asset inputs remain absent from public detail', !businessDetailSource.includes('book_equity') && !businessDetailSource.includes('property_market_value')],
];

const failedStatic = staticChecks.filter(([, ok]) => !ok);
for (const [name, ok] of staticChecks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failedStatic.length) {
  console.error(`Valuation v1.2 static QA failed: ${failedStatic.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

const bundlePath = path.join(os.tmpdir(), `deals68-valuation-v1-2-${Date.now()}.cjs`);
execFileSync('./node_modules/.bin/esbuild', [
  'src/lib/valuationEngine.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  `--outfile=${bundlePath}`,
  '--define:import.meta.env.VITE_SUPABASE_URL="https://example.supabase.co"',
  '--define:import.meta.env.VITE_SUPABASE_ANON_KEY="test-anon-key"',
], { stdio: 'inherit' });

const require = createRequire(import.meta.url);
const { valuate, DEFAULT_VALUATION_CONFIG } = require(bundlePath);
const near = (actual, expected, tolerance = 1e-6) => Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * tolerance;
const assert = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
};

const industries = Object.values(DEFAULT_VALUATION_CONFIG.industry);
assert('default config contains 23 industries', industries.length === 23, String(industries.length));
assert('every default industry weight totals 1.00', industries.every((industry) => near(industry.w.reduce((sum, value) => sum + value, 0), 1, 1e-9)));

const fnbAsset = valuate({
  revenueYear: 10_000_000_000,
  ebitdaMargin: 0,
  growthPct: 0,
  industryKey: 'food_beverage',
  countryKey: 'VN',
  currency: 'VND',
  keyAssetValue: 1_000_000_000_000,
  netDebt: 0,
  assetCurrency: 'VND',
});
assert('F&B asset floor lifts midpoint to tangible equity', near(fnbAsset.mid, 1_000_000_000_000), String(fnbAsset.mid));
assert('missing EBITDA renormalizes Revenue and P/B', near(fnbAsset.weightsUsed.revenue, 2 / 3) && near(fnbAsset.weightsUsed.pb, 1 / 3) && fnbAsset.weightsUsed.ebitda === 0, JSON.stringify(fnbAsset.weightsUsed));

const fnbEarnings = valuate({
  revenueYear: 9_000_000_000,
  ebitdaMargin: 17,
  growthPct: 10,
  industryKey: 'food_beverage',
  countryKey: 'VN',
  currency: 'VND',
});
assert('missing book equity renormalizes EBITDA and Revenue', near(fnbEarnings.weightsUsed.ebitda, 0.55 / 0.85) && near(fnbEarnings.weightsUsed.revenue, 0.30 / 0.85) && fnbEarnings.weightsUsed.pb === 0, JSON.stringify(fnbEarnings.weightsUsed));

const revenueOnly = valuate({
  revenueYear: 9_000_000_000,
  ebitdaMargin: 0,
  industryKey: 'food_beverage',
  countryKey: 'VN',
  currency: 'VND',
});
assert('missing EBITDA and assets falls back to Revenue-only', revenueOnly.method === 'revenue_only' && revenueOnly.weightsUsed.revenue === 1);

const realEstate = valuate({
  revenueYear: 12_000_000_000,
  ebitdaMargin: 60,
  growthPct: 8,
  industryKey: 'real_estate',
  countryKey: 'VN',
  currency: 'VND',
  netDebt: 40_000_000_000,
  bookEquity: 70_000_000_000,
  propertyMarketValue: 150_000_000_000,
  propertyBookValue: 90_000_000_000,
  assetCurrency: 'VND',
});
assert('real-estate RNAV floor equals 130 billion', near(realEstate.assetReferenceEquity, 130_000_000_000), String(realEstate.assetReferenceEquity));
assert('real-estate RNAV floor determines midpoint', near(realEstate.mid, 130_000_000_000), String(realEstate.mid));
assert('P/B equity uses book equity times P/B and country only', near(realEstate.eqFromPb, 77_000_000_000), String(realEstate.eqFromPb));

const software = valuate({
  revenueYear: 30_000_000_000,
  ebitdaMargin: 25,
  growthPct: 40,
  industryKey: 'it_software',
  countryKey: 'VN',
  currency: 'VND',
  bookEquity: 15_000_000_000,
  assetCurrency: 'VND',
});
assert('asset-light profitable business is not capped by asset floor', software.central > software.assetReferenceEquity && near(software.mid, software.central), `${software.central}/${software.assetReferenceEquity}`);

const usPb = valuate({
  revenueYear: 30_000_000_000,
  ebitdaMargin: 25,
  growthPct: 50,
  industryKey: 'it_software',
  countryKey: 'US',
  currency: 'VND',
  bookEquity: 15_000_000_000,
  assetCurrency: 'VND',
});
assert('P/B applies country factor but not growth or size', near(usPb.eqFromPb, 15_000_000_000 * 3 * 1.35), String(usPb.eqFromPb));

try { fs.unlinkSync(bundlePath); } catch {}
if (process.exitCode) process.exit(process.exitCode);
console.log('Valuation Spec v1.2 QA passed.');
