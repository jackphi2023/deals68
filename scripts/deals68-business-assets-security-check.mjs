import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) =>
  fs.readFileSync(path.join(root, rel), 'utf8');

const failures = [];

function requireToken(text, token, message) {
  if (!text.includes(token)) failures.push(message);
}

function forbidToken(text, token, message) {
  if (text.includes(token)) failures.push(message);
}

const storage = read('src/lib/businessAssetStorage.ts');
const data = read('src/lib/data.ts');
const dashboard = read('src/pages/BusinessDashboard.tsx');
const admin = read('src/components/admin/AdminBusinessAssets.tsx');
const migration = read(
  'supabase/migrations/' +
    '20260712093832_business_asset_security_phase_a.sql',
);
const moveMigration = read(
  'supabase/migrations/' +
    '20260712094720_business_asset_storage_move_rpc.sql',
);
const phaseB = read(
  'docs/security/G2_PHASE_B_AFTER_MAIN_CUTOVER.sql',
);

if ((storage.match(/as unknown as Row\[\]/g) || []).length < 2) {
  failures.push(
    'Supabase query rows chưa được narrow về Row[]; ' +
      'có thể tái phát GenericStringError',
  );
}

for (const token of [
  'BUSINESS_IMAGE_PRIVATE_BUCKET',
  'ensureBusinessImagePublic',
  'ensureBusinessImagePrivate',
  'attachBusinessImagePreviewUrls',
  'migrateLegacyPendingBusinessImages',
  'get_business_asset_delete_target',
  'delete_business_asset_record',
]) {
  requireToken(storage, token, `Storage helper thiếu ${token}`);
}

requireToken(
  data,
  '.from(BUSINESS_IMAGE_PRIVATE_BUCKET)',
  'New image upload is not private',
);
requireToken(
  data,
  "deleteBusinessAsset('file'",
  'File deletion is not verified',
);
requireToken(
  data,
  "deleteBusinessAsset('image'",
  'Image deletion is not verified',
);

const uploadImage = data
  .split('export async function uploadBusinessImage', 2)[1]
  .split('export async function updateBusinessImage', 2)[0];

forbidToken(
  uploadImage,
  'business-images-public',
  'Pending image upload still targets the public bucket',
);
forbidToken(
  data,
  "storage.from('business-files-private').remove([path]).catch",
  'File deletion still swallows Storage errors',
);
forbidToken(
  data,
  "storage.from('business-images-public').remove([path]).catch",
  'Image deletion still swallows Storage errors',
);

for (const token of [
  'getBusinessFiles(biz.id)',
  'getBusinessImages(biz.id)',
  'ensureBusinessImagePrivate(row)',
  'setFiles((current)',
  'setImages((current)',
]) {
  requireToken(
    dashboard,
    token,
    `Business Dashboard thiếu ${token}`,
  );
}

for (const token of [
  'ensureBusinessImagePublic',
  'ensureBusinessImagePrivate',
  'migrateLegacyPendingBusinessImages',
  'Chuyển toàn bộ sang vùng riêng tư',
]) {
  requireToken(
    admin,
    token,
    `Admin assets thiếu ${token}`,
  );
}

for (const token of [
  'business-images-private',
  'protect_business_file_fields',
  'protect_business_image_fields',
  'files select owner admin or approved connected',
  'business files select owned or approved connected',
  'get_business_asset_delete_target',
  'delete_business_asset_record',
  "review_status = 'approved'",
]) {
  requireToken(
    migration.toLowerCase(),
    token.toLowerCase(),
    `Migration G2 thiếu ${token}`,
  );
}

for (const token of [
  'finalize_business_image_storage_move',
  'owner_can_only_move_image_to_private',
  'image_move_source_mismatch',
]) {
  requireToken(
    moveMigration.toLowerCase(),
    token.toLowerCase(),
    `Storage move migration thiếu ${token}`,
  );
}

requireToken(
  phaseB,
  'Legacy pending/hidden images still exist in public storage',
  'Phase B thiếu release guard',
);
requireToken(
  phaseB,
  'authenticated upload business images',
  'Phase B thiếu drop legacy upload policy',
);
requireToken(
  phaseB,
  'public read business images',
  'Phase B thiếu drop legacy read/list policy',
);
requireToken(
  phaseB,
  "set default 'business-images-private'",
  'Phase B chưa chuyển default sang private',
);

if (failures.length) {
  console.error('✗ Deals68 G2 security static check failed:');
  failures.forEach((item) => console.error(`  - ${item}`));
  process.exit(1);
}

console.log('✓ Deals68 G2 security static check: PASS');
console.log('✓ New pending images use private storage.');
console.log('✓ Delete success requires Storage and database confirmation.');
console.log('✓ Connected Investors are limited to approved files.');
console.log('✓ Admin can promote approved images and demote hidden images.');
console.log('✓ Legacy public-image compatibility remains isolated in Phase B.');
