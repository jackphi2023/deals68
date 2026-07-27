#!/usr/bin/env node
import fs from 'node:fs';

const appPath = 'src/App.tsx';
let source = fs.readFileSync(appPath, 'utf8');

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  "const loadMarketPartnerDashboard = () => import('./pages/MarketPartnerDashboard');",
  "const loadMarketPartnerDashboard = () => import('./pages/MarketPartnerDashboard');\nconst loadMarketPartnerDemoDashboard = () => import('./pages/MarketPartnerDemoDashboard');",
  'demo loader',
);
replaceOnce(
  'const MarketPartnerDashboard = lazy(loadMarketPartnerDashboard);',
  'const MarketPartnerDashboard = lazy(loadMarketPartnerDashboard);\nconst MarketPartnerDemoDashboard = lazy(loadMarketPartnerDemoDashboard);',
  'demo lazy component',
);
replaceOnce(
  "if (path === '/market-partner/login') return [loadMarketPartnerDashboard];",
  "if (path === '/market-partner/login') return [loadMarketPartnerDashboard, loadMarketPartnerDemoDashboard];",
  'demo prefetch',
);
replaceOnce(
  "const privatePrefix = ['/dashboard', '/admin', '/checkout', '/payment', '/data-room', '/messages', '/notifications', '/support', '/market-partner/dashboard'];",
  "const privatePrefix = ['/dashboard', '/admin', '/checkout', '/payment', '/data-room', '/messages', '/notifications', '/support', '/market-partner/dashboard', '/market-partner/demo'];",
  'demo language-memory exclusion',
);
replaceOnce(
  '        <Route path="/market-partner/dashboard" element={<MarketPartnerGate><MarketPartnerDashboard/></MarketPartnerGate>}/>\n        <Route path="/market-partner" element={<MarketPartner lang="vi"/>}/>',
  '        <Route path="/market-partner/dashboard" element={<MarketPartnerGate><MarketPartnerDashboard/></MarketPartnerGate>}/>\n        <Route path="/market-partner/demo" element={<MarketPartnerDemoDashboard/>}/>\n        <Route path="/market-partner" element={<MarketPartner lang="vi"/>}/>',
  'Vietnamese demo route',
);
replaceOnce(
  '        <Route path="/en/market-partner/dashboard" element={<MarketPartnerGate><MarketPartnerDashboard/></MarketPartnerGate>}/>\n        <Route path="/en/market-partner" element={<MarketPartner lang="en"/>}/>',
  '        <Route path="/en/market-partner/dashboard" element={<MarketPartnerGate><MarketPartnerDashboard/></MarketPartnerGate>}/>\n        <Route path="/en/market-partner/demo" element={<MarketPartnerDemoDashboard/>}/>\n        <Route path="/en/market-partner" element={<MarketPartner lang="en"/>}/>',
  'English-path demo route',
);

for (const token of [
  "import('./pages/MarketPartnerDemoDashboard')",
  'path="/market-partner/demo"',
  'path="/en/market-partner/demo"',
]) {
  if (!source.includes(token)) throw new Error(`App route token missing after patch: ${token}`);
}
fs.writeFileSync(appPath, source);

const dataPath = 'src/lib/marketPartnerDemo.ts';
let dataSource = fs.readFileSync(dataPath, 'utf8');
const oldType = "export type MarketPartnerDemoDashboardData = MarketPartnerDashboardData & {\n  transactions: DemoPartnerTransaction[];";
const newType = "export type MarketPartnerDemoDashboardData = Omit<MarketPartnerDashboardData, 'commissions'> & {\n  transactions: DemoPartnerTransaction[];";
const typeCount = dataSource.split(oldType).length - 1;
if (typeCount !== 1) throw new Error(`demo commission type: expected one match, found ${typeCount}`);
dataSource = dataSource.replace(oldType, newType);
fs.writeFileSync(dataPath, dataSource);

console.log('✓ Market Partner static demo routes and extended commission type applied.');
