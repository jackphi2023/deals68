import { useState } from 'react';
import { downloadAdminAuthorityEvidence, type AdminAdvisorIntake, type AdminAuthorityEvidence } from '../lib/adminAdvisorIntakes';
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
    authority_approved: 'Authority được xác minh',
    authority_rejected: 'Authority bị từ chối',
  };
  return labels[value] || value;
}

export default function AdminAdvisorIntakeCard({ row, note, expiry, busy, onNote, onExpiry, onDecision, onRequestEvidence }: {
  row: AdminAdvisorIntake;
  note: string;
  expiry: string;
  busy: boolean;
  onNote: (value: string) => void;
  onExpiry: (value: string) => void;
  onDecision: (decision: 'approve' | 'reject') => void;
  onRequestEvidence: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const evidence = row.evidence || [];
  const history = row.review_history || [];

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

  return (
    <article className="d68-admin-intakes__card">
      <div className="d68-admin-intakes__card-head">
        <div>
          <span className={`d68-admin-intakes__status is-${row.review_status}`}>{STATUS_LABELS[row.review_status]}</span>
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
            <Field label="Địa chỉ" value={row.authority.declared_asset_address} />
          </dl>
        </section>
      </div>

      <section className="d68-admin-authority-evidence">
        <div className="d68-admin-authority-evidence__head"><div><h3>Bằng chứng authority</h3><p>Private · immutable sau khi Advisor nộp · chỉ Advisor sở hữu và Admin được tải xuống.</p></div><b>{evidence.length} file</b></div>
        {downloadError ? <div className="d68-admin-authority-evidence__error">{downloadError}</div> : null}
        {evidence.length ? <div className="d68-admin-authority-evidence__files">{evidence.map((item) => <div className="d68-admin-authority-evidence__file" key={item.evidence_id}><div><b>{item.original_name}</b><span>{item.document_type} · {sizeLabel(item.file_size_bytes)} · {dateLabel(item.submitted_at)}</span>{item.note ? <small>{item.note}</small> : null}</div><button type="button" disabled={downloadingId === item.evidence_id} onClick={() => void download(item)}>{downloadingId === item.evidence_id ? 'Đang tải…' : 'Tải bằng chứng'}</button></div>)}</div> : <p className="d68-admin-authority-evidence__empty">Advisor chưa nộp bằng chứng authority.</p>}

        {history.length ? <details className="d68-admin-authority-evidence__history"><summary>Lịch sử thẩm định ({history.length})</summary><ol>{history.map((event) => <li key={event.event_id}><div><b>{historyLabel(event.event_type)}</b><span>{dateLabel(event.created_at)}</span></div>{event.note ? <p>{event.note}{event.note_visible_to_advisor ? <em> · Advisor thấy ghi chú này</em> : <em> · Ghi chú nội bộ Admin</em>}</p> : null}</li>)}</ol></details> : null}
      </section>

      {row.can_review ? (
        <div className="d68-admin-intakes__review">
          <label><span>Thời hạn authority và assignment</span><input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)} value={expiry} onChange={(event) => onExpiry(event.target.value)} /></label>
          <label><span>Scope được duyệt</span><div className="d68-admin-intakes__scope"><input type="checkbox" checked readOnly /> Hồ sơ doanh nghiệp / Business profile</div></label>
          <label className="d68-admin-intakes__note"><span>Ghi chú Admin; bắt buộc khi từ chối hoặc yêu cầu bổ sung</span><textarea rows={3} maxLength={2000} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Nêu căn cứ xác minh, yêu cầu tài liệu hoặc lý do từ chối authority" /></label>
          <div className="d68-admin-intakes__actions d68-admin-intakes__actions--session6">
            <button className="is-request" type="button" disabled={busy || !row.can_request_evidence} onClick={onRequestEvidence}>{busy ? 'Đang xử lý…' : 'Yêu cầu bổ sung bằng chứng'}</button>
            <button className="is-reject" type="button" disabled={busy} onClick={() => onDecision('reject')}>{busy ? 'Đang xử lý…' : 'Từ chối authority'}</button>
            <button className="is-approve" type="button" disabled={busy} onClick={() => onDecision('approve')}>{busy ? 'Đang xử lý…' : 'Xác minh & cho phép Advisor chấp nhận'}</button>
          </div>
        </div>
      ) : (
        <div className="d68-admin-intakes__review-summary"><strong>Kết quả:</strong> {STATUS_LABELS[row.review_status]}{row.assignment.revoke_reason ? ` · ${row.assignment.revoke_reason}` : ''}{row.assignment.expires_at ? ` · Hết hạn ${dateLabel(row.assignment.expires_at)}` : ''}</div>
      )}
    </article>
  );
}
