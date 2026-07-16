#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allowed = new Set([
  'src/pages/Home.tsx',
  'src/components/HomepageHeroSlider.tsx',
  'src/components/HeroBannerMedia.tsx',
  'src/pages/InvestorDetail.tsx',
  'src/styles/pages/home.css',
  'src/styles/pages/investor-detail.css',
  'src/styles/pages/investors.css',
  'public/assets/investor-cover-default.svg',
  'scripts/scope-check-building-ui-match-beta-v1.mjs',
]);

const forbidden = [
  /^src\/App\.tsx$/,
  /^src\/pages\/(InvestorDetailV10|InvestorProfileV10|AdminInvestorsV10|AdminBannersV10|InvestorRegisterV14|Register|InvestorDashboard|Admin)\.tsx$/,
  /^src\/lib\/(supabase|proposals)\.ts$/,
  /^src\/styles\/index\.css$/,
  /^src\/styles\/pages\/release-cleanup\.css$/,
  /^package(?:-lock)?\.json$/,
  /^netlify\.toml$/,
  /^\.github\/workflows\//,
  /^supabase\/migrations\//,
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function resolveBase() {
  const candidates = [
    process.env.SCOPE_BASE_REF,
    'origin/building',
    'building',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      git(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {
      // Try the next known building ref.
    }
  }

  throw new Error('Could not resolve building or origin/building for scope comparison.');
}

function changedFiles(base) {
  const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]);
  return output ? output.split('\n').map((value) => value.trim()).filter(Boolean) : [];
}

function assertSourceInvariants() {
  const home = readFileSync('src/pages/Home.tsx', 'utf8');
  const hero = readFileSync('src/components/HomepageHeroSlider.tsx', 'utf8');
  const investor = readFileSync('src/pages/InvestorDetail.tsx', 'utf8');

  const failures = [];

  if (/document\.createElement\(['"]style['"]\)/.test(home) || /PUBLIC_INVESTOR_UI_CSS/.test(home)) {
    failures.push('Home.tsx still injects runtime CSS.');
  }
  if (!home.includes('HomepageHeroSlider')) {
    failures.push('Home.tsx does not use HomepageHeroSlider.');
  }
  if (!hero.includes('mobile_image_url') || !hero.includes("setSource(desktopUrl)")) {
    failures.push('Homepage hero mobile-to-desktop fallback is missing.');
  }
  if (!hero.includes('d68-home-hero-slider-v2--empty')) {
    failures.push('Homepage hero empty fallback state is missing.');
  }
  if (/InvestorDetailV10|InvestorPublicHeroV10|InvestorPublicSectionsV10/.test(investor)) {
    failures.push('InvestorDetail.tsx imports or references V10 architecture.');
  }

  for (const required of [
    'getInvestorByCode',
    'getMyBusiness',
    'get_investor_contact_if_connected',
    'get_public_investor_proposal_history',
    'sendBusinessProposalToInvestor',
    'applySeo',
  ]) {
    if (!investor.includes(required)) failures.push(`InvestorDetail.tsx lost required logic: ${required}`);
  }

  if (failures.length) {
    throw new Error(failures.join('\n'));
  }
}

try {
  const base = resolveBase();
  const files = changedFiles(base);
  const errors = [];

  for (const file of files) {
    if (!allowed.has(file)) errors.push(`Outside allowed scope: ${file}`);
    if (forbidden.some((pattern) => pattern.test(file))) errors.push(`Forbidden file changed: ${file}`);
  }

  if (errors.length) {
    console.error('Scope check failed:\n' + errors.map((item) => `- ${item}`).join('\n'));
    process.exit(1);
  }

  assertSourceInvariants();

  console.log(`Scope check passed against ${base}.`);
  console.log(files.length ? files.map((file) => `- ${file}`).join('\n') : '- No changed files detected');
} catch (error) {
  console.error(`Scope check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
