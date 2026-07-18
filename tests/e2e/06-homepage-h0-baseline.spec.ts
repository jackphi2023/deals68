import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.join(process.cwd(), 'docs/qa/homepage-h0-baseline');

function svgData(width: number, height: number, title: string, from: string, to: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="${width * 0.8}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.18}" fill="rgba(255,255,255,.18)"/>
      <circle cx="${width * 0.72}" cy="${height * 0.82}" r="${Math.min(width, height) * 0.25}" fill="rgba(242,181,29,.22)"/>
      <text x="${width * 0.56}" y="${height * 0.52}" font-family="Arial" font-size="${Math.max(28, width * 0.035)}" font-weight="700" fill="rgba(255,255,255,.8)">${title}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const heroDesktop = svgData(1600, 600, 'H0 HERO DESKTOP', '#0F2A4A', '#1BADEA');
const heroMobile = svgData(900, 1200, 'H0 MOBILE', '#0F2A4A', '#1596CC');
const promotion = svgData(1600, 550, 'H0 PROMOTION', '#1BADEA', '#F2B51D');

const businesses = Array.from({ length: 6 }, (_, index) => ({
  id: `h0-business-${index + 1}`,
  public_code: `D68-H0-${index + 1}`,
  slug: `h0-business-${index + 1}`,
  title_vi: `Doanh nghiệp H0 ${index + 1} · Hồ sơ kiểm thử giao diện`,
  title_en: `H0 Business ${index + 1} · Visual baseline profile`,
  description_vi: 'Dữ liệu fixture chỉ dùng để chụp baseline cục bộ.',
  description_en: 'Fixture data used only for the local visual baseline.',
  country_iso2: 'VN',
  city: index % 2 ? 'Hà Nội' : 'TP. Hồ Chí Minh',
  city_key: index % 2 ? 'VN-HN' : 'VN-HCM',
  industry: index % 2 ? 'Y tế & Chăm sóc sức khỏe' : 'CNTT & Phần mềm',
  industry_key: index % 2 ? 'healthcare' : 'it_software',
  deal_type: index % 2 ? 'fundraising' : 'sale',
  plan: index < 3 ? 'featured' : 'basic',
  revenue_2025: 12_000_000_000 + index * 3_000_000_000,
  revenue_currency: 'VND',
  ask_amount: 4_000_000_000 + index * 1_000_000_000,
  ask_currency: 'VND',
  stake_pct: 20,
  visible: true,
  status: 'active',
  public_snapshot_json: { approved: true },
  image_url: svgData(640, 360, `BUSINESS ${index + 1}`, '#E7F6FD', '#FEF3D3'),
  hero_image_url: null,
  business_images: [],
  business_files: [],
  created_at: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
  updated_at: `2026-07-${String(index + 10).padStart(2, '0')}T00:00:00Z`,
}));

const investors = Array.from({ length: 4 }, (_, index) => ({
  id: `h0-investor-${index + 1}`,
  code: `INV-H0-${String(index + 1).padStart(2, '0')}`,
  type: index % 2 ? 'corporate' : 'individual',
  title_vi: `Nhà đầu tư H0 ${index + 1} · Quan tâm doanh nghiệp tăng trưởng`,
  title_en: `H0 Investor ${index + 1} · Growth opportunity focus`,
  desc_vi: 'Dữ liệu fixture H0.',
  desc_en: 'H0 fixture data.',
  country_iso2: index % 2 ? 'SG' : 'VN',
  country: index % 2 ? 'Singapore' : 'Việt Nam',
  industries: index % 2
    ? ['healthcare', 'education_training', 'food_beverage']
    : ['it_software', 'finance', 'manufacturing'],
  deal_types: ['equity', 'acquisition'],
  stage: 'growth',
  ticket_min: 250000,
  ticket_max: 3_000_000 + index * 1_000_000,
  criteria: {
    targetCountries: index % 2 ? ['VN', 'SG', 'US'] : ['VN', 'JP', 'KR'],
    dealTypes: ['equity', 'acquisition'],
    stages: ['growth', 'profitable_sme'],
  },
  visible: true,
  verified: true,
  admin_priority: false,
  activity_level: 'active',
  status: 'active',
  created_at: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
  updated_at: `2026-07-${String(index + 10).padStart(2, '0')}T00:00:00Z`,
}));

const banners = {
  home_hero: [{
    id: 'h0-hero-1', placement: 'home_hero', title: 'H0 deterministic Hero',
    image_url: heroDesktop, mobile_image_url: heroMobile,
    focal_x: 50, focal_y: 50, mobile_focal_x: 50, mobile_focal_y: 50,
    link_url: null, sort_order: 1, lang_mode: 'both', starts_at: null,
    ends_at: null, active: true, created_at: '2026-07-18T00:00:00Z',
    updated_at: '2026-07-18T00:00:00Z',
  }],
  home_promotion: [{
    id: 'h0-promotion-1', placement: 'home_promotion', title: 'H0 deterministic Promotion',
    image_url: promotion, mobile_image_url: null, focal_x: 50, focal_y: 50,
    link_url: null, sort_order: 1, lang_mode: 'both', starts_at: null,
    ends_at: null, active: true, created_at: '2026-07-18T00:00:00Z',
    updated_at: '2026-07-18T00:00:00Z',
  }],
};

function json(route: Route, value: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...headers },
    body: JSON.stringify(value),
  });
}

