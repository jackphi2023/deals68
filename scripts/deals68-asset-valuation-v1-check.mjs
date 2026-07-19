import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const engine = read('src/lib/valuationEngine.ts');
const valuation = read('src/pages/Valuation.tsx');
const register = read('src/pages/Register.tsx');
const dashboard = read('src/pages/BusinessDashboard.tsx');
const businessDetail = read('src/pages/BusinessDetail.tsx');

const checks = [
  ['engine keeps earnings fallback', engine.includes("valuationMode: AssetValuationMode") && engine.includes("configuredMode: AssetValuationMode")],
  ['real estate uses 75% asset blend', engine.includes("valuation_mode: 'asset_blend', w_asset: 0.75")],
  ['hotel uses 50% asset blend', engine.includes("valuation_mode: 'asset_blend', w_asset: 0.50")],
  ['manufacturing uses asset floor', engine.includes("manufacturing: { ebitda: 6.0, revenue: 0.85, valuation_mode: 'asset_floor'")],
  ['agriculture uses asset floor', engine.includes("agriculture: { ebitda: 5.5, revenue: 0.90, valuation_mode: 'asset_floor'")],
  ['asset floor is greater-of, not additive', engine.includes('Math.max(equityOperating, assetReferenceEquity, 0)') && !engine.includes('evOperating + keyAssetValue')],
  ['asset reference cannot be negative', engine.includes('Math.max(keyAssetValue - netDebt, 0)')],
  ['public valuation has key asset input', valuation.includes("'Giá trị tài sản chính'") && valuation.includes('setKeyAssetValue')],
  ['public valuation shares currency state', valuation.includes('assetCurrency: currency')],
  ['register has both optional private inputs', register.includes('setKeyAssetValue') && register.includes('setNetDebt')],
  ['register stores benchmark asset_inputs', register.includes('asset_inputs: benchmarkAssetInputs') && register.includes('key_asset_value') && register.includes('net_debt')],
  ['dashboard keeps private asset inputs out of overview UI', dashboard.includes('valuationInputFromBusiness') && !dashboard.includes("'Giá trị tài sản chính'") && !dashboard.includes("'Giá trị nợ ròng'") && !dashboard.includes('name="key_asset_value"') && !dashboard.includes('name="net_debt"')],
  ['asset and debt are not added to public Business detail', !businessDetail.includes('key_asset_value') && !businessDetail.includes('net_debt')],
  ['net debt missing warning is present', engine.includes('Chưa nhập nợ ròng, hệ thống tạm tính nợ ròng = 0.')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Asset valuation QA failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Asset valuation QA passed: ${checks.length}/${checks.length}`);
