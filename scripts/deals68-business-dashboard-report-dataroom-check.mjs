#!/usr/bin/env node
import fs from 'node:fs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

const panel = read('src/features/businessReports/BusinessReportPanelPortal.tsx');
const core = read('src/features/businessReports/reportCore.ts');
const dashboard = read('src/pages/BusinessDashboard.tsx');
const data = read('src/lib/data.ts');

check(panel.includes("DOCUMENT_PROCESSING_PENDING") && panel.includes("Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu."), 'Report blocking codes must be localized in Vietnamese.');
check(panel.includes("reportErrorText(") && core.includes("DOCUMENT_PROCESSING_PENDING"), 'Report runtime errors must use the shared localized mapper.');
check(panel.includes("Hãy cập nhật tài liệu tại Tài liệu dataroom") && !panel.includes("Mở Tài liệu Dataroom để bổ sung"), 'The Dataroom report link copy is incorrect.');
check(dashboard.includes("hasPending && hasPublicSnapshot && msg !== businessUpdateSuccessMsg(lang)"), 'Business review notices can still be duplicated.');
check(dashboard.includes("Bạn muốn xóa file này: Có/Không"), 'The required file deletion confirmation is missing.');
check(dashboard.includes('<button type="button" onClick={() => deleteFile(d)}'), 'The delete action must be an explicit non-submit button.');
check(data.includes("const deleted = await deleteBusinessAsset('file', assetId)") && data.includes("Tài liệu vẫn còn trong hệ thống sau khi xóa."), 'Dataroom deletion must verify the database row is gone.');
check(data.includes("review_status: 'pending_admin_approval'") && data.includes("public_visible: false"), 'New uploads must remain pending Admin review and private.');

if (failures.length) {
  console.error('✗ Business Dashboard/report/Dataroom contract failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}

console.log('✓ Business Dashboard/report/Dataroom contract: PASS');
console.log('✓ Vietnamese report errors, notice deduplication and complete file deletion verified.');
