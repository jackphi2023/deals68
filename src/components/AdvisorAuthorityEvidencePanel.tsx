import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../lib/i18n';
import {
  downloadAuthorityEvidenceFile,
  getMyAuthorityReview,
  uploadAdvisorAuthorityEvidence,
  type AdvisorAuthorityEvidenceType,
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
    authority_approved: ['Authority đã được xác minh', 'Authority verified'],
    authority_rejected: ['Authority bị từ chối', 'Authority rejected'],
  };
  const pair = labels[type] || [type, type];
  return T(lang, pair[0], pair[1]);
}

export default function AdvisorAuthorityEvidencePanel({ assignmentId, lang }: { assignmentId: string; lang: Lang }) {
  const [review, setReview] = useState<AdvisorAuthorityReview | null>(null);
  const [documentType, setDocumentType] = useState<AdvisorAuthorityEvidenceType>('authorization_letter');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
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
      if (/Session 4 Advisor intake assignment not found/i.test(message)) {
        setAvailable(false);
        return;
      }
      setError(message || T(lang, 'Không thể tải hồ sơ authority.', 'Could not load authority review.'));
    }
  }

  useEffect(() => { void load(); }, [assignmentId]);

  const latestRequest = useMemo(() => {
    if (!review) return null;
    return [...review.review_history].reverse().find((event) => event.event_type === 'evidence_requested') || null;
  }, [review]);

  async function submit() {
    if (!file || !review?.can_upload || busy) return;
    setError('');
    setNotice('');
    if (!ALLOWED.includes(file.type)) {
      setError(T(lang, 'Chỉ chấp nhận PDF, JPEG, PNG hoặc WebP.', 'Only PDF, JPEG, PNG or WebP is allowed.'));
      return;
    }
    if (file.size < 1 || file.size > MAX_SIZE) {
      setError(T(lang, 'Kích thước file phải từ 1 byte đến 10 MB.', 'File size must be between 1 byte and 10 MB.'));
      return;
    }
    setBusy(true);
    try {
      await uploadAdvisorAuthorityEvidence({ assignmentId, documentType, file, note });
      setFile(null);
      setNote('');
      const input = document.getElementById(`d68-authority-file-${assignmentId}`) as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
      setNotice(T(lang, 'Đã nộp bằng chứng. File được khóa bất biến và đang chờ Admin thẩm định.', 'Evidence submitted. The file is immutable and awaiting Admin review.'));
    } catch (uploadError: any) {
      setError(uploadError?.message || T(lang, 'Không thể nộp bằng chứng.', 'Could not submit evidence.'));
    } finally {
      setBusy(false);
    }
  }

  async function download(evidenceId: string, bucket: string, path: string, fileName: string) {
    setDownloading(evidenceId);
    setError('');
    try {
      await downloadAuthorityEvidenceFile({ bucket, path, fileName });
    } catch (downloadError: any) {
      setError(downloadError?.message || T(lang, 'Không thể tải file.', 'Could not download file.'));
    } finally {
      setDownloading('');
    }
  }

  if (!available || !review) return null;

  return (
    <section className="d68-authority-evidence">
      <div className="d68-authority-evidence__head">
        <div>
          <b>{T(lang, 'Bằng chứng authority · Phiên 6', 'Authority evidence · Session 6')}</b>
          <span>{T(lang, 'Tài liệu riêng tư, chỉ bạn và Admin có quyền tải xuống.', 'Private evidence, downloadable only by you and Admin.')}</span>
        </div>
        <span className={`d68-authority-evidence__state is-${review.authority_status}`}>{review.authority_status}</span>
      </div>

      {latestRequest?.note ? <div className="d68-authority-evidence__request"><strong>{T(lang, 'Admin yêu cầu bổ sung:', 'Admin request:')}</strong> {latestRequest.note}</div> : null}
      {notice ? <div className="d68-authority-evidence__notice is-success">{notice}</div> : null}
      {error ? <div className="d68-authority-evidence__notice is-error">{error}</div> : null}

      {review.evidence.length ? <div className="d68-authority-evidence__files">
        {review.evidence.map((item) => <div key={item.evidence_id} className="d68-authority-evidence__file">
          <div><b>{item.original_name}</b><span>{item.document_type} · {formatSize(item.file_size_bytes)} · {formatDate(item.submitted_at, lang)}</span>{item.note ? <small>{item.note}</small> : null}</div>
          <button type="button" disabled={downloading === item.evidence_id} onClick={() => void download(item.evidence_id, item.storage_bucket, item.storage_path, item.original_name)}>{downloading === item.evidence_id ? '…' : T(lang, 'Tải xuống', 'Download')}</button>
        </div>)}
      </div> : <p className="d68-authority-evidence__empty">{T(lang, 'Chưa có bằng chứng authority đã nộp.', 'No authority evidence has been submitted yet.')}</p>}

      {review.can_upload ? <div className="d68-authority-evidence__form">
        <label><span>{T(lang, 'Loại tài liệu', 'Evidence type')}</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value as AdvisorAuthorityEvidenceType)}>{DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{T(lang, item.vi, item.en)}</option>)}</select></label>
        <label><span>{T(lang, 'File bằng chứng', 'Evidence file')}</span><input id={`d68-authority-file-${assignmentId}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label className="wide"><span>{T(lang, 'Ghi chú tùy chọn', 'Optional note')}</span><textarea rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={T(lang, 'Mô tả ngắn tài liệu và căn cứ authority', 'Briefly describe this evidence')} /></label>
        <div className="d68-authority-evidence__form-foot"><span>{T(lang, 'Tối đa 8 file · 10 MB/file · PDF/JPEG/PNG/WebP · không thể sửa/xóa sau khi nộp.', 'Up to 8 files · 10 MB/file · PDF/JPEG/PNG/WebP · immutable after submission.')}</span><button type="button" disabled={!file || busy} onClick={() => void submit()}>{busy ? T(lang, 'Đang tải…', 'Uploading…') : T(lang, 'Nộp bằng chứng', 'Submit evidence')}</button></div>
      </div> : <div className="d68-authority-evidence__closed">{T(lang, 'Kênh nộp bằng chứng đã đóng vì authority không còn ở trạng thái chờ Admin duyệt.', 'Evidence submission is closed because authority is no longer pending Admin review.')}</div>}

      {review.review_history.length ? <details className="d68-authority-evidence__history"><summary>{T(lang, 'Lịch sử thẩm định', 'Review history')} ({review.review_history.length})</summary><ol>{review.review_history.map((event) => <li key={event.event_id}><div><b>{eventLabel(event.event_type, lang)}</b><span>{formatDate(event.created_at, lang)}</span></div>{event.note ? <p>{event.note}</p> : null}</li>)}</ol></details> : null}
    </section>
  );
}
