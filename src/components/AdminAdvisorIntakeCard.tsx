import { useState } from 'react';
import {
  downloadAdminAuthorityEvidence,
  type AdminAdvisorIntake,
  type AdminAuthorityEvidence,
  type AdminEvidenceValidationStatus,
} from '../lib/adminAdvisorIntakes';
import '../styles/pages/admin-advisor-authority-evidence.css';

export const STATUS_LABELS = {
  pending_review: 'Chờ Admin duyệt',
  approved_awaiting_acceptance: 'Đã duyệt · Chờ Advisor chấp nhận',
  accepted: 'Advisor đã chấp nhận',
  rejected: 'Đã từ chối',
} as const;

export function titleOf(row: AdminAdvisorIntake) {
  return row.business.company_name || row.business.title_vi || row.business.title_en || row.business.public_code || 'Business intake';
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function sizeLabel(value?: number | null) {
  if (!Number.isFinite(Number(value))) return '—';
  const bytes = Number(value);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return <div><dt>{label}</dt><dd>{value || '—'}</dd></div>;
}

function historyLabel(value: string) {
  const labels: Record<string, string> = {
    intake_created: 'Business intake được tạo',
    evidence_submitted: 'Advisor nộp bằng chứng',
    evidence_requested: 'Admin yêu cầu bổ sung',
    evidence_validated: 'Admin thẩm định bằng chứng',
    evidence_replacement_requested: 'Admin yêu cầu thay file',
    authority_approved: 'Authority được xác minh',
    authority_rejected: 'Authority bị từ chối',
    authority_rereview_started: 'Bắt đầu tái thẩm định authority',
    authority_rereview_approved: 'Tái thẩm định được duyệt',
    authority_rereview_rejected: 'Tái thẩm định bị từ chối',
  };
  return labels[value] || value;
}

function validationLabel(value: string) {
  const labels: Record<string, string> = {
    unreviewed: 'Chưa thẩm định',
    valid: 'Hợp lệ',
    insufficient: 'Chưa đủ',
    invalid: 'Không hợp lệ',
  };
  return labels[value] || value;
}

function lifecycleLabel(value?: string) {
  const labels: Record<string, string> = {
    initial_pending: 'Thẩm định lần đầu',
    rereview_pending: 'Đang tái thẩm định',
    verified_current: 'Authority còn hiệu lực',
    expiring_soon: 'Authority sắp hết hạn',
    expired: 'Authority hết hạn',
    rejected: 'Authority bị từ chối',
  };
  return labels[value || ''] || value || '—';
}

export default function AdminAdvisorIntakeCard({
  row,
  note,
  expiry,
  busy,
  onNote,
  onExpiry,
  onDecision,
  onRequestEvidence,
  onValidateEvidence,
  onStartRereview,
  onReviewRereview,
}: {
  row: AdminAdvisorIntake;
  note: string;
  expiry: string;
  busy: boolean;
  onNote: (value: string) => void;
  onExpiry: (value: string) => void;
  onDecision: (decision: 'approve' | 'reject') => void;
  onRequestEvidence: () => void;
  onValidateEvidence: (item: AdminAuthorityEvidence, status: Exclude<AdminEvidenceValidationStatus, 'unreviewed'>, note: string, requestReplacement: boolean) => void;
  onStartRereview: () => void;
  onReviewRereview: (decision: 'approve' | 'reject') => void;
}) {
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [validationNotes, setValidationNotes] = useState<Record<string, string>>({});
  const evidence = row.evidence || [];
  const history = row.review_history || [];
  const summary = row.evidence_validation_summary || { unreviewed: 0, valid: 0, insufficient: 0, invalid: 0 };
  const rereviewPending = row.current_rereview?.status === 'pending';

  async function download(item: AdminAuthorityEvidence) {
    setDownloadingId(item.evidence_id);
    setDownloadError('');
    try {
      await downloadAdminAuthorityEvidence(item);
    } catch (error: any) {
      setDownloadError(error?.message || 'Không thể tải bằng chứng authority.');
    } finally {
      setDownloadingId('');
    }
  }

  function validate(item: AdminAuthorityEvidence, status: Exclude<AdminEvidenceValidationStatus, 'unreviewed'>, replacement = false) {
    const evidenceNote = (validationNotes[item.evidence_id] || '').trim();
    onValidateEvidence(item, status, evidenceNote, replacement);
  }

  return (
    <article className="d68-admin-intakes__card">
      <div className="d68-admin-intakes__card-head">
        <div>
          <div className="d68-admin-authority-evidence__status-row">
            <span className={`d68-admin-intakes__status is-${row.review_status}`}>{STATUS_LABELS[row.review_status]}</span>
            <span className={`d68-admin-authority-evidence__lifecycle is-${row.authority_lifecycle_status}`}>{lifecycleLabel(row.authority_lifecycle_status)}</span>
          </div>
          <h2>{titleOf(row)}</h2>
          <p>{row.business.public_code || 'Chưa có mã'} · {row.business.industry || 'Chưa phân ngành'} · {row.business.city || row.business.country_iso2 || 'Chưa có địa điểm'}</p>
        </div>
        <div className="d68-admin-intakes__submitted">Gửi: {dateLabel(row.submitted_at)}</div>
      </div>

      <div className="d68-admin-intakes__grid">
        <section>
          <h3>Hồ sơ doanh nghiệp / Business profile</h3>
          <dl>
            <Field label="Tiêu đề" value={row.business.title_vi || row.business.title_en} />
            <Field label="Loại giao dịch" value={row.business.deal_type} />
            <Field label="Trạng thái" value={`${row.business.status || '—'} / ${row.business.moderation_status || '—'}`} />
            <Field label="Ownership" value={row.business.owner_id ? 'Đã có owner' : 'Ownerless'} />
            <Field label="Public" value={row.business.visible ? 'Đang hiển thị' : 'Không công khai'} />
          </dl>
          <p className="d68-admin-intakes__description">{row.business.description_vi || row.business.description_en || 'Không có mô tả.'}</p>
        </section>
        <section>
          <h3>Advisor/Broker</h3>
          <dl>
            <Field label="Người gửi" value={row.advisor.display_name || row.advisor.email} />
            <Field label="Đơn vị" value={row.advisor.company_name} />
            <Field label="Loại hồ sơ" value={row.advisor.advisor_type} />
            <Field label="Xác minh Advisor" value={row.advisor.verification_status} />
          </dl>
        </section>
        <section>
          <h3>Authority khai báo</h3>
          <dl>
            <Field label="Loại quyền" value={row.authority.listing_party_type} />
            <Field label="Chủ DN/tài sản" value={row.authority.declared_owner_name} />
            <Field label="Người ủy quyền" value={row.authority.declared_principal_name} />
            <Field label="Đại diện" value={row.authority.declared_agent_name} />
            <Field label="Authority hết hạn" value={dateLabel(row.authority.expires_at)} />
          </dl>
        </section>
      </div>

      {rereviewPending ? <section className="d68-admin-authority-evidence__rereview">
        <div><strong>Tái thẩm định vòng {row.current_rereview?.cycle_no}</strong><span>{row.current_rereview?.reason}</span></div>
        <small>Business context của Advisor bị khóa bởi authority=pending_review; assignment không được cấp thêm scope.</small>
      </section> : null}

      <section className="d68-admin-authority-evidence">
        <div className="d68-admin-authority-evidence__head">
          <div><h3>Bằng chứng authority</h3><p>Private · file bất biến sau khi nộp · Admin chỉ cập nhật metadata thẩm định và replacement linkage.</p></div>
          <b>{row.evidence_count || 0} hiện hành / {row.total_evidence_count || evidence.length} tổng</b>
        </div>
        <div className="d68-admin-authority-evidence__summary">
          <span>Chưa duyệt <b>{summary.unreviewed}</b></span><span>Hợp lệ <b>{summary.valid}</b></span><span>Chưa đủ <b>{summary.insufficient}</b></span><span>Không hợp lệ <b>{summary.invalid}</b></span>
        </div>
        {downloadError ? <div className="d68-admin-authority-evidence__error">{downloadError}</div> : null}
        {evidence.length ? <div className="d68-admin-authority-evidence__files">{evidence.map((item) => {
          const current = !item.superseded_at;
          return <div className={`d68-admin-authority-evidence__file ${current ? '' : 'is-superseded'}`} key={item.evidence_id}>
            <div className="d68-admin-authority-evidence__file-main">
              <div><b>{item.original_name}</b><span>{item.document_type} · {sizeLabel(item.file_size_bytes)} · {dateLabel(item.submitted_at)}</span>{item.note ? <small>{item.note}</small> : null}</div>
              <span className={`d68-admin-authority-evidence__validation is-${item.validation_status}`}>{validationLabel(item.validation_status)}</span>
              {item.validation_note ? <small className="d68-admin-authority-evidence__admin-note">Admin: {item.validation_note}</small> : null}
              {item.superseded_at ? <small>Đã supersede: {dateLabel(item.superseded_at)}</small> : null}
              {item.replaces_evidence_id ? <small>Replacement của evidence {item.replaces_evidence_id.slice(0, 8)}…</small> : null}
            </div>
            <div className="d68-admin-authority-evidence__file-actions"><button type="button" disabled={downloadingId === item.evidence_id} onClick={() => void download(item)}>{downloadingId === item.evidence_id ? 'Đang tải…' : 'Tải file'}</button></div>
            {current && row.can_validate_evidence ? <div className="d68-admin-authority-evidence__validation-form">
              <textarea rows={2} maxLength={2000} value={validationNotes[item.evidence_id] || ''} onChange={(event) => setValidationNotes((currentNotes) => ({ ...currentNotes, [item.evidence_id]: event.target.value }))} placeholder="Căn cứ thẩm định; bắt buộc tối thiểu 5 ký tự nếu chưa đủ/không hợp lệ" />
              <div><button type="button" disabled={busy} className="is-valid" onClick={() => validate(item, 'valid')}>Hợp lệ</button><button type="button" disabled={busy} className="is-insufficient" onClick={() => validate(item, 'insufficient')}>Chưa đủ</button><button type="button" disabled={busy} className="is-invalid" onClick={() => validate(item, 'invalid')}>Không hợp lệ</button><button type="button" disabled={busy} className="is-replace" onClick={() => validate(item, item.validation_status === 'invalid' ? 'invalid' : 'insufficient', true)}>Yêu cầu file thay thế</button></div>
            </div> : null}
          </div>;
        })}</div> : <p className="d68-admin-authority-evidence__empty">Advisor chưa nộp bằng chứng authority.</p>}

        {history.length ? <details className="d68-admin-authority-evidence__history"><summary>Lịch sử thẩm định ({history.length})</summary><ol>{history.map((event) => <li key={event.event_id}><div><b>{historyLabel(event.event_type)}</b><span>{dateLabel(event.created_at)}</span></div>{event.note ? <p>{event.note}{event.note_visible_to_advisor ? <em> · Advisor thấy ghi chú này</em> : <em> · Ghi chú nội bộ Admin</em>}</p> : null}</li>)}</ol></details> : null}
      </section>

      {row.can_review ? (
        <div className="d68-admin-intakes__review">
          <label><span>Thời hạn authority và assignment</span><input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)} value={expiry} onChange={(event) => onExpiry(event.target.value)} /></label>
          <label><span>Scope được duyệt</span><div className="d68-admin-intakes__scope"><input type="checkbox" checked readOnly /> Hồ sơ doanh nghiệp / Business profile</div></label>
          <label className="d68-admin-intakes__note"><span>Ghi chú Admin; bắt buộc khi từ chối hoặc yêu cầu bổ sung</span><textarea rows={3} maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Nêu căn cứ xác minh, yêu cầu tài liệu hoặc lý do từ chối authority" /></label>
          <div className="d68-admin-intakes__actions d68-admin-intakes__actions--session7">
            <button className="is-request" type="button" disabled={busy || !row.can_request_evidence} onClick={onRequestEvidence}>{busy ? 'Đang xử lý…' : 'Yêu cầu bổ sung bằng chứng'}</button>
            <button className="is-reject" type="button" disabled={busy} onClick={() => onDecision('reject')}>{busy ? 'Đang xử lý…' : 'Từ chối authority'}</button>
            <button className="is-approve" type="button" disabled={busy} onClick={() => onDecision('approve')}>{busy ? 'Đang xử lý…' : 'Xác minh & cho phép Advisor chấp nhận'}</button>
          </div>
        </div>
      ) : null}

      {!row.can_review && row.can_start_rereview ? <div className="d68-admin-authority-evidence__rereview-action">
        <label><span>Lý do mở tái thẩm định</span><textarea rows={3} maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Ví dụ: authority sắp hết hạn hoặc cần xác minh lại mandate" /></label>
        <button type="button" disabled={busy} onClick={onStartRereview}>{busy ? 'Đang xử lý…' : 'Mở tái thẩm định authority'}</button>
      </div> : null}

      {rereviewPending && row.can_review_rereview ? <div className="d68-admin-intakes__review d68-admin-authority-evidence__rereview-review">
        <label><span>Thời hạn mới nếu tái duyệt</span><input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)} value={expiry} onChange={(event) => onExpiry(event.target.value)} /></label>
        <label><span>Scope</span><div className="d68-admin-intakes__scope"><input type="checkbox" checked readOnly /> Chỉ profile</div></label>
        <label className="d68-admin-intakes__note"><span>Ghi chú quyết định re-review</span><textarea rows={3} maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Approval note hoặc lý do reject tối thiểu 5 ký tự" /></label>
        <div className="d68-admin-intakes__actions"><button className="is-reject" type="button" disabled={busy} onClick={() => onReviewRereview('reject')}>Từ chối re-review</button><button className="is-approve" type="button" disabled={busy} onClick={() => onReviewRereview('approve')}>Tái xác minh authority</button></div>
      </div> : null}

      {!row.can_review && !row.can_start_rereview && !rereviewPending ? <div className="d68-admin-intakes__review-summary"><strong>Kết quả:</strong> {STATUS_LABELS[row.review_status]}{row.assignment.revoke_reason ? ` · ${row.assignment.revoke_reason}` : ''}{row.assignment.expires_at ? ` · Hết hạn ${dateLabel(row.assignment.expires_at)}` : ''}</div> : null}
    </article>
  );
}
