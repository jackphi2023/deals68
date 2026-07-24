from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, content):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'Anchor not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'Anchor count != 1 in {path}: {text.count(old)}')
    write(path, text.replace(old, new, 1))

service = r'''import { supabase } from './supabase';
import type { Lang } from './i18n';

export type FinancialAccessScope = 'financial_summary' | 'financial_detail' | 'dataroom';

export type FinancialAccessRequestResult = {
  request_id: string;
  business_id: string;
  investor_id: string;
  status: string;
  requested_scopes: FinancialAccessScope[];
  existing: boolean;
};

function T(lang: Lang, vi: string, en: string) {
  return lang === 'en' ? en : vi;
}

export function financialAccessErrorMessage(lang: Lang, error: any) {
  const raw = String(error?.message || error || '').trim();
  const value = raw.toLowerCase();
  if (value.includes('authentication required') || value.includes('jwt')) {
    return T(lang, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'Your session has expired. Please sign in again.');
  }
  if (value.includes('active investor profile required') || value.includes('investor access denied')) {
    return T(lang, 'Cần tài khoản Nhà đầu tư đang hoạt động để yêu cầu quyền xem số liệu.', 'An active Investor account is required to request financial access.');
  }
  if (value.includes('business is not available') || value.includes('business not found')) {
    return T(lang, 'Hồ sơ doanh nghiệp không còn khả dụng.', 'This Business profile is no longer available.');
  }
  if (value.includes('business permission required')) {
    return T(lang, 'Chỉ chủ doanh nghiệp hoặc quản trị viên được xử lý yêu cầu này.', 'Only the Business owner or an administrator can process this request.');
  }
  if (value.includes('financial request not found')) {
    return T(lang, 'Không tìm thấy yêu cầu xem số liệu.', 'The financial access request was not found.');
  }
  if (value.includes('financial access grant not found')) {
    return T(lang, 'Quyền truy cập không còn tồn tại hoặc đã được xử lý.', 'The access grant no longer exists or has already been processed.');
  }
  if (value.includes('expiry must be in the future')) {
    return T(lang, 'Ngày hết hạn phải nằm trong tương lai.', 'The expiry date must be in the future.');
  }
  if (value.includes('failed to fetch') || value.includes('network')) {
    return T(lang, 'Không thể kết nối máy chủ. Vui lòng thử lại.', 'Could not reach the server. Please try again.');
  }
  return T(lang, 'Không thể xử lý yêu cầu lúc này.', 'The request could not be processed right now.');
}

export async function requestBusinessFinancialAccess(
  businessId: string,
  requestNote: string,
  scopes: FinancialAccessScope[] = ['financial_summary', 'financial_detail'],
): Promise<FinancialAccessRequestResult> {
  const { data, error } = await supabase.rpc('d68_request_business_financial_access', {
    p_business_id: businessId,
    p_requested_scopes: scopes,
    p_request_note: requestNote,
  });
  if (error) throw error;
  return data as FinancialAccessRequestResult;
}

export async function respondBusinessFinancialRequest(params: {
  requestId: string;
  decision: 'approve' | 'reject';
  grantedScopes?: FinancialAccessScope[];
  expiresAt?: string | null;
  responseNote?: string;
}) {
  const { data, error } = await supabase.rpc('d68_respond_business_financial_request', {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_granted_scopes: params.decision === 'approve' ? (params.grantedScopes || ['financial_summary']) : [],
    p_expires_at: params.expiresAt || null,
    p_response_note: params.responseNote || null,
  });
  if (error) throw error;
  return data;
}

export async function revokeBusinessFinancialAccess(grantId: string, reason?: string) {
  const { data, error } = await supabase.rpc('d68_revoke_business_financial_access', {
    p_grant_id: grantId,
    p_reason: reason || null,
  });
  if (error) throw error;
  return data;
}

export function financialRequestStatusLabel(lang: Lang, status: unknown, grantStatus?: unknown) {
  const request = String(status || '').toLowerCase();
  const grant = String(grantStatus || '').toLowerCase();
  if (grant === 'revoked') return T(lang, 'Đã thu hồi', 'Revoked');
  if (grant === 'expired') return T(lang, 'Đã hết hạn', 'Expired');
  if (request === 'fulfilled') return T(lang, 'Đã được cấp quyền', 'Access granted');
  if (request === 'rejected') return T(lang, 'Đã từ chối', 'Declined');
  if (request === 'pending' || request === 'forwarded') return T(lang, 'Đang chờ doanh nghiệp chấp thuận', 'Awaiting Business approval');
  return T(lang, 'Chưa yêu cầu', 'Not requested');
}
'''
write('src/lib/businessFinancialAccess.ts', service)

