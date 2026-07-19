import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const baselineSourceCommit = '816b319e85ff5839367a92428e2e65ce0424a5ea';
const outputDir = path.join(root, 'docs/qa/homepage-h0-baseline');

const expectedBlobs = {
  'src/pages/Home.tsx': 'b1904a6e7736051b911eedb4ac0a0b44b158989d',
  'src/components/HeroBannerMedia.tsx': 'cadb67721c0fabef302da901b13b4aa845e36bd1',
  'src/components/SiteBanners.tsx': '0557fc29e99211803adeda84083ffca9f6b68580',
  'src/styles/index.css': '30c4947ade094112058b3fe6dc1cab6064be4d33',
  'src/styles/pages/home.css': 'be36ae3f26ba194561f224e1d56224c0995ffe83',
  'src/styles/pages/home-hero.css': '58978ac30da6f7989a8be54f9bd464de5467abd6',
  'src/styles/pages/home-hero-media.css': 'd36fdd9782e83008cf36ddbbc481c9a556ccf0df',
  'src/styles/pages/home-featured-investors.css': 'e7a853245dbd40b747e2a820c32825c24db916b1',
  'src/styles/pages/home-layout.css': '44f38d58d6ccd6475e2edb1b916dff11433d2622',
  'src/styles/pages/ui-fixes.css': '795e353274f3d06eef68002310fb34cae932b47e',
  'src/styles/final/release-foundation.css': 'ba6a2af64a4bf0160698b476c117a989e7ff86a6',
  'src/styles/pages/release-cleanup.css': 'e854f4536aaa27e101314837c81bd066119be07a',
};

const failures = [];
const files = [];

function runGit(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

try {
  execFileSync('git', ['merge-base', '--is-ancestor', baselineSourceCommit, 'HEAD'], {
    cwd: root,
    stdio: 'ignore',
  });
} catch {
  failures.push(`Frozen source commit ${baselineSourceCommit} is not an ancestor of HEAD`);
}

for (const [relativePath, expectedBlob] of Object.entries(expectedBlobs)) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing baseline file: ${relativePath}`);
    continue;
  }
  const actualBlob = runGit(['hash-object', relativePath]);
  const stats = fs.statSync(absolutePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  files.push({
    path: relativePath,
    expectedBlob,
    actualBlob,
    matches: actualBlob === expectedBlob,
    bytes: stats.size,
    lines: text.split(/\r?\n/).length,
  });
  if (actualBlob !== expectedBlob) {
    failures.push(`${relativePath}: expected ${expectedBlob}, found ${actualBlob}`);
  }
}

const indexCss = fs.readFileSync(path.join(root, 'src/styles/index.css'), 'utf8');
const importOrder = [
  './pages/home.css',
  './pages/ui-fixes.css',
  './final/release-foundation.css',
  './pages/release-cleanup.css',
  './pages/home-hero.css',
  './pages/home-featured-investors.css',
  './pages/home-layout.css',
  './pages/home-hero-media.css',
];
let previousIndex = -1;
for (const token of importOrder) {
  const currentIndex = indexCss.indexOf(token);
  if (currentIndex < 0) failures.push(`Missing CSS import: ${token}`);
  if (currentIndex >= 0 && currentIndex <= previousIndex) {
    failures.push(`Unexpected CSS import order at ${token}`);
  }
  previousIndex = Math.max(previousIndex, currentIndex);
}

const homeCss = fs.readFileSync(path.join(root, 'src/styles/pages/home.css'), 'utf8');
const heroMediaCss = fs.readFileSync(path.join(root, 'src/styles/pages/home-hero-media.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(root, 'src/styles/pages/home-layout.css'), 'utf8');
const foundationCss = fs.readFileSync(path.join(root, 'src/styles/final/release-foundation.css'), 'utf8');
const cleanupCss = fs.readFileSync(path.join(root, 'src/styles/pages/release-cleanup.css'), 'utf8');

const findings = {
  pageGap80: layoutCss.includes('--d68-home-section-gap: 80px'),
  pageBackgroundF7FAFC: layoutCss.includes('background: #F7FAFC'),
  homeCssContainsMobileContain: homeCss.includes('object-fit:contain!important'),
  lateHeroMediaForcesCover: heroMediaCss.includes('object-fit:cover!important'),
  promotionHasFoundationPadding50:
    foundationCss.includes('.d68-promo-banner.d68-home-container') &&
    foundationCss.includes('padding-top:50px!important') &&
    foundationCss.includes('padding-bottom:50px!important'),
  cleanupIsStub:
    cleanupCss.includes('D68_RELEASE_CLEANUP_STUB') &&
    cleanupCss.includes('No active CSS is allowed in this file.'),
  homeSelectorsRemainInFoundation: foundationCss.includes('.d68-home-'),
};

for (const [name, passed] of Object.entries(findings)) {
  if (!passed) failures.push(`Baseline finding changed unexpectedly: ${name}`);
}

fs.mkdirSync(outputDir, { recursive: true });
const manifest = {
  generatedAt: new Date().toISOString(),
  baselineSourceCommit,
  head: runGit(['rev-parse', 'HEAD']),
  files,
  importOrder,
  findings,
};
fs.writeFileSync(
  path.join(outputDir, 'source-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

if (failures.length) {
  console.error('✗ Homepage H0 baseline check failed:');
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✓ Homepage H0 source baseline matches building@816b319e.');
console.log('✓ Runtime Homepage/CSS source files were not changed by H0.');
console.log('✓ Current cascade findings were recorded without fixing them.');
console.log('✓ Wrote docs/qa/homepage-h0-baseline/source-manifest.json.');
