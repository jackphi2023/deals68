import type {
  BusinessReportArtifact,
  ReportAudience,
  ReportContent,
  ReportFreshness,
  ReportLang,
  ReportPreflight,
} from './reportTypes';

export type ReportSubject = {
  audience: ReportAudience;
  businessId: string;
  actorId?: string | null;
  scopeKey?: string | null;
};

export type ReportRuntimeAdapter<TArtifact extends BusinessReportArtifact = BusinessReportArtifact> = {
  audience: ReportAudience;
  getLatest(subject: ReportSubject): Promise<TArtifact | null>;
  getContent(subject: ReportSubject, artifact: TArtifact): Promise<ReportContent | null>;
};

const reportContentCache = new Map<string, Promise<ReportContent | null>>();

export const T = (lang: ReportLang, vi: string, en: string) =>
  lang === 'en' ? en : vi;

export function reportSessionKey(subject: ReportSubject, reportId: string) {
  return [subject.audience, subject.businessId, subject.actorId || 'self', subject.scopeKey || 'full', reportId]
    .join(':');
}

export function getSessionCachedReportContent(
  key: string,
  loader: () => Promise<ReportContent | null>,
) {
  const cached = reportContentCache.get(key);
  if (cached) return cached;
  const request = loader().catch((error) => {
    reportContentCache.delete(key);
    throw error;
  });
  reportContentCache.set(key, request);
  return request;
}

export function clearSessionReportContent(key?: string) {
  if (key) reportContentCache.delete(key);
  else reportContentCache.clear();
}

function errorValue(error: unknown, key: string) {
  if (!error || typeof error !== 'object') return '';
  return String((error as Record<string, unknown>)[key] ?? '').trim();
}

const ERROR_COPY: Record<string, [string, string]> = {
  AUTHORIZATION_REQUIRED: [
    'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
    'Your session is invalid. Please sign in again.',
  ],
  AUTHENTICATION_REQUIRED: [
    'Bạn cần đăng nhập để sử dụng báo cáo.',
    'You must be signed in to use reports.',
  ],
  DOCUMENT_PROCESSING_PENDING: [
    'Tài liệu đang chờ xử lý. Báo cáo có thể tạo sau khi hệ thống đọc xong tài liệu.',
    'Documents are awaiting processing. The report can be created after processing finishes.',
  ],
  DOCUMENT_BACKED_REVENUE_MISSING: [
    'Doanh thu hiện là dữ liệu tự kê khai hoặc chưa đủ độ tin cậy; báo cáo không dùng số này để định giá.',
    'Revenue is self-declared or insufficiently supported; it will not be used for valuation.',
  ],
  RATE_LIMITED: [
    'Bạn đã đạt giới hạn 01 lần trong 60 phút. Vui lòng thử lại sau.',
    'You reached the 1-action-per-60-minute limit. Please try again later.',
  ],
  REPORT_REQUEST_REJECTED: [
    'Yêu cầu tạo báo cáo chưa được chấp nhận.',
    'The report request was not accepted.',
  ],
  PREFLIGHT_BLOCKED_AFTER_RESERVATION: [
    'Dữ liệu thay đổi trong lúc xử lý và hiện chưa đủ điều kiện tạo báo cáo.',
    'The data changed during processing and no longer meets report requirements.',
  ],
  REPORT_NOT_FOUND: [
    'Không tìm thấy báo cáo hoặc bạn không có quyền truy cập.',
    'The report was not found or you do not have access.',
  ],
  REPORT_PDF_SIZE_INVALID: [
    'File báo cáo vượt giới hạn cho phép hoặc không hợp lệ.',
    'The report file is invalid or exceeds the allowed size.',
  ],
  SIGNED_URL_FAILED: [
    'Không thể tạo liên kết tải xuống an toàn.',
    'A secure download link could not be created.',
  ],
  SUPABASE_FUNCTION_ENV_MISSING: [
    'Dịch vụ tạo báo cáo chưa được cấu hình đầy đủ.',
    'The report service is not fully configured.',
  ],
  REPORT_WORKER_FAILED: [
    'Dịch vụ tạo báo cáo tạm thời chưa xử lý được yêu cầu.',
    'The report service could not process the request.',
  ],
};

export function reportErrorText(
  error: unknown,
  lang: ReportLang,
  fallbackVi: string,
  fallbackEn: string,
) {
  const code = errorValue(error, 'error') || errorValue(error, 'code') || errorValue(error, 'name');
  const mapped = ERROR_COPY[code];
  if (mapped) return T(lang, mapped[0], mapped[1]);
  const message = errorValue(error, 'message');
  return message || T(lang, fallbackVi, fallbackEn);
}

function timestamp(value: string | null | undefined) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function resolveReportFreshness(params: {
  artifact: BusinessReportArtifact;
  preflight?: ReportPreflight | null;
  businessUpdatedAt?: string | null;
  fileUpdatedAt?: string | null;
}): ReportFreshness {
  const { artifact, preflight, businessUpdatedAt, fileUpdatedAt } = params;
  if (
    artifact.source_hash &&
    preflight?.source_hash &&
    artifact.source_hash !== preflight.source_hash
  ) {
    return {
      stale: true,
      source_updated_at: preflight.checked_at || businessUpdatedAt || fileUpdatedAt || null,
      reason: 'source_hash_changed',
    };
  }

  const generatedAt = timestamp(artifact.generated_at);
  const businessAt = timestamp(businessUpdatedAt);
  const fileAt = timestamp(fileUpdatedAt);
  if (businessAt > generatedAt) {
    return { stale: true, source_updated_at: businessUpdatedAt, reason: 'business_updated' };
  }
  if (fileAt > generatedAt) {
    return { stale: true, source_updated_at: fileUpdatedAt, reason: 'file_updated' };
  }
  return {
    stale: false,
    source_updated_at: fileAt >= businessAt ? fileUpdatedAt || null : businessUpdatedAt || null,
    reason: null,
  };
}
