#!/usr/bin/env node
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

function replaceOnce(path, before, after, label) {
  const source = read(path);
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly one match in ${path}, found ${occurrences}`);
  }
  write(path, source.replace(before, after));
}

const panelPath = 'src/features/businessReports/BusinessReportPanelPortal.tsx';
replaceOnce(
  panelPath,
  "} from './reportApi';\nimport type {",
  "} from './reportApi';\nimport { reportErrorText } from './reportCore';\nimport type {",
  'report error helper import',
);

replaceOnce(
  panelPath,
  `function messageText(item: ReportMessageItem | string, lang: ReportLang) {\n  if (typeof item === 'string') return item.replaceAll('_', ' ');\n  return lang === 'en'\n    ? item.message_en || item.message_vi || item.code || ''\n    : item.message_vi || item.message_en || item.code || '';\n}`,
  `const REPORT_MESSAGE_COPY: Record<string, [string, string]> = {\n  DOCUMENT_PROCESSING_PENDING: [\n    'Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu.',\n    'Documents are awaiting processing. The report can be created after processing finishes.',\n  ],\n  DOCUMENT_BACKED_REVENUE_MISSING: [\n    'Doanh thu hiện là dữ liệu tự kê khai hoặc chưa đủ độ tin cậy; báo cáo không dùng số này để định giá.',\n    'Revenue is self-declared or insufficiently supported; it will not be used for valuation.',\n  ],\n};\n\nfunction messageText(item: ReportMessageItem | string, lang: ReportLang) {\n  if (typeof item === 'string') {\n    const mapped = REPORT_MESSAGE_COPY[item];\n    if (mapped) return T(lang, mapped[0], mapped[1]);\n    return lang === 'vi' && /^[A-Z0-9_]+$/.test(item)\n      ? 'Dữ liệu hoặc tài liệu chưa đủ điều kiện tạo báo cáo.'\n      : item.replaceAll('_', ' ');\n  }\n  return lang === 'en'\n    ? item.message_en || item.message_vi || messageText(item.code || '', lang)\n    : item.message_vi || item.message_en || messageText(item.code || '', lang);\n}`,
  'localized report preflight messages',
);

replaceOnce(
  panelPath,
  `      setErrorMessage(\n        error?.message ||\n          T(lang, 'Không tải được trạng thái báo cáo.', 'Could not load report status.'),\n      );`,
  `      setErrorMessage(reportErrorText(\n        error,\n        lang,\n        'Không tải được trạng thái báo cáo.',\n        'Could not load report status.',\n      ));`,
  'localized report status error',
);

replaceOnce(
  panelPath,
  `      setErrorMessage(\n        error?.message ||\n          T(lang, 'Không thể tạo báo cáo.', 'Could not generate the report.'),\n      );`,
  `      setErrorMessage(reportErrorText(\n        error,\n        lang,\n        'Không thể tạo báo cáo.',\n        'Could not generate the report.',\n      ));`,
  'localized report generation error',
);

replaceOnce(
  panelPath,
  `      setErrorMessage(\n        error?.message ||\n          T(lang, 'Không thể tải báo cáo.', 'Could not download the report.'),\n      );`,
  `      setErrorMessage(reportErrorText(\n        error,\n        lang,\n        'Không thể tải báo cáo.',\n        'Could not download the report.',\n      ));`,
  'localized report download error',
);

replaceOnce(
  panelPath,
  `{T(lang, 'Mở Tài liệu Dataroom để bổ sung', 'Open Dataroom Documents to add files')} →`,
  `{T(lang, 'Hãy cập nhật tài liệu tại Tài liệu dataroom', 'Please update documents in Dataroom Documents')}`,
  'Dataroom report link copy',
);

const corePath = 'src/features/businessReports/reportCore.ts';
replaceOnce(
  corePath,
  `  RATE_LIMITED: [`,
  `  DOCUMENT_PROCESSING_PENDING: [\n    'Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu.',\n    'Documents are awaiting processing. The report can be created after processing finishes.',\n  ],\n  DOCUMENT_BACKED_REVENUE_MISSING: [\n    'Doanh thu hiện là dữ liệu tự kê khai hoặc chưa đủ độ tin cậy; báo cáo không dùng số này để định giá.',\n    'Revenue is self-declared or insufficiently supported; it will not be used for valuation.',\n  ],\n  RATE_LIMITED: [`,
  'shared report error mappings',
);

const dashboardPath = 'src/pages/BusinessDashboard.tsx';
replaceOnce(
  dashboardPath,
  `if (!confirm(T(lang, 'Xóa tài liệu này?', 'Delete this document?'))) {`,
  `if (!confirm(T(lang, 'Bạn muốn xóa file này: Có/Không', 'Do you want to delete this file: Yes/No'))) {`,
  'file delete confirmation copy',
);

replaceOnce(
  dashboardPath,
  `{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{hasPending ? <div className="d68-dashboard-notice ok d68-business-update-alert">{businessUpdateSuccessMsg(lang)}</div> : null}`,
  `{busy ? <div className="d68-dashboard-notice warn">{T(lang,'Đang tải dữ liệu...','Loading data...')}</div> : null}{hasPending && hasPublicSnapshot && msg !== businessUpdateSuccessMsg(lang) ? <div className="d68-dashboard-notice ok d68-business-update-alert">{businessUpdateSuccessMsg(lang)}</div> : null}`,
  'deduplicate Business review notices',
);

replaceOnce(
  dashboardPath,
  `<button onClick={save} disabled={saving || downloading} className="d68-dashboard-btn light">`,
  `<button type="button" onClick={save} disabled={saving || downloading} className="d68-dashboard-btn light">`,
  'document save button type',
);
replaceOnce(
  dashboardPath,
  `<button onClick={download} disabled={saving || downloading} className="d68-dashboard-btn light">`,
  `<button type="button" onClick={download} disabled={saving || downloading} className="d68-dashboard-btn light">`,
  'document download button type',
);
replaceOnce(
  dashboardPath,
  `<button onClick={() => deleteFile(d)} disabled={saving || downloading} className="d68-dashboard-btn red">`,
  `<button type="button" onClick={() => deleteFile(d)} disabled={saving || downloading} className="d68-dashboard-btn red">`,
  'document delete button type',
);

const dataPath = 'src/lib/data.ts';
replaceOnce(
  dataPath,
  `export async function deleteBusinessFile(row: any) {\n  const assetId = String(row?.id || '').trim();\n  if (!assetId) throw new Error('Tài liệu thiếu ID để xóa.');\n  return deleteBusinessAsset('file', assetId);\n}`,
  `export async function deleteBusinessFile(row: any) {\n  const assetId = String(row?.id || '').trim();\n  if (!assetId) throw new Error('Tài liệu thiếu ID để xóa.');\n\n  const deleted = await deleteBusinessAsset('file', assetId);\n  const { data: remaining, error } = await supabase\n    .from('business_files')\n    .select('id')\n    .eq('id', assetId)\n    .maybeSingle();\n\n  if (error) throw error;\n  if (remaining) throw new Error('Tài liệu vẫn còn trong hệ thống sau khi xóa.');\n  return deleted;\n}`,
  'verify complete Dataroom file deletion',
);

const qaPath = 'scripts/deals68-business-dashboard-report-dataroom-check.mjs';
write(qaPath, `#!/usr/bin/env node\nimport fs from 'node:fs';\n\nconst failures = [];\nconst read = (path) => fs.readFileSync(path, 'utf8');\nconst check = (condition, message) => { if (!condition) failures.push(message); };\n\nconst panel = read('src/features/businessReports/BusinessReportPanelPortal.tsx');\nconst core = read('src/features/businessReports/reportCore.ts');\nconst dashboard = read('src/pages/BusinessDashboard.tsx');\nconst data = read('src/lib/data.ts');\n\ncheck(panel.includes("DOCUMENT_PROCESSING_PENDING") && panel.includes("Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu."), 'Report blocking codes must be localized in Vietnamese.');\ncheck(panel.includes("reportErrorText(") && core.includes("DOCUMENT_PROCESSING_PENDING"), 'Report runtime errors must use the shared localized mapper.');\ncheck(panel.includes("Hãy cập nhật tài liệu tại Tài liệu dataroom") && !panel.includes("Mở Tài liệu Dataroom để bổ sung"), 'The Dataroom report link copy is incorrect.');\ncheck(dashboard.includes("hasPending && hasPublicSnapshot && msg !== businessUpdateSuccessMsg(lang)"), 'Business review notices can still be duplicated.');\ncheck(dashboard.includes("Bạn muốn xóa file này: Có/Không"), 'The required file deletion confirmation is missing.');\ncheck(dashboard.includes('<button type="button" onClick={() => deleteFile(d)}'), 'The delete action must be an explicit non-submit button.');\ncheck(data.includes("const deleted = await deleteBusinessAsset('file', assetId)") && data.includes("Tài liệu vẫn còn trong hệ thống sau khi xóa."), 'Dataroom deletion must verify the database row is gone.');\ncheck(data.includes("review_status: 'pending_admin_approval'") && data.includes("public_visible: false"), 'New uploads must remain pending Admin review and private.');\n\nif (failures.length) {\n  console.error('✗ Business Dashboard/report/Dataroom contract failed:');\n  failures.forEach((failure) => console.error('  - ' + failure));\n  process.exit(1);\n}\n\nconsole.log('✓ Business Dashboard/report/Dataroom contract: PASS');\nconsole.log('✓ Vietnamese report errors, notice deduplication and complete file deletion verified.');\n`);

console.log('Applied focused Business Dashboard, report and Dataroom fixes.');
