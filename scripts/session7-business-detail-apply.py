from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return source.replace(old, new, 1)


detail_path = Path('src/pages/BusinessDetail.tsx')
source = detail_path.read_text(encoding='utf-8')

if 'type TransactionInfoRow' not in source:
    source = replace_once(
        source,
        "type FactRow = { label: string; value: string };",
        "type FactRow = { label: string; value: string };\ntype TransactionInfoRow = { label: string; value: string };",
        'transaction info type',
    )

if 'function approvedFinancialInputOf' not in source:
    source = replace_once(
        source,
        "function cleanText(value: any) { return String(value || '').trim(); }",
        """function cleanText(value: any) { return String(value || '').trim(); }
function objectOf(value: any) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function approvedFinancialInputOf(business: any) {
  const snapshot = objectOf(business?.public_snapshot_json);
  const snapshotFinancial = objectOf(snapshot.financial_input);
  return Object.keys(snapshotFinancial).length ? snapshotFinancial : objectOf(business?.financial_input);
}
function localizedApprovedText(lang: Lang, vi: any, en: any, legacy: any = '') {
  const value = lang === 'en'
    ? cleanText(en) || cleanText(vi) || cleanText(legacy)
    : cleanText(vi) || cleanText(legacy) || cleanText(en);
  return value || T(lang, 'Đang cập nhật', 'Pending');
}""",
        'approved financial helpers',
    )

if 'const businessListPath =' not in source:
    source = replace_once(
        source,
        "  const navigate = useNavigate();",
        """  const navigate = useNavigate();
  const homePath = lang === 'en' ? '/en' : '/';
  const businessListPath = lang === 'en' ? '/en/businesses' : '/businesses';
  const loginPath = lang === 'en' ? '/en/login' : '/login';""",
        'localized routes',
    )

if 'const transactionInfo = useMemo<TransactionInfoRow[]>' not in source:
    marker = "  const highlights = useMemo(() => business ? lines(lang === 'vi' ? business.highlights_vi : (business.highlights_en || business.highlights_vi)) : [], [business, lang]);"
    insert = marker + """
  const transactionInfo = useMemo<TransactionInfoRow[]>(() => {
    const financial = approvedFinancialInputOf(business);
    return [
      {
        label: T(lang, 'Tài sản hữu hình & vô hình DN sở hữu', 'Tangible & intangible assets owned by the business'),
        value: localizedApprovedText(lang, financial.assets_owned_vi, financial.assets_owned_en, financial.assets_owned),
      },
      {
        label: T(lang, 'Giá trị tài sản vật chất KHÔNG nằm trong giao dịch', 'Physical asset value NOT included in the transaction'),
        value: localizedApprovedText(lang, financial.excluded_physical_asset_value_vi, financial.excluded_physical_asset_value_en, financial.excluded_physical_asset_value),
      },
      {
        label: T(lang, 'Lý do gọi vốn/chuyển nhượng', 'Fundraising / transfer rationale'),
        value: localizedApprovedText(lang, business?.investment_reason_vi || financial.investment_reason_vi, business?.investment_reason_en || financial.investment_reason_en, financial.investment_reason),
      },
    ];
  }, [business, lang]);"""
    source = replace_once(source, marker, insert, 'transaction info memo')

if 'd68-detail-transaction-info' not in source:
    marker = "          <InfoSection title={T(lang, 'Điểm nổi bật', 'Highlights')}><BulletList items={highlights} empty={T(lang, 'Chưa có điểm nổi bật đã duyệt.', 'No approved highlights yet.')} /></InfoSection>"
    insert = marker + """
          <InfoSection title={T(lang, 'Thông tin Tài sản & Giao dịch', 'Assets & Transaction Information')}><div className=\"d68-detail-transaction-info\">{transactionInfo.map((item) => <div key={item.label} className=\"d68-detail-transaction-row\"><span>{item.label}</span><p>{item.value}</p></div>)}</div></InfoSection>"""
    source = replace_once(source, marker, insert, 'transaction info section')

owner_old = "isOwnerBusiness ? `👁 ${T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')}`"
owner_new = "isOwnerBusiness ? T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')"
if owner_old in source:
    source = replace_once(source, owner_old, owner_new, 'owner view badge')
elif owner_new not in source:
    raise SystemExit('owner view badge not found')

bqs_start = '          <InfoSection title="Business Quality Score">'
bqs_end = '\n        </div>\n        <aside className="d68-detail-side">'
if bqs_start in source:
    start = source.index(bqs_start)
    end = source.index(bqs_end, start)
    block = source[start:end]
    if not block.endswith('</InfoSection>'):
        raise SystemExit('BQS block did not end with InfoSection')
    block = block.replace(bqs_start, '          <section className="d68-detail-card d68-detail-card--bqs">', 1)
    block = block[:-len('</InfoSection>')] + '</section>'
    source = source[:start] + block + source[end:]
elif 'd68-detail-card d68-detail-card--bqs' not in source:
    raise SystemExit('Could not locate BQS block')

