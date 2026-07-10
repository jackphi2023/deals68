#!/usr/bin/env node
import fs from 'node:fs';

const checks = [];
function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const pkg = JSON.parse(read('package.json') || '{}');
const register = read('src/pages/Register.tsx');
const indexCss = read('src/styles/index.css');
const releaseCss = read('src/styles/pages/release-cleanup.css');
const homeCss = read('src/styles/pages/home.css');
const admin = read('src/pages/Admin.tsx');
const proposals = read('src/lib/proposals.ts');
const login = read('src/pages/Login.tsx');
const businessDashboard = read('src/pages/BusinessDashboard.tsx');
const dataLib = read('src/lib/data.ts');
const pendingUploads = read('src/lib/pendingBusinessUploads.ts');
const home = read('src/pages/Home.tsx');
const businessesPage = read('src/pages/Businesses.tsx');
const app = read('src/App.tsx');
const businessDetail = read('src/pages/BusinessDetail.tsx');
const investorDetail = read('src/pages/InvestorDetail.tsx');
const seoConfig = read('src/lib/seoConfig.ts');
const seoRuntime = read('src/lib/seo.ts');
const seoManager = read('src/components/SeoManager.tsx');
const indexHtml = read('index.html');
const netlifyConfig = read('netlify.toml');
const seoEdge = read('netlify/edge-functions/seo.ts');
const robots = read('public/robots.txt');
const sitemap = read('dist/sitemap.xml');

ok('build script exists', !!pkg.scripts?.build, 'package.json scripts.build');
ok('test:e2e scripts exist', !!pkg.scripts?.['test:e2e'] && !!pkg.scripts?.['test:e2e:public'], 'package.json e2e scripts');
ok('release-cleanup imported after page CSS', /pages\/release-cleanup\.css/.test(indexCss), 'src/styles/index.css imports release-cleanup');
ok('home final CSS moved to home.css', /Deals68 Home RC1 final layout/.test(homeCss), 'home.css contains RC1 final layout');
ok('release-cleanup no stacked homepage v12-v14 blocks',
  !/Front-end UI polish v1[234]|Front-end homepage\/register combined final fix|Front-end homepage final clean layout/.test(releaseCss),
  'remove old homepage hotfix markers from release-cleanup.css'
);
ok('register valuation disclaimer removed', !/VALUATION_DISCLAIMER_VI|VALUATION_DISCLAIMER_EN/.test(register), 'Register.tsx should not render/import valuation disclaimer');
ok('business quota override is explicit', /Number\.isFinite\(explicit\)\s*&&\s*explicit\s*>\s*0\s*\?\s*explicit\s*:\s*base/.test(proposals), 'proposalQuotaTotal honors Admin quota_total override');
ok('admin business detail route exists', /BusinessAdminDetail/.test(admin) && /Thanh toán & Quota/.test(admin) && /Hình ảnh & Files/.test(admin), 'Admin business detail tabs');
ok('admin investor pagination exists', /INVESTOR_PAGE_SIZE\s*=\s*30/.test(admin) && /AdminPagination/.test(admin), 'Admin investor pagination 30/page');
ok('admin office country filter exists', /Quốc gia trụ sở/.test(admin) && /investorOfficeCountryFilter/.test(admin), 'Admin investor office country filter');

ok(
  'business signup assets survive OTP',
  /queuePendingBusinessSignupAssets/.test(register)
    && /resumePendingBusinessSignupUploads/.test(login)
    && /indexedDB/.test(pendingUploads),
  'Register queues File/Blob; Login resumes after verifyOtp'
);

ok(
  'signup uploads are idempotent',
  /client_upload_id/.test(dataLib)
    && /onConflict:\s*'client_upload_id'/.test(dataLib)
    && /isDuplicateStorageUploadError/.test(dataLib),
  'storage/database retries must not duplicate files'
);

ok(
  'business dashboard shows pending owner data',
  /businessOwnerView/.test(businessDashboard)
    && /b=\{ownerView\}/.test(businessDashboard)
    && /pending_submitted_at/.test(businessDashboard),
  'owner sees latest submitted values while public keeps approved snapshot'
);

ok(
  'business and admin realtime refresh exist',
  /postgres_changes/.test(businessDashboard)
    && /deals68-admin-business-flow/.test(admin)
    && /visibilitychange/.test(admin),
  'refresh after Admin approval and Business edits'
);