# Business Detail
replace_once('src/pages/BusinessDetail.tsx',
"import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';",
"import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\nimport { financialAccessErrorMessage, requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';")
replace_once('src/pages/BusinessDetail.tsx',
"  const [msg, setMsg] = useState('');",
"  const [msg, setMsg] = useState('');\n  const [requestBusy, setRequestBusy] = useState(false);")
old = """  async function requestData() {
    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu tài liệu.', 'Only Investor accounts can request documents.')); return; }
    const inv = await getInvestorByOwner(profile.id).catch(() => null);
    if (!inv?.id || !business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ nhà đầu tư.', 'Investor profile not found.')); return; }
    const { error: reqErr } = await supabase.from('request_data').insert({ investor_id: inv.id, business_id: business.id, requested_items: ['IM', 'Financials'], note: 'Requested from public business detail page. e-NDA placeholder pending Beta completion.', status: 'pending' });
    setMsg(reqErr ? reqErr.message : T(lang, 'Đã gửi yêu cầu tài liệu qua Deals68. Luồng e-NDA sẽ được hoàn thiện ở bước tiếp theo.', 'Data request sent via Deals68. The e-NDA flow will be completed in the next step.'));
  }
"""
new = """  async function requestData() {
    if (requestBusy) return;
    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu xem số liệu.', 'Only Investor accounts can request financial access.')); return; }
    if (!business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp.', 'Business profile not found.')); return; }
    setRequestBusy(true);
    try {
      const result = await requestBusinessFinancialAccess(
        business.id,
        'Investor requested financial access from the public Business detail page.',
      );
      setMsg(result.existing
        ? T(lang, 'Yêu cầu xem số liệu đang chờ doanh nghiệp chấp thuận.', 'Your financial access request is awaiting Business approval.')
        : T(lang, 'Đã gửi yêu cầu xem số liệu tới doanh nghiệp.', 'Financial access request sent to the Business.'));
      setBusiness((current: any) => current ? { ...current, financial_request_status: result.status } : current);
    } catch (requestError: any) {
      setMsg(financialAccessErrorMessage(lang, requestError));
    } finally {
      setRequestBusy(false);
    }
  }
"""
replace_once('src/pages/BusinessDetail.tsx', old, new)
replace_once('src/pages/BusinessDetail.tsx',
"<button type=\"button\" onClick={requestData}>🔒 {T(lang, 'Yêu cầu tài liệu', 'Request data')}</button>",
"<button type=\"button\" disabled={requestBusy} onClick={requestData}>🔒 {requestBusy ? T(lang, 'Đang gửi...', 'Sending...') : T(lang, 'Yêu cầu xem số liệu', 'Request financial access')}</button>")