for old, new in [
    ('to="/"', 'to={homePath}'),
    ('to="/businesses"', 'to={businessListPath}'),
    ('to={`/businesses?industry=${encodeURIComponent(industry)}`}', 'to={`${businessListPath}?industry=${encodeURIComponent(industry)}`}'),
    ('<Link to={`/login?role=investor&next=/businesses/${slug}`}>', '<Link to={`${loginPath}?role=investor&next=${encodeURIComponent(`${businessListPath}/${slug}`)}`}>'),
    ('to={`/businesses/${deal.slug}`}', "to={`${lang === 'en' ? '/en/businesses' : '/businesses'}/${deal.slug}`}"),
]:
    source = source.replace(old, new)

if 'pending_changes_json' in source:
    raise SystemExit('Business Detail must not read pending_changes_json')

detail_path.write_text(source, encoding='utf-8')

css_path = Path('src/styles/pages/business-detail.css')
css = css_path.read_text(encoding='utf-8')
if 'Session 7 — approved assets and transaction information' not in css:
    css += """

/* Session 7 — approved assets and transaction information. */
.d68-detail-transaction-info{display:grid;gap:0}
.d68-detail-transaction-row{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,1.4fr);gap:22px;padding:16px 0;border-bottom:1px solid #EEF2F6}
.d68-detail-transaction-row:first-child{padding-top:2px}
.d68-detail-transaction-row:last-child{border-bottom:0;padding-bottom:2px}
.d68-detail-transaction-row>span{color:#64748B;font-size:13.5px;font-weight:800;line-height:1.5}
.d68-detail-transaction-row>p{margin:0;color:#334155;font-size:14.5px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
.d68-detail-card--bqs .d68-bqs-card.is-real{border:0;padding:0;box-shadow:none}
.d68-detail-card--bqs .d68-bqs-head{justify-content:center;text-align:center}
.d68-detail-card--bqs .d68-bqs-head h3{text-align:center}
@media(max-width:620px){.d68-detail-transaction-row{grid-template-columns:1fr;gap:7px;padding:14px 0}}
"""
    css_path.write_text(css, encoding='utf-8')

qa_path = Path('scripts/deals68-business-detail-assets-transaction-check.mjs')
qa_path.write_text("""import fs from 'node:fs';
import assert from 'node:assert/strict';

const detail = fs.readFileSync('src/pages/BusinessDetail.tsx', 'utf8');
const css = fs.readFileSync('src/styles/pages/business-detail.css', 'utf8');
const data = fs.readFileSync('src/lib/data.ts', 'utf8');

for (const token of [
  'approvedFinancialInputOf', 'public_snapshot_json',
  'const transactionInfo = useMemo<TransactionInfoRow[]>',
  'Thông tin Tài sản & Giao dịch', 'Assets & Transaction Information',
  'Tài sản hữu hình & vô hình DN sở hữu', 'Tangible & intangible assets owned by the business',
  'Giá trị tài sản vật chất KHÔNG nằm trong giao dịch', 'Physical asset value NOT included in the transaction',
  'Lý do gọi vốn/chuyển nhượng', 'Fundraising / transfer rationale',
  'd68-detail-transaction-info', 'd68-detail-card d68-detail-card--bqs',
  "isOwnerBusiness ? T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')",
  "const businessListPath = lang === 'en' ? '/en/businesses' : '/businesses'",
]) assert.ok(detail.includes(token), `Missing Session 7 token: ${token}`);

for (const forbidden of [
  '<InfoSection title="Business Quality Score">',
  "isOwnerBusiness ? `👁 ${T(lang, 'Bản xem của doanh nghiệp', 'Business owner view')}`",
  'pending_changes_json',
]) assert.ok(!detail.includes(forbidden), `Forbidden Session 7 token remains: ${forbidden}`);

assert.match(detail, /approvedFinancialInputOf\(business: any\)[\s\S]*public_snapshot_json[\s\S]*snapshot\.financial_input/);
assert.match(detail, /getBusinessBySlug\(slug\)/);
assert.match(data, /getBusinessBySlug[\s\S]*public_businesses_safe[\s\S]*getPublicBusinessView/);
assert.match(css, /\.d68-detail-card--bqs \.d68-bqs-card\.is-real\{border:0;padding:0;box-shadow:none\}/);
assert.match(css, /\.d68-detail-card--bqs \.d68-bqs-head\{justify-content:center;text-align:center\}/);
assert.match(css, /\.d68-detail-transaction-row\{display:grid/);
assert.match(css, /@media\(max-width:620px\)\{\.d68-detail-transaction-row\{grid-template-columns:1fr/);
console.log('✓ Session 7 Business Detail assets & transaction contract: PASS');
""", encoding='utf-8')

package_path = Path('scripts/deals68-package-checks.mjs')
package_source = package_path.read_text(encoding='utf-8')
check = "  'scripts/deals68-business-detail-assets-transaction-check.mjs',\n"
if check not in package_source:
    marker = "  'scripts/deals68-admin-business-financial-review-check.mjs',\n"
    if package_source.count(marker) != 1:
        raise SystemExit('Could not register Session 7 package check')
    package_path.write_text(package_source.replace(marker, marker + check, 1), encoding='utf-8')
