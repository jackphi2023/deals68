from pathlib import Path
import re

ENGINE = Path('src/lib/valuationEngine.ts')
QA = Path('scripts/deals68-asset-valuation-v1-check.mjs')

engine = ENGINE.read_text(encoding='utf-8')

types_block = r'''export type ValuationConfig = {
  version: number;
  params: {
    version?: number;
    w_ebitda: number;
    w_revenue: number;
    ebitda_margin_floor: number;
    spread_low: number;
    spread_high: number;
    usd_vnd: number;
    growth_cap: number;
  };
  industry: Record<string, {
    ebitda: number;
    revenue: number;
    pb?: number;
    w?: [number, number, number];
    valuation_mode?: AssetValuationMode;
    w_asset?: number;
  }>;
  country: Record<string, number>;
  growth_curve: { max: number | null; factor: number }[];
  size_bands: { max_usd: number | null; factor: number }[];
};

export type ValuationInput = {
  revenueYear?: number;
  revenueMonth?: number;
  ebitdaMargin?: number;
  growthPct?: number;
  industryKey?: string;
  industry?: string;
  countryKey?: string;
  currency?: Currency;
  offerStakePct?: number;
  offerAmount?: number;
  keyAssetValue?: number;
  netDebt?: number;
  assetCurrency?: Currency;
  bookEquity?: number;
  intangibles?: number;
  propertyMarketValue?: number;
  propertyBookValue?: number;
  surplusAssetValue?: number;
};

export type ValuationResult = {
  low: number;
  mid: number;
  high: number;
  method: 'blend' | 'revenue_only';
  valuationMode: AssetValuationMode;
  assetMethodConfidence: AssetMethodConfidence | null;
  assetInputApplied: boolean;
  assetInputStoredOnly: boolean;
  currency: Currency;
  assetCurrency: Currency;
  revenueYear: number;
  ebitda: number;
  adjE: number;
  adjR: number;
  evFromEbitda: number;
  evFromRevenue: number;
  evOperating: number;
  equityOperating: number;
  eqFromEbitda: number | null;
  eqFromRevenue: number;
  eqFromPb: number | null;
  central: number;
  floorUsed: number | null;
  weightsUsed: { ebitda: number; revenue: number; pb: number };
  bookEquity: number | null;
  intangibles: number;
  surplusAssetValue: number;
  keyAssetValueInput: number | null;
  keyAssetValue: number | null;
  netDebtInput: number | null;
  netDebt: number;
  netDebtProvided: boolean;
  assetReferenceEquity: number | null;
  assetWeight: number | null;
  assetValueWarning: boolean;
  netDebtExceedsAsset: boolean;
  self?: number;
  verdict?: 'low_of' | 'in_range' | 'above';
  pctAbove?: number;
  configVersion: number;
  industryKey: string;
  countryFactor: number;
  growthFactor: number;
  sizeFactor: number;
};'''