# Investor Dashboard
replace_once('src/pages/InvestorDashboard.tsx',
"import BusinessTitleLink from '../components/investor/BusinessTitleLink';",
"import BusinessTitleLink from '../components/investor/BusinessTitleLink';\nimport { financialAccessErrorMessage, requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';")
replace_once('src/pages/InvestorDashboard.tsx',
"  const [busy, setBusy] = useState(true);",
"  const [busy, setBusy] = useState(true);\n  const requestInFlight = useRef(new Set<string>());")
replace_once('src/pages/InvestorDashboard.tsx',
"  useState,\n} from 'react';",
"  useState,\n  useRef,\n} from 'react';")
old = """  async function requestData(business: any): Promise<boolean> {
    if (!investor?.id || !business?.id) return false;
    const { error } = await supabase.from('request_data').insert({
      investor_id: investor.id,
      business_id: business.id,
      requested_items: ['IM', 'Financials'],
      note: 'Investor requested data from Investor Dashboard.',
      status: 'pending',
    });
    if (error) {
      setNoticeType('err');
      setNotice(T(lang, 'Có lỗi', 'Something went wrong'));
      return false;
    }
    setNoticeType('ok');
    setNotice(T(lang, 'Đã gửi yêu cầu dữ liệu.', 'Data request sent.'));
    return true;
  }
"""
new = """  async function requestData(business: any): Promise<boolean> {
    const businessId = String(business?.id || '');
    if (!investor?.id || !businessId || requestInFlight.current.has(businessId)) return false;
    requestInFlight.current.add(businessId);
    try {
      const result = await requestBusinessFinancialAccess(
        businessId,
        'Investor requested financial access from Investor Dashboard.',
      );
      setNoticeType(result.existing ? 'warn' : 'ok');
      setNotice(result.existing
        ? T(lang, 'Yêu cầu xem số liệu đang chờ doanh nghiệp chấp thuận.', 'Your financial access request is awaiting Business approval.')
        : T(lang, 'Đã gửi yêu cầu xem số liệu.', 'Financial access request sent.'));
      return true;
    } catch (requestError: any) {
      setNoticeType('err');
      setNotice(financialAccessErrorMessage(lang, requestError));
      return false;
    } finally {
      requestInFlight.current.delete(businessId);
    }
  }
"""
replace_once('src/pages/InvestorDashboard.tsx', old, new)
text = read('src/pages/InvestorDashboard.tsx')
text = text.replace("T(lang, 'Yêu cầu dữ liệu', 'Request data')", "T(lang, 'Yêu cầu xem số liệu', 'Request financial access')")
text = text.replace("T(lang, 'Yêu cầu tài liệu', 'Request documents')", "T(lang, 'Yêu cầu xem số liệu', 'Request financial access')")
write('src/pages/InvestorDashboard.tsx', text)

# Business Dashboard imports/state/load/actions/UI
replace_once('src/pages/BusinessDashboard.tsx',
"import { businessProposalQuotaForPlan } from '../lib/businessPlans';",
"import { businessProposalQuotaForPlan } from '../lib/businessPlans';\nimport { financialAccessErrorMessage, respondBusinessFinancialRequest, revokeBusinessFinancialAccess, type FinancialAccessScope } from '../lib/businessFinancialAccess';")
replace_once('src/pages/BusinessDashboard.tsx',
"  const [requests, setRequests] = useState<any[]>([]);",
"  const [requests, setRequests] = useState<any[]>([]);\n  const [requestActionBusy, setRequestActionBusy] = useState('');")
replace_once('src/pages/BusinessDashboard.tsx',
"          benchmarkRes,\n        ] = await Promise.all([",
"          benchmarkRes,\n          grantsRes,\n        ] = await Promise.all([")
replace_once('src/pages/BusinessDashboard.tsx',
"          supabase\n            .from('public_businesses_safe')\n            .select(\n              'id,industry,country_iso2,revenue_2025,revenue_currency,' +\n                'ask_amount,ask_currency,stake_pct,deal_type,visible,status,' +\n                'public_snapshot_json',\n            )\n            .eq('country_iso2', biz.country_iso2 || 'VN')\n            .limit(80),\n        ]);",
"          supabase\n            .from('public_businesses_safe')\n            .select(\n              'id,industry,country_iso2,revenue_2025,revenue_currency,' +\n                'ask_amount,ask_currency,stake_pct,deal_type,visible,status,' +\n                'public_snapshot_json',\n            )\n            .eq('country_iso2', biz.country_iso2 || 'VN')\n            .limit(80),\n          supabase\n            .from('business_financial_access_grants')\n            .select('id,source_id,source_type,scopes,status,expires_at,granted_at,revoked_at,revoke_reason')\n            .eq('business_id', biz.id),\n        ]);")
replace_once('src/pages/BusinessDashboard.tsx',
"        setRequests(\n          Array.isArray(relations.requests) ? relations.requests : [],\n        );",
"        const grantByRequest = new Map((grantsRes.error ? [] : (grantsRes.data || []))\n          .filter((grant: any) => grant.source_type === 'data_request' && grant.source_id)\n          .map((grant: any) => [String(grant.source_id), grant]));\n        setRequests(\n          (Array.isArray(relations.requests) ? relations.requests : []).map((request: any) => ({\n            ...request,\n            financial_grant: grantByRequest.get(String(request.id)) || null,\n          })),\n        );")
replace_once('src/pages/BusinessDashboard.tsx',
"  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đánh dấu hoàn tất.', 'Marked as fulfilled.')); load(); }",
"  async function respondFinancialRequest(row: any, decision: 'approve' | 'reject', scopes: FinancialAccessScope[], expiresAt: string | null, responseNote: string) {\n    if (!row?.id || requestActionBusy) return;\n    setRequestActionBusy(String(row.id)); setErr(''); setMsg('');\n    try {\n      await respondBusinessFinancialRequest({ requestId: row.id, decision, grantedScopes: scopes, expiresAt, responseNote });\n      setMsg(decision === 'approve' ? T(lang, 'Đã chấp thuận và cấp quyền xem số liệu.', 'Financial access approved and granted.') : T(lang, 'Đã từ chối yêu cầu xem số liệu.', 'Financial access request declined.'));\n      await load();\n    } catch (actionError: any) { setErr(financialAccessErrorMessage(lang, actionError)); }\n    finally { setRequestActionBusy(''); }\n  }\n\n  async function revokeFinancialRequest(row: any, reason: string) {\n    const grantId = row?.financial_grant?.id;\n    if (!grantId || requestActionBusy) return;\n    setRequestActionBusy(String(row.id)); setErr(''); setMsg('');\n    try {\n      await revokeBusinessFinancialAccess(grantId, reason || 'Revoked by Business owner from Dashboard.');\n      setMsg(T(lang, 'Đã thu hồi quyền truy cập.', 'Access has been revoked.'));\n      await load();\n    } catch (actionError: any) { setErr(financialAccessErrorMessage(lang, actionError)); }\n    finally { setRequestActionBusy(''); }\n  }")
replace_once('src/pages/BusinessDashboard.tsx',
"      {tab === 'requests' ? <Rows title={T(lang,'Yêu cầu dữ liệu','Data requests')} rows={requests} empty={T(lang,'Chưa có yêu cầu dữ liệu.','No data requests yet.')} actions={(row: any) => <button onClick={() => fulfillRequest(row)} className=\"d68-dashboard-btn green\">Fulfilled</button>} /> : null}",
"      {tab === 'requests' ? <FinancialRequestRows lang={lang} rows={requests} busyId={requestActionBusy} onRespond={respondFinancialRequest} onRevoke={revokeFinancialRequest} /> : null}")

