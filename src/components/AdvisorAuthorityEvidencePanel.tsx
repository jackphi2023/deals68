import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../lib/i18n';
import {
  acknowledgeAdvisorAuthorityAlert,
  downloadAuthorityEvidenceFile,
  getMyAuthorityReview,
  updateAdvisorAuthorityNotificationPreferences,
  uploadAdvisorAuthorityEvidence,
  type AdvisorAuthorityEvidence,
  type AdvisorAuthorityEvidenceType,
  type AdvisorAuthorityNotificationPreferences,
  type AdvisorAuthorityReview,
} from '../lib/advisorAuthorityEvidence';
import '../styles/pages/advisor-authority-evidence.css';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const DOCUMENT_TYPES: Array<{ value: AdvisorAuthorityEvidenceType; vi: string; en: string }> = [
  { value: 'authorization_letter', vi: 'Thư / giấy ủy quyền', en: 'Authorization letter' },
  { value: 'mandate', vi: 'Hợp đồng / mandate', en: 'Mandate / engagement' },
  { value: 'ownership_proof', vi: 'Bằng chứng quyền sở hữu', en: 'Ownership evidence' },
  { value: 'identity', vi: 'Tài liệu định danh', en: 'Identity document' },
  { value: 'other', vi: 'Tài liệu khác', en: 'Other evidence' },
];

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatSize(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function eventLabel(type: string, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    intake_created: ['Đã tạo Business intake', 'Business intake created'],
    evidence_submitted: ['Advisor đã nộp bằng chứng', 'Advisor submitted evidence'],
    evidence_requested: ['Admin yêu cầu bổ sung', 'Admin requested more evidence'],
    evidence_validated: ['Admin đã thẩm định một tài liệu', 'Admin validated an evidence file'],
    evidence_replacement_requested: ['Admin yêu cầu thay thế tài liệu', 'Admin requested replacement evidence'],
    authority_approved: ['Authority đã được xác minh', 'Authority verified'],
    authority_rejected: ['Authority bị từ chối', 'Authority rejected'],
    authority_rereview_started: ['Authority được mở tái thẩm định', 'Authority re-review started'],
    authority_rereview_approved: ['Tái thẩm định authority được duyệt', 'Authority re-review approved'],
    authority_rereview_rejected: ['Tái thẩm định authority bị từ chối', 'Authority re-review rejected'],
  };
  const pair = labels[type] || [type, type];
  return T(lang, pair[0], pair[1]);
}

function validationLabel(value: string, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    unreviewed: ['Chưa thẩm định', 'Unreviewed'], valid: ['Hợp lệ', 'Valid'],
    insufficient: ['Chưa đủ', 'Insufficient'], invalid: ['Không hợp lệ', 'Invalid'],
  };
  const pair = labels[value] || [value, value];
  return T(lang, pair[0], pair[1]);
}

function lifecycleLabel(value: string, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    initial_pending: ['Đang thẩm định lần đầu', 'Initial review pending'],
    rereview_pending: ['Đang tái thẩm định', 'Re-review pending'],
    verified_current: ['Authority còn hiệu lực', 'Authority current'],
    expiring_soon: ['Authority sắp hết hạn', 'Authority expiring soon'],
    expired: ['Authority đã hết hạn', 'Authority expired'],
    rejected: ['Authority bị từ chối', 'Authority rejected'],
  };
  const pair = labels[value] || [value, value];
  return T(lang, pair[0], pair[1]);
}

function deliveryLabel(status: string, lang: Lang) {
  const labels: Record<string, [string, string]> = {
    pending: ['Đang chờ gửi', 'Queued'], processing: ['Đang gửi', 'Sending'], sent: ['Đã gửi', 'Sent'],
    failed: ['Sẽ thử lại', 'Retry scheduled'], exhausted: ['Gửi thất bại', 'Delivery exhausted'],
  };
  const pair = labels[status] || [status, status];
  return T(lang, pair[0], pair[1]);
}