engine, count = re.subn(
    r'export type ValuationConfig = \{.*?\n\};\n\nexport type ValuationInput = \{.*?\n\};\n\nexport type ValuationResult = \{.*?\n\};',
    types_block,
    engine,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Could not replace valuation type block: {count}')

config_block = r'''export const DEFAULT_VALUATION_CONFIG: ValuationConfig = {
  version: 2,
  params: {
    version: 2,
    w_ebitda: 0.70,
    w_revenue: 0.30,
    ebitda_margin_floor: 5,
    spread_low: 0.15,
    spread_high: 0.15,
    usd_vnd: 25000,
    growth_cap: 50
  },
  industry: {
    agriculture: { ebitda: 5.5, revenue: 0.90, pb: 1.1, w: [0.40, 0.20, 0.40] },
    automobile: { ebitda: 5.5, revenue: 0.65, pb: 1.2, w: [0.50, 0.30, 0.20] },
    beauty_personal_care: { ebitda: 7.5, revenue: 1.20, pb: 1.8, w: [0.60, 0.25, 0.15] },
    construction_materials: { ebitda: 5.0, revenue: 0.60, pb: 1.1, w: [0.45, 0.35, 0.20] },
    chemicals: { ebitda: 6.5, revenue: 1.10, pb: 1.4, w: [0.50, 0.25, 0.25] },
    education_training: { ebitda: 8.0, revenue: 1.50, pb: 2.0, w: [0.60, 0.25, 0.15] },
    energy_utilities: { ebitda: 7.0, revenue: 1.30, pb: 1.3, w: [0.45, 0.20, 0.35] },
    entertainment_leisure: { ebitda: 6.5, revenue: 1.20, pb: 1.5, w: [0.55, 0.25, 0.20] },
    finance: { ebitda: 8.0, revenue: 2.00, pb: 1.3, w: [0.30, 0.20, 0.50] },
    food_beverage: { ebitda: 5.5, revenue: 0.80, pb: 1.5, w: [0.55, 0.30, 0.15] },
    healthcare: { ebitda: 9.0, revenue: 2.00, pb: 2.2, w: [0.55, 0.25, 0.20] },
    hotels_resorts: { ebitda: 8.0, revenue: 2.20, pb: 1.3, w: [0.35, 0.20, 0.45] },
    it_software: { ebitda: 11.0, revenue: 2.80, pb: 3.0, w: [0.55, 0.35, 0.10] },
    manufacturing: { ebitda: 6.0, revenue: 0.85, pb: 1.2, w: [0.45, 0.20, 0.35] },
    media_advertising: { ebitda: 7.0, revenue: 1.30, pb: 1.8, w: [0.60, 0.30, 0.10] },
    real_estate: { ebitda: 9.0, revenue: 3.00, pb: 1.1, w: [0.20, 0.15, 0.65] },
    retail: { ebitda: 5.5, revenue: 0.60, pb: 1.3, w: [0.50, 0.30, 0.20] },
    services: { ebitda: 7.0, revenue: 1.20, pb: 1.6, w: [0.60, 0.25, 0.15] },
    transportation_logistics: { ebitda: 6.0, revenue: 0.85, pb: 1.3, w: [0.45, 0.25, 0.30] },
    travel: { ebitda: 6.5, revenue: 1.20, pb: 1.6, w: [0.55, 0.30, 0.15] },
    ecommerce: { ebitda: 8.5, revenue: 1.40, pb: 2.2, w: [0.45, 0.45, 0.10] },
    textiles_apparel: { ebitda: 5.0, revenue: 0.70, pb: 1.1, w: [0.45, 0.30, 0.25] },
    seafood_export: { ebitda: 5.0, revenue: 0.70, pb: 1.1, w: [0.45, 0.30, 0.25] }
  },
  country: { VN: 1.00, SG: 1.25, US: 1.35, KR: 1.15, JP: 1.20, HK: 1.20, CN: 1.05, TH: 1.00, CA: 1.25, AU: 1.25, DE: 1.20, CZ: 1.05, OTHER: 1.00 },
  growth_curve: [
    { max: 0, factor: 0.85 },
    { max: 5, factor: 0.95 },
    { max: 15, factor: 1.05 },
    { max: 30, factor: 1.15 },
    { max: 50, factor: 1.25 },
    { max: null, factor: 1.35 }
  ],
  size_bands: [
    { max_usd: 400000, factor: 0.80 },
    { max_usd: 2000000, factor: 0.90 },
    { max_usd: 10000000, factor: 1.00 },
    { max_usd: 50000000, factor: 1.10 },
    { max_usd: null, factor: 1.20 }
  ]
};'''

engine, count = re.subn(
    r'export const DEFAULT_VALUATION_CONFIG: ValuationConfig = \{.*?\n\};\n\nfunction factorFromCurve',
    config_block + '\n\nfunction factorFromCurve',
    engine,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Could not replace valuation default config: {count}')

valuate_block = r'''export function valuate(input: ValuationInput, cfg: ValuationConfig = DEFAULT_VALUATION_CONFIG): ValuationResult | null {
  const p = cfg.params;
  const industryKey = input.industryKey || industryKeyFromLabel(input.industry) || '';
  const ind = cfg.industry[industryKey];
  const revenueYear = Number(input.revenueYear || 0) || (Number(input.revenueMonth || 0) * 12);
  if (!ind || !Number.isFinite(revenueYear) || revenueYear <= 0) return null;

  const currency: Currency = String(input.currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND';
  const assetCurrency: Currency = String(input.assetCurrency || currency).toUpperCase() === 'USD' ? 'USD' : 'VND';
  const countryKey = String(input.countryKey || 'VN').toUpperCase();
  const margin = Number(input.ebitdaMargin ?? 0) || 0;
  const growth = Math.min(Number(input.growthPct ?? 0) || 0, Number(p.growth_cap || 50));
  const ebitda = revenueYear * margin / 100;
  const revUSD = currency === 'USD' ? revenueYear : revenueYear / Number(p.usd_vnd || 25000);
  const countryFactor = Number(cfg.country[countryKey] ?? cfg.country.OTHER ?? cfg.country.VN ?? 1);
  const growthFactor = factorFromCurve(growth, cfg.growth_curve);
  const sizeFactor = factorFromCurve(revUSD, cfg.size_bands.map((band) => ({ max: band.max_usd, factor: band.factor })));
  const earningsFactor = countryFactor * growthFactor * sizeFactor;
  const adjE = Number(ind.ebitda || 0) * earningsFactor;
  const adjR = Number(ind.revenue || 0) * earningsFactor;
  const adjPb = Number(ind.pb ?? DEFAULT_VALUATION_CONFIG.industry[industryKey]?.pb ?? 1) * countryFactor;
  const evFromEbitda = ebitda * adjE;
  const evFromRevenue = revenueYear * adjR;
  const useEbitda = margin >= Number(p.ebitda_margin_floor || 5) && ebitda > 0;

  const optionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const convertAmount = (value: number, from: Currency, to: Currency) => {
    if (from === to) return value;
    const usdVnd = Number(p.usd_vnd || 25000);
    return from === 'USD' ? value * usdVnd : value / usdVnd;
  };
  const convertedOptional = (value: unknown) => {
    const parsed = optionalNumber(value);
    return parsed === null ? null : convertAmount(parsed, assetCurrency, currency);
  };

  const keyAssetValueInputRaw = optionalNumber(input.keyAssetValue);
  const keyAssetValueInput = keyAssetValueInputRaw !== null && keyAssetValueInputRaw > 0
    ? keyAssetValueInputRaw
    : null;
  const netDebtInput = optionalNumber(input.netDebt);
  const netDebtProvided = netDebtInput !== null;
  const keyAssetValue = keyAssetValueInput !== null
    ? convertAmount(keyAssetValueInput, assetCurrency, currency)
    : null;
  const netDebt = netDebtProvided
    ? convertAmount(netDebtInput || 0, assetCurrency, currency)
    : 0;

  const explicitBookEquity = convertedOptional(input.bookEquity);
  const bookEquity = explicitBookEquity !== null
    ? explicitBookEquity
    : keyAssetValue !== null
      ? Math.max(keyAssetValue - netDebt, 0)
      : null;
  const intangibles = convertedOptional(input.intangibles) ?? 0;
  const propertyMarketValue = convertedOptional(input.propertyMarketValue);
  const propertyBookValue = convertedOptional(input.propertyBookValue);
  const surplusAssetValue = convertedOptional(input.surplusAssetValue) ?? 0;

  const defaultWeights = DEFAULT_VALUATION_CONFIG.industry[industryKey]?.w || [0.55, 0.30, 0.15];
  const configuredWeights = Array.isArray(ind.w) && ind.w.length === 3
    ? ind.w
    : [
        Number((ind as any).w_ebitda ?? defaultWeights[0]),
        Number((ind as any).w_revenue ?? defaultWeights[1]),
        Number((ind as any).w_pb ?? defaultWeights[2]),
      ];
  const nonNegativeWeights = configuredWeights.map((weight, index) => {
    const parsed = Number(weight);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number(defaultWeights[index] || 0);
  }) as [number, number, number];
  const configuredWeightTotal = nonNegativeWeights.reduce((sum, weight) => sum + weight, 0);
  const baseWeights: [number, number, number] = configuredWeightTotal > 0
    ? nonNegativeWeights.map((weight) => weight / configuredWeightTotal) as [number, number, number]
    : defaultWeights;

  const eqFromEbitda = useEbitda ? evFromEbitda - netDebt : null;
  const eqFromRevenue = evFromRevenue - netDebt;
  const eqFromPb = bookEquity !== null ? bookEquity * adjPb : null;
  const methods: { key: 'ebitda' | 'revenue' | 'pb'; weight: number; equity: number }[] = [];
  if (eqFromEbitda !== null) methods.push({ key: 'ebitda', weight: baseWeights[0], equity: eqFromEbitda });
  methods.push({ key: 'revenue', weight: baseWeights[1], equity: eqFromRevenue });
  if (eqFromPb !== null) methods.push({ key: 'pb', weight: baseWeights[2], equity: eqFromPb });

  let availableWeightTotal = methods.reduce((sum, method) => sum + method.weight, 0);
  if (availableWeightTotal <= 0) {
    methods.splice(0, methods.length, { key: 'revenue', weight: 1, equity: eqFromRevenue });
    availableWeightTotal = 1;
  }

  const weightsUsed = { ebitda: 0, revenue: 0, pb: 0 };
  let central = 0;
  for (const method of methods) {
    const normalizedWeight = method.weight / availableWeightTotal;
    weightsUsed[method.key] = normalizedWeight;
    central += normalizedWeight * method.equity;
  }

  const netTangibleBook = bookEquity !== null ? bookEquity - intangibles : null;
  let floor: number | null = null;
  if (netTangibleBook !== null && propertyMarketValue !== null && propertyBookValue !== null) {
    floor = netTangibleBook + (propertyMarketValue - propertyBookValue);
  } else if (netTangibleBook !== null) {
    floor = netTangibleBook;
  }
  if (floor !== null && !Number.isFinite(floor)) floor = null;

  const core = floor !== null ? Math.max(central, floor) : central;
  const mid = Math.max(core + surplusAssetValue, 0);
  const low = mid * (1 - Number(p.spread_low || 0.15));
  const high = mid * (1 + Number(p.spread_high || 0.15));
  const floorUsed = floor !== null && floor > central ? floor : null;

  const earningsWeightTotal = (useEbitda ? baseWeights[0] : 0) + baseWeights[1];
  const evOperating = earningsWeightTotal > 0
    ? ((useEbitda ? baseWeights[0] * evFromEbitda : 0) + baseWeights[1] * evFromRevenue) / earningsWeightTotal
    : evFromRevenue;
  const equityOperating = central;
  const assetReferenceEquity = floor;
  const assetInputApplied = bookEquity !== null;
  const assetInputStoredOnly = false;
  const valuationMode: AssetValuationMode = floor !== null ? 'asset_floor' : 'earnings';
  const assetWeight = weightsUsed.pb > 0 ? weightsUsed.pb : null;
  const operatingEquityForWarning = Math.max(central, 0);
  const assetValueWarning = floor !== null && operatingEquityForWarning > 0 && floor > operatingEquityForWarning * 2;
  const netDebtExceedsAsset = keyAssetValue !== null && netDebt > keyAssetValue;

  let self: number | undefined;
  let verdict: ValuationResult['verdict'];
  let pctAbove: number | undefined;
  const stake = Number(input.offerStakePct || 0);
  const offer = Number(input.offerAmount || 0);
  if (stake > 0 && offer > 0) {
    self = offer / (stake / 100);
    if (self < low) verdict = 'low_of';
    else if (self <= high) verdict = 'in_range';
    else {
      verdict = 'above';
      pctAbove = Math.round((self - high) / Math.max(high, 1) * 100);
    }
  }

  return {
    low,
    mid,
    high,
    method: methods.length === 1 && methods[0].key === 'revenue' ? 'revenue_only' : 'blend',
    valuationMode,
    assetMethodConfidence: explicitBookEquity !== null ? 'medium' : keyAssetValueInput !== null ? 'low' : null,
    assetInputApplied,
    assetInputStoredOnly,
    currency,
    assetCurrency,
    revenueYear,
    ebitda,
    adjE,
    adjR,
    evFromEbitda,
    evFromRevenue,
    evOperating,
    equityOperating,
    eqFromEbitda,
    eqFromRevenue,
    eqFromPb,
    central,
    floorUsed,
    weightsUsed,
    bookEquity,
    intangibles,
    surplusAssetValue,
    keyAssetValueInput,
    keyAssetValue,
    netDebtInput,
    netDebt,
    netDebtProvided,
    assetReferenceEquity,
    assetWeight,
    assetValueWarning,
    netDebtExceedsAsset,
    self,
    verdict,
    pctAbove,
    configVersion: Math.max(2, Number(cfg.version || 2)),
    industryKey,
    countryFactor,
    growthFactor,
    sizeFactor,
  };
}'''

engine, count = re.subn(
    r'export function valuate\(input: ValuationInput, cfg: ValuationConfig = DEFAULT_VALUATION_CONFIG\): ValuationResult \| null \{.*?\n\}\n\nexport function valuationInputFromBusiness',
    valuate_block + '\n\nexport function valuationInputFromBusiness',
    engine,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Could not replace valuate function: {count}')

input_from_business = r'''export function valuationInputFromBusiness(b: any): ValuationInput {
  const financialInput = b?.financial_input && typeof b.financial_input === 'object' ? b.financial_input : {};
  const benchmark = financialInput.benchmark && typeof financialInput.benchmark === 'object'
    ? financialInput.benchmark
    : {};
  const assetInputs = benchmark.asset_inputs && typeof benchmark.asset_inputs === 'object'
    ? benchmark.asset_inputs
    : financialInput.asset_inputs && typeof financialInput.asset_inputs === 'object'
      ? financialInput.asset_inputs
      : {};
  const optionalNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  return {
    revenueYear: Number(b?.revenue_2025 || b?.revenue_year || 0),
    revenueMonth: Number(b?.revenue_month || financialInput.revenue_month || 0),
    ebitdaMargin: Number(b?.ebitda_margin || 0),
    growthPct: Number(b?.growth_pct ?? financialInput.growth_pct ?? 0),
    industryKey: b?.industry_key || industryKeyFromLabel(b?.industry),
    industry: b?.industry,
    countryKey: b?.country_iso2 || 'VN',
    currency: String(b?.revenue_currency || 'VND').toUpperCase() === 'USD' ? 'USD' : 'VND',
    offerStakePct: Number(b?.offer_stake_pct ?? b?.stake_pct ?? 0),
    offerAmount: Number(b?.offer_amount ?? b?.ask_amount ?? 0),
    keyAssetValue: optionalNumber(assetInputs.key_asset_value ?? assetInputs.keyAssetValue),
    netDebt: optionalNumber(assetInputs.net_debt ?? assetInputs.netDebt),
    bookEquity: optionalNumber(assetInputs.book_equity ?? assetInputs.bookEquity),
    intangibles: optionalNumber(assetInputs.intangibles),
    propertyMarketValue: optionalNumber(assetInputs.property_market_value ?? assetInputs.propertyMarketValue),
    propertyBookValue: optionalNumber(assetInputs.property_book_value ?? assetInputs.propertyBookValue),
    surplusAssetValue: optionalNumber(assetInputs.surplus_asset_value ?? assetInputs.surplusAssetValue),
    assetCurrency: String(assetInputs.currency || b?.revenue_currency || 'VND').toUpperCase() === 'USD'
      ? 'USD'
      : 'VND',
  };
}'''

engine, count = re.subn(
    r'export function valuationInputFromBusiness\(b: any\): ValuationInput \{.*?\n\}\n\nexport function valuationMethodLabel',
    input_from_business + '\n\nexport function valuationMethodLabel',
    engine,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'Could not replace valuationInputFromBusiness: {count}')

ENGINE.write_text(engine, encoding='utf-8')

qa = r'''import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

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

const bundlePath = path.join(os.tmpdir(), `deals68-valuation-v1-2-${Date.now()}.mjs`);
execFileSync('./node_modules/.bin/esbuild', [
  'src/lib/valuationEngine.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  `--outfile=${bundlePath}`,
  '--define:import.meta.env.VITE_SUPABASE_URL="https://example.supabase.co"',
  '--define:import.meta.env.VITE_SUPABASE_ANON_KEY="test-anon-key"',
], { stdio: 'inherit' });

const { valuate, DEFAULT_VALUATION_CONFIG } = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
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
'''
QA.write_text(qa, encoding='utf-8')
print('Applied Deals68 Valuation Spec v1.2 formula update.')