component = r'''
function scopeLabel(scope: string, lang: Lang) {
  if (scope === 'financial_summary') return T(lang, 'Số liệu tài chính tóm tắt', 'Financial summary');
  if (scope === 'financial_detail') return T(lang, 'Số liệu tài chính chi tiết', 'Financial detail');
  return T(lang, 'Phòng dữ liệu', 'Dataroom');
}

function FinancialRequestRow({ lang, row, busyId, onRespond, onRevoke }: any) {
  const requested: string[] = Array.isArray(row.requested_scopes) && row.requested_scopes.length
    ? row.requested_scopes
    : (Array.isArray(row.requested_items) ? row.requested_items : ['financial_summary', 'financial_detail']);
  const [summary, setSummary] = useState(true);
  const [detail, setDetail] = useState(requested.includes('financial_detail'));
  const [expiresAt, setExpiresAt] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const grant = row.financial_grant || null;
  const status = String(row.status || 'pending').toLowerCase();
  const activeGrant = grant && grant.status === 'active' && (!grant.expires_at || new Date(grant.expires_at).getTime() > Date.now());
  const busy = String(busyId || '') === String(row.id);
  const investor = row.investors || {};
  const title = investor.title_vi || investor.title_en || investor.code || row.investor_id || row.id;
  const grantedScopes: string[] = Array.isArray(grant?.scopes) ? grant.scopes : [];
  const expiryIso = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null;

  return <article className="d68-financial-request-row">
    <div className="d68-financial-request-row__head">
      <div><b>{title}</b><small>{new Date(row.created_at || Date.now()).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</small></div>
      <span className={`d68-dashboard-badge ${activeGrant ? 'green' : status === 'rejected' ? 'red' : 'gold'}`}>{activeGrant ? T(lang, 'Đã được cấp quyền', 'Access granted') : status === 'rejected' ? T(lang, 'Đã từ chối', 'Declined') : grant?.status === 'revoked' ? T(lang, 'Đã thu hồi', 'Revoked') : T(lang, 'Đang chờ doanh nghiệp chấp thuận', 'Awaiting Business approval')}</span>
    </div>
    <div className="d68-financial-request-row__meta"><span>{T(lang, 'Scope yêu cầu', 'Requested scopes')}</span>{requested.map((scope) => <em key={scope}>{scopeLabel(scope, lang)}</em>)}</div>
    {userFacingNote(row) ? <p>{userFacingNote(row)}</p> : null}
    {activeGrant ? <>
      <div className="d68-financial-request-row__meta"><span>{T(lang, 'Đã cấp', 'Granted')}</span>{grantedScopes.map((scope) => <em key={scope}>{scopeLabel(scope, lang)}</em>)}</div>
      {grant.expires_at ? <small>{T(lang, 'Hết hạn', 'Expires')}: {new Date(grant.expires_at).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}</small> : null}
      <div className="d68-financial-request-row__actions"><button type="button" disabled={busy} className="d68-dashboard-btn red" onClick={() => onRevoke(row, responseNote)}>{T(lang, 'Thu hồi quyền truy cập', 'Revoke access')}</button></div>
    </> : status === 'pending' || status === 'forwarded' ? <>
      <div className="d68-financial-request-row__controls">
        <label><input type="checkbox" checked={summary} disabled onChange={() => undefined} /> {scopeLabel('financial_summary', lang)}</label>
        <label><input type="checkbox" checked={detail} onChange={(event) => setDetail(event.target.checked)} /> {scopeLabel('financial_detail', lang)}</label>
        <label className="is-disabled"><input type="checkbox" disabled /> {scopeLabel('dataroom', lang)} · {T(lang, 'chưa mở trong Phiên D', 'not enabled in Phase D')}</label>
        <label><span>{T(lang, 'Ngày hết hạn (không bắt buộc)', 'Expiry date (optional)')}</span><input className="d68-dashboard-input" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        <label><span>{T(lang, 'Ghi chú phản hồi', 'Response note')}</span><textarea className="d68-dashboard-input" rows={2} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} /></label>
      </div>
      <div className="d68-financial-request-row__actions"><button type="button" disabled={busy} className="d68-dashboard-btn green" onClick={() => onRespond(row, 'approve', [...(summary ? ['financial_summary'] : []), ...(detail ? ['financial_detail'] : [])], expiryIso, responseNote)}>{T(lang, 'Chấp thuận yêu cầu', 'Approve request')}</button><button type="button" disabled={busy} className="d68-dashboard-btn red" onClick={() => onRespond(row, 'reject', [], null, responseNote)}>{T(lang, 'Từ chối', 'Decline')}</button></div>
    </> : null}
  </article>;
}

function FinancialRequestRows({ lang, rows, busyId, onRespond, onRevoke }: any) {
  return <div className="d68-dashboard-card d68-financial-request-list"><h2>{T(lang, 'Yêu cầu xem số liệu', 'Financial access requests')}</h2><p>{T(lang, 'Chỉ cấp số liệu theo đúng phạm vi cần thiết. Quyền Phòng dữ liệu chưa được tự động mở trong Phiên D.', 'Grant only the necessary financial scopes. Dataroom access is not automatically enabled in Phase D.')}</p>{rows.map((row: any) => <FinancialRequestRow key={row.id} lang={lang} row={row} busyId={busyId} onRespond={onRespond} onRevoke={onRevoke} />)}{!rows.length ? <div className="d68-dashboard-empty">{T(lang, 'Chưa có yêu cầu xem số liệu.', 'No financial access requests yet.')}</div> : null}</div>;
}
'''
replace_once('src/pages/BusinessDashboard.tsx',
"function BusinessBillingPanel({ lang, b, payments, profile, setMsg, setErr, onReload }: any) {",
component + "\nfunction BusinessBillingPanel({ lang, b, payments, profile, setMsg, setErr, onReload }: any) {")