export default function AdvisorAuthorityEvidencePanel({ assignmentId, lang }: { assignmentId: string; lang: Lang }) {
  const [review, setReview] = useState<AdvisorAuthorityReview | null>(null);
  const [documentType, setDocumentType] = useState<AdvisorAuthorityEvidenceType>('authorization_letter');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [replacementTarget, setReplacementTarget] = useState<AdvisorAuthorityEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [available, setAvailable] = useState(true);

  async function load() {
    try {
      const data = await getMyAuthorityReview(assignmentId);
      setReview(data);
      setAvailable(true);
    } catch (loadError: any) {
      const message = String(loadError?.message || '');
      if (/Session 4 Advisor intake assignment not found/i.test(message)) { setAvailable(false); return; }
      setError(message || T(lang, 'Không thể tải hồ sơ authority.', 'Could not load authority review.'));
    }
  }

  useEffect(() => { void load(); }, [assignmentId]);

  const latestRequest = useMemo(() => {
    if (!review) return null;
    return [...review.review_history].reverse().find((event) => event.event_type === 'evidence_requested') || null;
  }, [review]);

  const replacementRequests = useMemo(() => {
    const map = new Map<string, string>();
    if (!review) return map;
    review.review_history.forEach((event) => {
      if (event.event_type === 'evidence_replacement_requested' && event.evidence_id && event.note) map.set(event.evidence_id, event.note);
    });
    return map;
  }, [review]);

  function chooseReplacement(item: AdvisorAuthorityEvidence) {
    if (!review?.can_upload || item.superseded_at || !['insufficient', 'invalid'].includes(item.validation_status)) return;
    setReplacementTarget(item);
    setDocumentType(item.document_type);
    setFile(null);
    setNote('');
    setError('');
    setNotice(T(lang, `Đang chuẩn bị file thay thế cho ${item.original_name}.`, `Preparing replacement for ${item.original_name}.`));
    window.setTimeout(() => document.getElementById(`d68-authority-file-${assignmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
  }

  async function acknowledgeAlert() {
    if (!review?.expiry_alert || review.expiry_alert.acknowledged || alertBusy) return;
    setAlertBusy(true);
    setError('');
    try {
      await acknowledgeAdvisorAuthorityAlert({ assignmentId, alertKey: review.expiry_alert.key });
      await load();
      setNotice(T(lang, 'Đã ghi nhận bạn đã xem cảnh báo authority. Việc xác nhận này không gia hạn authority hoặc thay đổi quyền truy cập.', 'Authority alert acknowledged. This does not renew authority or change access.'));
    } catch (ackError: any) {
      setError(ackError?.message || T(lang, 'Không thể xác nhận cảnh báo authority.', 'Could not acknowledge authority alert.'));
    } finally { setAlertBusy(false); }
  }

  async function savePreferences(next: AdvisorAuthorityNotificationPreferences) {
    if (preferencesBusy) return;
    setPreferencesBusy(true);
    setError('');
    setNotice('');
    try {
      await updateAdvisorAuthorityNotificationPreferences(next);
      await load();
      setNotice(T(lang, 'Đã cập nhật tùy chọn email authority. Tùy chọn này chỉ ảnh hưởng việc gửi email, không thay đổi hiệu lực authority hoặc Business access.', 'Authority email preferences updated. These settings affect delivery only, not authority validity or Business access.'));
    } catch (preferenceError: any) {
      setError(preferenceError?.message || T(lang, 'Không thể cập nhật tùy chọn email.', 'Could not update email preferences.'));
    } finally { setPreferencesBusy(false); }
  }

  function togglePreference(key: keyof AdvisorAuthorityNotificationPreferences) {
    if (!review || key === 'updated_at') return;
    const current = review.notification_preferences;
    void savePreferences({ ...current, [key]: !current[key] });
  }

  async function submit() {
    if (!file || !review?.can_upload || busy) return;
    setError(''); setNotice('');
    if (!ALLOWED.includes(file.type)) { setError(T(lang, 'Chỉ chấp nhận PDF, JPEG, PNG hoặc WebP.', 'Only PDF, JPEG, PNG or WebP is allowed.')); return; }
    if (file.size < 1 || file.size > MAX_SIZE) { setError(T(lang, 'Kích thước file phải từ 1 byte đến 10 MB.', 'File size must be between 1 byte and 10 MB.')); return; }
    setBusy(true);
    try {
      await uploadAdvisorAuthorityEvidence({ assignmentId, documentType, file, note, replacesEvidenceId: replacementTarget?.evidence_id || null });
      const replacedName = replacementTarget?.original_name;
      setFile(null); setNote(''); setReplacementTarget(null);
      const input = document.getElementById(`d68-authority-file-${assignmentId}`) as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
      setNotice(replacedName
        ? T(lang, `Đã nộp file thay thế cho ${replacedName}. File cũ vẫn được giữ trong audit trail nhưng không còn là bằng chứng hiện hành.`, `Replacement submitted for ${replacedName}. The prior file stays in the audit trail but is no longer current evidence.`)
        : T(lang, 'Đã nộp bằng chứng. File được khóa bất biến và đang chờ Admin thẩm định.', 'Evidence submitted. The file is immutable and awaiting Admin review.'));
    } catch (uploadError: any) {
      setError(uploadError?.message || T(lang, 'Không thể nộp bằng chứng.', 'Could not submit evidence.'));
    } finally { setBusy(false); }
  }

  async function download(item: AdvisorAuthorityEvidence) {
    setDownloading(item.evidence_id); setError('');
    try { await downloadAuthorityEvidenceFile({ bucket: item.storage_bucket, path: item.storage_path, fileName: item.original_name }); }
    catch (downloadError: any) { setError(downloadError?.message || T(lang, 'Không thể tải file.', 'Could not download file.')); }
    finally { setDownloading(''); }
  }

  if (!available || !review) return null;

  const lifecycle = review.authority_lifecycle_status || review.authority_status;
  const rereviewPending = review.current_rereview?.status === 'pending';
  const alert = review.expiry_alert;
  const preferences = review.notification_preferences;
  const delivery = review.current_notification_delivery;
  const emailOptions: Array<[keyof AdvisorAuthorityNotificationPreferences, string, string]> = [
    ['email_expiry_30d', 'Trước 30 ngày', '30 days before expiry'],
    ['email_expiry_14d', 'Trước 14 ngày', '14 days before expiry'],
    ['email_expiry_7d', 'Trước 7 ngày', '7 days before expiry'],
    ['email_expired', 'Khi đã hết hạn', 'When expired'],
    ['email_rereview_pending', 'Khi mở tái thẩm định', 'When re-review starts'],
  ];

  return (
    <section className="d68-authority-evidence">
      <div className="d68-authority-evidence__head">
        <div>
          <b>{T(lang, 'Authority evidence, cảnh báo & email vận hành · Phiên 9', 'Authority evidence, alerts & operational email · Session 9')}</b>
          <span>{T(lang, 'Cảnh báo vẫn do server tính theo lifecycle. Phiên 9 thêm email có kiểm soát; SMS/push chưa bật. Tài liệu riêng tư và file đã nộp vẫn bất biến.', 'Alerts remain server-derived from the authority lifecycle. Session 9 adds controlled email delivery; SMS/push remain off. Evidence stays private and immutable after submission.')}</span>
        </div>
        <span className={`d68-authority-evidence__state is-${review.authority_status}`}>{lifecycleLabel(lifecycle, lang)}</span>
      </div>

      {alert ? <div className={`d68-authority-evidence__request is-${alert.severity}`}>
        <strong>{lang === 'en' ? alert.title_en : alert.title_vi}</strong>
        <span> {lang === 'en' ? alert.message_en : alert.message_vi}</span>
        {alert.authority_expires_at ? <small> · {T(lang, 'Hết hạn', 'Expires')}: {formatDate(alert.authority_expires_at, lang)}</small> : null}
        {alert.acknowledged ? <small> · {T(lang, 'Đã xem', 'Acknowledged')} {formatDate(alert.acknowledged_at, lang)}</small> : <button type="button" disabled={alertBusy} onClick={() => void acknowledgeAlert()}>{alertBusy ? '…' : T(lang, 'Đã xem cảnh báo', 'Acknowledge alert')}</button>}
      </div> : null}

      <div className="d68-authority-evidence__notifications">
        <div className="d68-authority-evidence__notifications-head">
          <div><strong>{T(lang, 'Tùy chọn email authority', 'Authority email preferences')}</strong><span>{T(lang, 'Email vận hành, không phải marketing. Dedupe theo exact alert; tối đa 6 email authority/24h/Advisor.', 'Operational email, not marketing. Exact-alert dedupe; maximum 6 authority emails per Advisor per 24 hours.')}</span></div>
          <label><input type="checkbox" checked={preferences.email_enabled} disabled={preferencesBusy} onChange={() => togglePreference('email_enabled')} /> {T(lang, 'Nhận email', 'Email enabled')}</label>
        </div>
        <div className="d68-authority-evidence__notification-options">
          {emailOptions.map(([key, vi, en]) => <label key={key}><input type="checkbox" checked={Boolean(preferences[key])} disabled={!preferences.email_enabled || preferencesBusy} onChange={() => togglePreference(key)} /> {T(lang, vi, en)}</label>)}
        </div>
        {delivery ? <div className={`d68-authority-evidence__delivery is-${delivery.status}`}><strong>{T(lang, 'Email cho cảnh báo hiện tại', 'Email for current alert')}: {deliveryLabel(delivery.status, lang)}</strong><span>{delivery.sent_at ? `${T(lang, 'Đã gửi', 'Sent')} ${formatDate(delivery.sent_at, lang)}` : delivery.next_attempt_at ? `${T(lang, 'Lần thử tiếp', 'Next attempt')} ${formatDate(delivery.next_attempt_at, lang)}` : `${T(lang, 'Số lần thử', 'Attempts')}: ${delivery.attempt_count}`}</span></div> : null}
        <small>{T(lang, 'Tắt email không làm authority hợp lệ hơn hoặc kém đi; authority hết hạn/re-review vẫn khóa Business context theo server.', 'Turning email off never changes authority validity; expiry/re-review still closes Business context according to server rules.')}</small>
      </div>

      {rereviewPending ? <div className="d68-authority-evidence__rereview"><strong>{T(lang, `Tái thẩm định vòng ${review.current_rereview?.cycle_no}`, `Re-review cycle ${review.current_rereview?.cycle_no}`)}</strong><span>{review.current_rereview?.reason}</span><small>{T(lang, 'Quyền mở Business context tạm đóng cho đến khi Admin duyệt lại authority.', 'Business context access is suspended until Admin re-approves authority.')}</small></div> : null}
      {review.authority_expires_at ? <div className="d68-authority-evidence__expiry">{T(lang, 'Authority hết hạn', 'Authority expires')}: <b>{formatDate(review.authority_expires_at, lang)}</b></div> : null}
      {latestRequest?.note ? <div className="d68-authority-evidence__request"><strong>{T(lang, 'Admin yêu cầu bổ sung:', 'Admin request:')}</strong> {latestRequest.note}</div> : null}
      {notice ? <div className="d68-authority-evidence__notice is-success">{notice}</div> : null}
      {error ? <div className="d68-authority-evidence__notice is-error">{error}</div> : null}

      {review.evidence.length ? <div className="d68-authority-evidence__files">
        {review.evidence.map((item) => {
          const replaceable = review.can_upload && !item.superseded_at && ['insufficient', 'invalid'].includes(item.validation_status);
          return <div key={item.evidence_id} className={`d68-authority-evidence__file ${item.superseded_at ? 'is-superseded' : ''}`}>
            <div><b>{item.original_name}</b><span>{item.document_type} · {formatSize(item.file_size_bytes)} · {formatDate(item.submitted_at, lang)}</span><span className={`d68-authority-evidence__validation is-${item.validation_status}`}>{validationLabel(item.validation_status, lang)}</span>{item.note ? <small>{item.note}</small> : null}{replacementRequests.get(item.evidence_id) ? <small className="is-request">{T(lang, 'Yêu cầu thay thế:', 'Replacement request:')} {replacementRequests.get(item.evidence_id)}</small> : null}{item.superseded_at ? <small className="is-superseded">{T(lang, `Đã được thay thế ${formatDate(item.superseded_at, lang)}`, `Superseded ${formatDate(item.superseded_at, lang)}`)}</small> : null}{item.replaces_evidence_id ? <small>{T(lang, 'Đây là file thay thế cho bằng chứng trước.', 'This file replaces prior evidence.')}</small> : null}</div>
            <div className="d68-authority-evidence__file-actions"><button type="button" disabled={downloading === item.evidence_id} onClick={() => void download(item)}>{downloading === item.evidence_id ? '…' : T(lang, 'Tải xuống', 'Download')}</button>{replaceable ? <button className="is-replace" type="button" onClick={() => chooseReplacement(item)}>{T(lang, 'Nộp file thay thế', 'Replace file')}</button> : null}</div>
          </div>;
        })}
      </div> : <p className="d68-authority-evidence__empty">{T(lang, 'Chưa có bằng chứng authority đã nộp.', 'No authority evidence has been submitted yet.')}</p>}

      {review.can_upload ? <div className="d68-authority-evidence__form">
        {replacementTarget ? <div className="d68-authority-evidence__replacement-target"><span>{T(lang, 'Đang thay thế', 'Replacing')}</span><b>{replacementTarget.original_name}</b><button type="button" onClick={() => setReplacementTarget(null)}>{T(lang, 'Hủy', 'Cancel')}</button></div> : null}
        <label><span>{T(lang, 'Loại tài liệu', 'Evidence type')}</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value as AdvisorAuthorityEvidenceType)}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}</select></label>
        <label><span>{T(lang, 'File bằng chứng', 'Evidence file')}</span><input id={`d68-authority-file-${assignmentId}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label className="wide"><span>{T(lang, 'Ghi chú tùy chọn', 'Optional note')}</span><textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={T(lang, 'Mô tả ngắn tài liệu và căn cứ authority', 'Briefly describe this evidence')} /></label>
        <div className="d68-authority-evidence__form-foot"><span>{T(lang, 'Tối đa 8 bằng chứng hiện hành · 10 MB/file · PDF/JPEG/PNG/WebP · file bất biến sau khi nộp.', 'Up to 8 current evidence files · 10 MB/file · PDF/JPEG/PNG/WebP · immutable after submission.')}</span><button type="button" disabled={!file || busy} onClick={() => void submit()}>{busy ? T(lang, 'Đang tải…', 'Uploading…') : replacementTarget ? T(lang, 'Nộp file thay thế', 'Submit replacement') : T(lang, 'Nộp bằng chứng', 'Submit evidence')}</button></div>
      </div> : <div className="d68-authority-evidence__closed">{T(lang, 'Kênh nộp bằng chứng hiện đóng. Chỉ mở trong lần thẩm định đầu hoặc một vòng tái thẩm định đang chờ xử lý.', 'Evidence submission is closed. It opens only during initial review or a pending re-review cycle.')}</div>}

      {review.review_history.length ? <details className="d68-authority-evidence__history"><summary>{T(lang, 'Lịch sử thẩm định', 'Review history')} ({review.review_history.length})</summary><ol>{review.review_history.map((event) => <li key={event.event_id}><div><b>{eventLabel(event.event_type, lang)}</b><span>{formatDate(event.created_at, lang)}</span></div>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></details> : null}
    </section>
  );
}