ok(
  'admin approves full pending transaction',
  /approve_business_pending_changes/.test(admin)
    && /BusinessPendingComparison/.test(admin)
    && /expected_pending_submitted_at/.test(admin),
  'Admin sees old/new and uses transactional RPC'
);

ok(
  'homepage businesses use Admin editorial selection',
  /listHomepageBusinesses\(6\)/.test(home)
    && /get_homepage_business_ids/.test(dataLib)
    && /show_on_homepage/.test(admin)
    && /Hiển thị Homepage/.test(admin),
  'Admin selection is independent from plan; RPC fills or randomizes up to 6'
);

ok(
  'business industry links and filters use canonical taxonomy keys',
  /\{ industry: it\.key \}/.test(home)
    && /key:\s*'it_software'/.test(home)
    && /industryKeyFromLabel\(rawIndustry\)/.test(businessesPage)
    && /industryKeyFromLabel\(f\.industry_key \|\| f\.industry\)/.test(businessesPage)
    && /\.eq\('industry_key', industryKey\)/.test(dataLib),
  'Homepage URLs, facet counts and Supabase filters use the same 23-industry keys'
);

ok(
  'SEO title structure configured',
  /Sàn mua bán Doanh nghiệp, M&A, Chuyển nhượng, Huy động vốn, Cho vay/.test(indexHtml)
    && /SEO_SUFFIX_VI/.test(seoConfig)
    && /buildSeoTitle/.test(seoRuntime),
  'Tên trang | Sàn mua bán Doanh nghiệp, M&A, Chuyển nhượng, Huy động vốn, Cho vay'
);

ok(
  'route SEO manager is mounted',
  /<SeoManager\s*\/>/.test(app)
    && /seoForPath/.test(seoManager)
    && /noindex/.test(seoConfig),
  'public routes get metadata; login/dashboard/admin routes are noindex'
);

ok(
  'default social image and favicon configured',
  fs.existsSync('public/assets/deals68-image.jpg')
    && fs.statSync('public/assets/deals68-image.jpg').size > 100000
    && /https:\/\/deals68\.com\/assets\/deals68-image\.jpg/.test(indexHtml)
    && /favicon-16x16\.png/.test(indexHtml)
    && /favicon-32x32\.png/.test(indexHtml)
    && /apple-touch-icon\.png/.test(indexHtml),
  '1200x630 Deals68 image plus favicon links'
);

ok(
  'business detail uses approved hero SEO image',
  /activeHero\?\.url/.test(businessDetail)
    && /business\.hero_image_url/.test(businessDetail)
    && /applySeo/.test(businessDetail)
    && /business_images/.test(seoEdge)
    && /public_visible/.test(seoEdge),
  'client and Netlify Edge prefer Business hero image'
);

ok(
  'all other pages use shared Deals68 image',
  /DEFAULT_SOCIAL_IMAGE/.test(seoManager)
    || /DEFAULT_SOCIAL_IMAGE/.test(seoRuntime),
  'shared image is the fallback for non-Business pages'
);

ok(
  'Netlify server-rendered metadata enabled',
  /function\s*=\s*"seo"/.test(netlifyConfig)
    && /context\.next/.test(seoEdge)
    && /x-deals68-seo/.test(seoEdge)
    && /d68:seo:start/.test(indexHtml),
  'social crawlers receive title, description, canonical and OG tags'
);

ok(
  'robots and sitemap configured',
  /Sitemap:\s*https:\/\/deals68\.com\/sitemap\.xml/.test(robots)
    && /Disallow:\s*\/admin/.test(robots)
    && pkg.scripts?.postbuild === 'node scripts/generate-sitemap.mjs dist'
    && /<urlset/.test(sitemap)
    && /https:\/\/deals68\.com\/businesses/.test(sitemap)
    && /https:\/\/deals68\.com\/investors/.test(sitemap),
  'public URLs are listed; private URLs are blocked/noindex'
);

ok(
  'canonical Open Graph and Twitter metadata complete',
  /rel="canonical"/.test(indexHtml)
    && /property="og:title"/.test(indexHtml)
    && /property="og:description"/.test(indexHtml)
    && /property="og:image"/.test(indexHtml)
    && /name="twitter:card"/.test(indexHtml)
    && /application\/ld\+json/.test(indexHtml),
  'canonical, Open Graph, Twitter Card and JSON-LD'
);

const failed = checks.filter((x) => !x.pass);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
if (failed.length) {
  console.error(`\nRelease QA static check failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`\nRelease QA static check passed: ${checks.length}/${checks.length}`);