css = r'''
.d68-financial-request-list { display: grid; gap: 16px; }
.d68-financial-request-row { border: 1px solid #dceaf5; border-radius: 12px; background: #f7fafc; padding: 16px; display: grid; gap: 12px; }
.d68-financial-request-row__head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.d68-financial-request-row__head div { display: grid; gap: 4px; }
.d68-financial-request-row__head small { color: #64748b; }
.d68-financial-request-row__meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.d68-financial-request-row__meta span { font-weight: 700; color: #29445f; }
.d68-financial-request-row__meta em { border: 1px solid #cfe4f0; border-radius: 999px; background: #fff; padding: 4px 8px; color: #29445f; font-size: 12px; font-style: normal; }
.d68-financial-request-row__controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
.d68-financial-request-row__controls label { display: grid; gap: 6px; color: #29445f; font-size: 13px; }
.d68-financial-request-row__controls label:has(input[type='checkbox']) { grid-template-columns: auto 1fr; align-items: center; }
.d68-financial-request-row__controls .is-disabled { opacity: .58; }
.d68-financial-request-row__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
@media (max-width: 700px) { .d68-financial-request-row__head { flex-direction: column; } .d68-financial-request-row__controls { grid-template-columns: 1fr; } .d68-financial-request-row__actions { justify-content: stretch; } .d68-financial-request-row__actions .d68-dashboard-btn { flex: 1; } }
'''
write('src/styles/components/business-financial-access.css', css)
replace_once('src/styles/index.css',
"@import './components/promotion-banner.css' layer(d68-overrides);",
"@import './components/promotion-banner.css' layer(d68-overrides);\n@import './components/business-financial-access.css' layer(d68-overrides);")