async function installDeterministicApi(page: Page) {
  await page.addInitScript(() => {
    let state = 0x68;
    Math.random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  });

  await page.route('https://h0-baseline.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,HEAD,POST,OPTIONS',
      } });
    }
    if (url.pathname.includes('/auth/v1/')) return json(route, { user: null });
    if (url.pathname.endsWith('/rest/v1/rpc/get_homepage_business_ids')) return json(route, []);
    if (url.pathname.endsWith('/rest/v1/site_banners')) {
      const placement = String(url.searchParams.get('placement') || '').replace(/^eq\./, '');
      return json(route, banners[placement as keyof typeof banners] || []);
    }
    if (url.pathname.endsWith('/rest/v1/public_businesses_safe')) {
      if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: {
        'access-control-allow-origin': '*', 'content-range': '0-5/6',
      } });
      return json(route, businesses, { 'content-range': '0-5/6' });
    }
    if (url.pathname.endsWith('/rest/v1/public_investors_safe')) {
      if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: {
        'access-control-allow-origin': '*', 'content-range': '0-3/4',
      } });
      return json(route, investors, { 'content-range': '0-3/4' });
    }
    return json(route, []);
  });
}

async function waitForHomepage(page: Page, route = '/') {
  await page.goto(route, { waitUntil: 'networkidle' });
  await expect(page.locator('.d68-home-page')).toBeVisible();
  await expect(page.locator('.d68-home-investor-card')).toHaveCount(4);
  await expect(page.locator('.d68-home-business-card')).toHaveCount(6);
  await expect(page.locator('.d68-promo-banner')).toBeVisible();
  await expect(page.locator('.d68-hero-media__image')).toBeVisible();
  await page.waitForTimeout(300);
}

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '375x812', width: 375, height: 812 },
];

test('capture Homepage H0 source-equivalent baseline', async ({ page }) => {
  fs.mkdirSync(outputDir, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installDeterministicApi(page);
  const captures: Array<Record<string, string | number>> = [];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await waitForHomepage(page);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    const fileName = `home-vi-${viewport.name}.png`;
    await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true, animations: 'disabled' });
    captures.push({ lang: 'vi', ...viewport, file: fileName });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForHomepage(page, '/en');
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.screenshot({ path: path.join(outputDir, 'home-en-1440x900.png'), fullPage: true, animations: 'disabled' });
  captures.push({ lang: 'en', width: 1440, height: 900, file: 'home-en-1440x900.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForHomepage(page);
  const computed = await page.evaluate(() => {
    const pageNode = document.querySelector<HTMLElement>('.d68-home-page');
    const hero = document.querySelector<HTMLElement>('.d68-home-hero');
    const heroImage = document.querySelector<HTMLElement>('.d68-hero-media__image');
    const promotionNode = document.querySelector<HTMLElement>('.d68-promo-banner');
    const directChildren = pageNode
      ? Array.from(pageNode.children).filter((node) => node.matches('.d68-home-hero, .d68-home-block')) as HTMLElement[]
      : [];
    let previousBottom: number | null = null;
    const sections = directChildren.map((node, index) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = rect.bottom + window.scrollY;
      const result = {
        index, tag: node.tagName.toLowerCase(), className: node.className,
        marginTop: style.marginTop, marginBottom: style.marginBottom,
        paddingTop: style.paddingTop, paddingBottom: style.paddingBottom,
        backgroundColor: style.backgroundColor, top: Math.round(top),
        bottom: Math.round(bottom), height: Math.round(rect.height),
        visualGapFromPrevious: previousBottom === null ? null : Math.round(top - previousBottom),
      };
      previousBottom = bottom;
      return result;
    });
    const containers = Array.from(document.querySelectorAll<HTMLElement>('.d68-home-container')).map((node) => {
      const rect = node.getBoundingClientRect();
      return { className: node.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
    });
    const pageStyle = pageNode ? getComputedStyle(pageNode) : null;
    const heroStyle = hero ? getComputedStyle(hero) : null;
    const heroImageStyle = heroImage ? getComputedStyle(heroImage) : null;
    const promotionStyle = promotionNode ? getComputedStyle(promotionNode) : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      page: pageStyle ? { backgroundColor: pageStyle.backgroundColor, display: pageStyle.display, flexDirection: pageStyle.flexDirection, rowGap: pageStyle.rowGap, paddingBottom: pageStyle.paddingBottom } : null,
      hero: heroStyle ? { width: heroStyle.width, height: heroStyle.height, minHeight: heroStyle.minHeight, aspectRatio: heroStyle.aspectRatio } : null,
      heroImage: heroImageStyle ? { objectFit: heroImageStyle.objectFit, objectPosition: heroImageStyle.objectPosition } : null,
      promotion: promotionStyle ? { paddingTop: promotionStyle.paddingTop, paddingBottom: promotionStyle.paddingBottom, marginTop: promotionStyle.marginTop, marginBottom: promotionStyle.marginBottom } : null,
      sections,
      containers,
    };
  });

  fs.writeFileSync(path.join(outputDir, 'computed-styles.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), captures, computed }, null, 2)}\n`, 'utf8');
  expect(computed.page?.backgroundColor).toBe('rgb(247, 250, 252)');
  expect(computed.page?.rowGap).toBe('80px');
  expect(computed.heroImage?.objectFit).toBe('cover');
  expect(computed.promotion?.paddingTop).toBe('50px');
  expect(computed.promotion?.paddingBottom).toBe('50px');
});
