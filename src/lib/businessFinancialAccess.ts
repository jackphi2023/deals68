import { supabase } from './supabase';
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
