#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, '..');
const repoRoot = process.cwd();

function exists(p) { return fs.existsSync(p); }
function ensureDir(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }
function readRepo(p) { return fs.readFileSync(path.join(repoRoot, p), 'utf8'); }
function writeRepo(p, s) { const full = path.join(repoRoot, p); ensureDir(full); fs.writeFileSync(full, s); console.log('patched', p); }
function copyPatch(rel) {
  const src = path.join(patchRoot, rel);
  const dst = path.join(repoRoot, rel);
  if (!exists(src)) throw new Error(`Patch source not found: ${rel}`);
  ensureDir(dst);
  fs.copyFileSync(src, dst);
  console.log('copied ', rel);
}
function replaceIfIncludes(src, from, to) { return src.includes(from) ? src.replace(from, to) : src; }
function replaceRegexAll(src, regex, to) { return src.replace(regex, to); }

const directFiles = [
  'src/App.tsx',
  'src/components/Header.tsx',
  'src/pages/Home.tsx',
  'src/pages/BusinessDetail.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/pages/StaticPages.tsx',
  'supabase/migrations/20260704_102_final_home_seed_public_fix.sql'
];
for (const rel of directFiles) copyPatch(rel);

// Login: hide Advisor role from visible login tabs while preserving direct route compatibility.
{
  const p = 'src/pages/Login.tsx';
  if (exists(path.join(repoRoot, p))) {
    let s = readRepo(p);
    s = replaceRegexAll(s, /\n\s*\{ key: 'advisor', vi: 'Cố vấn', en: 'Advisor', register: '\/register\/advisor' \},/g, '');
    writeRepo(p, s);
  }
}

// Pricing: hide Advisor from visible role tabs/cards and fix Sepay spelling.
{
  const p = 'src/pages/Pricing.tsx';
  if (exists(path.join(repoRoot, p))) {
    let s = readRepo(p);
    s = replaceIfIncludes(s, "const roleTabs = (['business', 'investor', 'advisor'] as Role[]);", "const roleTabs = (['business', 'investor'] as Role[]);");
    if (!s.includes("planCards.filter((p) => p.key !== 'advisor').map((p) =>")) {
      s = replaceIfIncludes(s, "planCards.map((p) =>", "planCards.filter((p) => p.key !== 'advisor').map((p) =>");
    }
    s = s.replace(/Nhà đầu tư & Cố vấn/g, 'Nhà đầu tư');
    s = s.replace(/Investors & Advisors/g, 'Investors');
    s = s.replace(/Investor\/Advisor/g, 'Investor');
    s = s.replace(/Senpay/g, 'Sepay');
    writeRepo(p, s);
  }
}

// Register: use global header language from App; remove internal VI/EN switch.
{
  const p = 'src/pages/Register.tsx';
  if (exists(path.join(repoRoot, p))) {
    let s = readRepo(p);
    s = replaceIfIncludes(s, 'export default function Register() {', "export default function Register({ lang = 'vi' }: { lang?: 'vi' | 'en' }) {");
    s = replaceRegexAll(s, /\n\s*const \[lang, setLang\] = useState<'vi' \| 'en'>\('vi'\);/g, '');
    s = replaceRegexAll(s, /\n\s*<div style=\{\{ marginTop: 18, textAlign: 'center' \}\}><button onClick=\{\(\) => setLang\(lang === 'vi' \? 'en' : 'vi'\)\}[\s\S]*?<\/div>(?=\s*<\/section>)/g, '');
    writeRepo(p, s);
  }
}

// App: make sure Register receives lang and has localized routes.
{
  const p = 'src/App.tsx';
  let s = readRepo(p);
  s = replaceIfIncludes(s, '<Route path="/register/:role" element={<Register/>}/>', '<Route path="/register/:role" element={<Register lang={lang}/>}/>');
  if (!s.includes('<Route path="/vi/register/:role"')) {
    s = s.replace(
      '<Route path="/en/forgot-password" element={<ForgotPassword lang="en"/>}/>',
      '<Route path="/en/forgot-password" element={<ForgotPassword lang="en"/>}/>\n        <Route path="/vi/register/:role" element={<Register lang="vi"/>}/>\n        <Route path="/en/register/:role" element={<Register lang="en"/>}/>'
    );
  }
  writeRepo(p, s);
}

// Admin: remove unsafe .catch() on Postgrest builders.
{
  const p = 'src/pages/Admin.tsx';
  if (exists(path.join(repoRoot, p))) {
    let s = readRepo(p);
    if (!s.includes('async function safeSelect')) {
      s = s.replace(
        "function publicOf(b: any) { return b.public_snapshot_json && typeof b.public_snapshot_json === 'object' ? b.public_snapshot_json : b; }",
        "function publicOf(b: any) { return b.public_snapshot_json && typeof b.public_snapshot_json === 'object' ? b.public_snapshot_json : b; }\nasync function safeSelect(q: any) { try { return await q; } catch (e: any) { return { data: [], error: e }; } }"
      );
    }
    s = s.replace(/\(supabase\.from\('contact_messages'\)\.select\('\*'\)\.order\('created_at', \{ ascending: false \}\)\.limit\(200\) as any\)\.catch\(\(e: any\) => \(\{ data: \[\], error: e \}\)\)/g, "safeSelect(supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200))");
    s = s.replace(/\(supabase\.from\('partner_leads'\)\.select\('\*'\)\.order\('created_at', \{ ascending: false \}\)\.limit\(200\) as any\)\.catch\(\(e: any\) => \(\{ data: \[\], error: e \}\)\)/g, "safeSelect(supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(200))");
    writeRepo(p, s);
  }
}

console.log('\nAll final bug fixes applied. Now run: npm run build');
