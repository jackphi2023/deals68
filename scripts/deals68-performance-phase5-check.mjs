#!/usr/bin/env node
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/data.ts', 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const collectionMatch = source.match(/const businessCollectionSelect = \[([\s\S]*?)\]\.join\(','\);/);
const homepageMatch = source.match(/const businessHomepageSelect = \[([\s\S]*?)\]\.join\(','\);/);
const detailMatch = source.match(/const businessPublicSelect = \[([\s\S]*?)\]\.join\(','\);/);
const collection = collectionMatch?.[1] || '';
const homepage = homepageMatch?.[1] || '';
const detail = detailMatch?.[1] || '';

check(!!collectionMatch, 'Business collection projection is missing');
check(!!homepageMatch, 'Business homepage projection is missing');
check(detail.includes('public_snapshot_json'), 'Business detail projection must retain approved snapshot data');
check(detail.includes('business_files') && detail.includes('business_images'), 'Business detail projection must retain existing detail metadata');
check(!collection.includes('public_snapshot_json'), 'Business list must not transfer full public snapshot JSON');
check(!collection.includes("'business_files'"), 'Business list must not transfer nested file metadata');
check(!collection.includes("'business_images'"), 'Business list must not transfer nested image metadata');
check(collection.includes('description_vi') && collection.includes('description_en'), 'Business list descriptions must remain available');
check(collection.includes('ebitda_margin') && collection.includes('quality_score'), 'Business list metrics must remain available');
check(homepage.includes('title_vi') && homepage.includes('title_en'), 'Homepage bilingual titles must remain available');
check(homepage.includes('revenue_2025') && homepage.includes('ask_amount') && homepage.includes('stake_pct'), 'Homepage business metrics must remain available');
check(homepage.includes('image_url') && homepage.includes('hero_image_url'), 'Homepage business images must remain available');
check(/listBusinesses\([\s\S]*?businessCollectionSelect/.test(source), 'listBusinesses must use collection projection');
check(/listBusinessesPage\([\s\S]*?businessCollectionSelect/.test(source), 'listBusinessesPage must use collection projection');
check(/listHomepageBusinesses\([\s\S]*?businessHomepageSelect/.test(source), 'Homepage ranking query must use homepage projection');
check(/getBusinessBySlug\([\s\S]*?businessPublicSelect/.test(source), 'Business detail query must keep full projection');

if (failures.length) {
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exit(1);
}

console.log('✓ Performance Phase 5 payload contract: 16/16 PASS');