qa = r'''#!/usr/bin/env node
import fs from 'node:fs';
const failures = [];
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const service = read('src/lib/businessFinancialAccess.ts');
const detail = read('src/pages/BusinessDetail.tsx');
const investor = read('src/pages/InvestorDashboard.tsx');
const business = read('src/pages/BusinessDashboard.tsx');
const css = read('src/styles/components/business-financial-access.css');
for (const name of ['d68_request_business_financial_access','d68_respond_business_financial_request','d68_revoke_business_financial_access']) if (!service.includes(name)) failures.push(`Missing secure RPC wrapper: ${name}`);
if (detail.includes("from('request_data').insert")) failures.push('Business Detail still inserts request_data directly');
if (investor.includes("from('request_data').insert")) failures.push('Investor Dashboard still inserts request_data directly');
if (business.includes("from('request_data').update({ status: 'fulfilled'")) failures.push('Business Dashboard still marks request fulfilled directly');
for (const text of ['Yêu cầu xem số liệu','Request financial access','Đang chờ doanh nghiệp chấp thuận','Awaiting Business approval','Đã được cấp quyền','Access granted']) if (!(detail + investor + business).includes(text)) failures.push(`Missing Phase D wording: ${text}`);
for (const text of ['Chấp thuận yêu cầu','Thu hồi quyền truy cập','financial_summary','financial_detail']) if (!business.includes(text)) failures.push(`Business request UI missing: ${text}`);
if (business.includes("onRespond(row, 'approve', ['financial_summary', 'financial_detail', 'dataroom']")) failures.push('Phase D must not auto-grant Dataroom');
if (!business.includes("not enabled in Phase D") || !business.includes("chưa mở trong Phiên D")) failures.push('Dataroom boundary notice missing');
if (!css.includes('#f7fafc')) failures.push('Phase D request cards must use light blue background');
if (!service.includes('financialAccessErrorMessage')) failures.push('User-safe error mapping missing');
const pkg = JSON.parse(read('package.json') || '{}');
if (pkg.scripts?.['qa:financial-workflow-phase-d'] !== 'node scripts/deals68-business-financial-workflow-phase-d-check.mjs') failures.push('Phase D package script missing');
if (failures.length) { console.error('✗ Deals68 Financial Workflow Phase D check failed:'); failures.forEach((x) => console.error(`  - ${x}`)); process.exit(1); }
console.log('✓ Deals68 Financial Workflow Phase D contract: PASS');
'''
write('scripts/deals68-business-financial-workflow-phase-d-check.mjs', qa)
replace_once('package.json',
'    "qa:financial-ui-phase-c": "node scripts/deals68-business-financial-ui-phase-c-check.mjs"',
'    "qa:financial-ui-phase-c": "node scripts/deals68-business-financial-ui-phase-c-check.mjs",\n    "qa:financial-workflow-phase-d": "node scripts/deals68-business-financial-workflow-phase-d-check.mjs"')

print('Phase D source patch applied.')
