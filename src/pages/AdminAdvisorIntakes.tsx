import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_NAV_SECTIONS } from '../config/adminNavigation';
import {
  listAdminAdvisorIntakes,
  requestAdminAdvisorAuthorityEvidence,
  reviewAdminAdvisorAuthorityRereview,
  reviewAdminAdvisorIntake,
  startAdminAdvisorAuthorityRereview,
  validateAdminAdvisorAuthorityEvidence,
  type AdminAdvisorIntake,
  type AdminAdvisorIntakeReviewStatus,
  type AdminAuthorityEvidence,
  type AdminEvidenceValidationStatus,
} from '../lib/adminAdvisorIntakes';
import AdminAdvisorIntakeCard, { titleOf } from '../components/AdminAdvisorIntakeCard';
import '../styles/pages/admin-advisor-intakes.css';

function defaultExpiryDate() {
  return new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
}

type QueueFilter = 'attention' | 'all' | AdminAdvisorIntakeReviewStatus;

export default function AdminAdvisorIntakes() {
  const { profile, loading } = useAuth();
  const [rows, setRows] = useState<AdminAdvisorIntake[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('pending_review');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [deliverySummary, setDeliverySummary] = useState({ pending: 0, failed: 0, exhausted: 0, sent: 0 });
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (profile?.role !== 'admin') return;
    setRefreshing(true);
    setError('');
    try {
      const queue = await listAdminAdvisorIntakes();
      setRows(queue.items);
      setDeliverySummary(queue.notification_summary || { pending: 0, failed: 0, exhausted: 0, sent: 0 });
      setExpiries((current) => {
        const next = { ...current };
        queue.items.forEach((row) => { next[row.assignment_id] ||= row.assignment.expires_at?.slice(0, 10) || row.authority.expires_at?.slice(0, 10) || defaultExpiryDate(); });
        return next;
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Không thể tải danh sách Advisor intake.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { if (profile?.role === 'admin') void load(); }, [profile?.role]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'attention') return Boolean(row.attention?.needs_attention);
    return row.review_status === filter;
  }), [rows, filter]);

  const counts = useMemo(() => ({
    attention: rows.filter((row) => row.attention?.needs_attention).length,
    all: rows.length,
    pending_review: rows.filter((row) => row.review_status === 'pending_review').length,
    approved_awaiting_acceptance: rows.filter((row) => row.review_status === 'approved_awaiting_acceptance').length,
    accepted: rows.filter((row) => row.review_status === 'accepted').length,
    rejected: rows.filter((row) => row.review_status === 'rejected').length,
  }), [rows]);

  async function decide(row: AdminAdvisorIntake, decision: 'approve' | 'reject') {
    const note = (notes[row.assignment_id] || '').trim();
    if (decision === 'reject' && note.length < 5) { setError('Vui lòng nhập lý do từ chối tối thiểu 5 ký tự.'); return; }
    const expiryDate = expiries[row.assignment_id] || defaultExpiryDate();
    const expiresAt = decision === 'approve' ? new Date(`${expiryDate}T23:59:59+07:00`).toISOString() : null;
    setBusyId(row.assignment_id); setMessage(''); setError('');
    try {
      const result = await reviewAdminAdvisorIntake({ assignmentId: row.assignment_id, decision, expiresAt, note });
      setMessage(decision === 'approve' ? `Đã xác minh authority cho ${titleOf(row)}. Assignment vẫn chờ Advisor chấp nhận.` : `Đã từ chối authority cho ${titleOf(row)}. Business vẫn draft và không công khai.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load();
      setFilter(result.decision === 'approve' ? 'approved_awaiting_acceptance' : 'rejected');
    } catch (reviewError: any) { setError(reviewError?.message || 'Không thể cập nhật kết quả thẩm định.'); }
    finally { setBusyId(''); }
  }

  async function requestEvidence(row: AdminAdvisorIntake) {
    const note = (notes[row.assignment_id] || '').trim();
    if (note.length < 5) { setError('Vui lòng mô tả tài liệu/bằng chứng cần bổ sung tối thiểu 5 ký tự.'); return; }
    setBusyId(row.assignment_id); setMessage(''); setError('');
    try {
      await requestAdminAdvisorAuthorityEvidence({ assignmentId: row.assignment_id, note });
      setMessage(`Đã ghi yêu cầu bổ sung bằng chứng cho ${titleOf(row)}. Authority và Business vẫn giữ nguyên trạng thái an toàn.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load();
    } catch (requestError: any) { setError(requestError?.message || 'Không thể gửi yêu cầu bổ sung bằng chứng.'); }
    finally { setBusyId(''); }
  }

  async function validateEvidence(row: AdminAdvisorIntake, item: AdminAuthorityEvidence, validationStatus: Exclude<AdminEvidenceValidationStatus, 'unreviewed'>, note: string, requestReplacement: boolean) {
    if (['insufficient', 'invalid'].includes(validationStatus) && note.trim().length < 5) { setError('Evidence chưa đủ/không hợp lệ cần ghi chú căn cứ tối thiểu 5 ký tự.'); return; }
    setBusyId(row.assignment_id); setMessage(''); setError('');
    try {
      await validateAdminAdvisorAuthorityEvidence({ evidenceId: item.evidence_id, validationStatus, note, requestReplacement });
      setMessage(requestReplacement ? `Đã đánh dấu ${item.original_name} là ${validationStatus} và yêu cầu Advisor nộp file thay thế.` : `Đã cập nhật kết quả thẩm định ${item.original_name}: ${validationStatus}.`);
      await load();
    } catch (validationError: any) { setError(validationError?.message || 'Không thể cập nhật kết quả thẩm định evidence.'); }
    finally { setBusyId(''); }
  }

  async function startRereview(row: AdminAdvisorIntake) {
    const note = (notes[row.assignment_id] || '').trim();
    if (note.length < 5) { setError('Vui lòng nhập lý do tái thẩm định tối thiểu 5 ký tự.'); return; }
    setBusyId(row.assignment_id); setMessage(''); setError('');
    try {
      const result = await startAdminAdvisorAuthorityRereview({ assignmentId: row.assignment_id, note });
      setMessage(`Đã mở tái thẩm định vòng ${result.cycle_no} cho ${titleOf(row)}. Business context của Advisor hiện bị khóa bởi authority pending_review.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load(); setFilter('attention');
    } catch (rereviewError: any) { setError(rereviewError?.message || 'Không thể mở tái thẩm định authority.'); }
    finally { setBusyId(''); }
  }

  async function reviewRereview(row: AdminAdvisorIntake, decision: 'approve' | 'reject') {
    const rereviewId = row.current_rereview?.rereview_id;
    if (!rereviewId) { setError('Không tìm thấy vòng tái thẩm định đang chờ.'); return; }
    const note = (notes[row.assignment_id] || '').trim();
    if (decision === 'reject' && note.length < 5) { setError('Vui lòng nhập lý do từ chối re-review tối thiểu 5 ký tự.'); return; }
    const expiryDate = expiries[row.assignment_id] || defaultExpiryDate();
    const expiresAt = decision === 'approve' ? new Date(`${expiryDate}T23:59:59+07:00`).toISOString() : null;
    setBusyId(row.assignment_id); setMessage(''); setError('');
    try {
      const result = await reviewAdminAdvisorAuthorityRereview({ rereviewId, decision, expiresAt, note });
      setMessage(decision === 'approve' ? `Đã tái xác minh authority cho ${titleOf(row)} đến ${expiryDate}. Assignment giữ nguyên scope profile và Business context chỉ mở lại nếu assignment hợp lệ.` : `Đã từ chối re-review của ${titleOf(row)}; assignment đã bị thu hồi.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load(); if (result.assignment_status === 'revoked') setFilter('rejected');
    } catch (rereviewError: any) { setError(rereviewError?.message || 'Không thể quyết định tái thẩm định authority.'); }
    finally { setBusyId(''); }
  }

  if (loading) return <main className="d68-admin-intakes"><div className="d68-admin-intakes__loading">Loading Admin...</div></main>;
  if (profile?.role !== 'admin') return <Navigate to="/admin/login?next=/admin/advisor-intakes" replace />;

  const filterOptions: Array<[QueueFilter, string]> = [
    ['attention', 'Cần tái thẩm định'], ['pending_review', 'Chờ duyệt'], ['approved_awaiting_acceptance', 'Chờ Advisor'],
    ['accepted', 'Đã chấp nhận'], ['rejected', 'Từ chối'], ['all', 'Tất cả'],
  ];

  return (
    <main className="d68-admin-intakes">
      <div className="d68-admin-intakes__layout">
        <aside className="d68-admin-intakes__nav" aria-label="Admin navigation">
          <Link className="d68-admin-intakes__brand" to="/admin">Deals68 Admin</Link>
          {ADMIN_NAV_SECTIONS.map((section) => <div className="d68-admin-intakes__nav-section" key={section.id}><strong>{section.label}</strong>{section.items.map((item) => <Link className={item.id === 'advisor_intakes' ? 'is-active' : ''} key={item.id} to={item.href}><span>{item.icon}</span>{item.label}</Link>)}</div>)}
        </aside>

        <section className="d68-admin-intakes__content">
          <header className="d68-admin-intakes__header">
            <div><span className="d68-admin-intakes__eyebrow">Advisor/Broker · Phiên 9</span><h1>Authority expiry alerts, re-review & email delivery</h1><p>Ưu tiên authority đang re-review, đã hết hạn hoặc còn 7/14/30 ngày và theo dõi email vận hành. Authority decisions vẫn dùng workflow Phiên 7; Business không được public, chuyển ownership hoặc mở quyền edit.</p></div>
            <button type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? 'Đang tải…' : 'Làm mới'}</button>
          </header>

          <div className="d68-admin-intakes__boundary">
            <strong>Ranh giới Phiên 9 · kế thừa Ranh giới Phiên 8 và Phiên 7</strong>
            <span>Email được tạo từ alert lifecycle server-side, theo preference, dedupe exact alert và rate-limit; Admin không có nút gửi thủ công.</span>
            <span>Delivery: chờ {deliverySummary.pending} · retry {deliverySummary.failed} · exhausted {deliverySummary.exhausted} · đã gửi {deliverySummary.sent}.</span>
            <span>Queue re-review và quyết định authority vẫn qua RPC Phiên 7, scope duy nhất là profile.</span>
            <span>Business vẫn ownerless · draft · visible=false; không có Business mutation hay quyền mới.</span>
          </div>
          {message && <div className="d68-admin-intakes__notice is-success">{message}</div>}
          {error && <div className="d68-admin-intakes__notice is-error">{error}</div>}

          <div className="d68-admin-intakes__filters" role="tablist" aria-label="Lọc trạng thái">
            {filterOptions.map(([value, label]) => <button className={filter === value ? 'is-active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label} <span>{counts[value]}</span></button>)}
          </div>

          {!filteredRows.length ? <div className="d68-admin-intakes__empty">Không có hồ sơ phù hợp với bộ lọc hiện tại.</div> : <div className="d68-admin-intakes__list">{filteredRows.map((row) => <AdminAdvisorIntakeCard key={row.assignment_id} row={row} busy={busyId === row.assignment_id} note={notes[row.assignment_id] || ''} expiry={expiries[row.assignment_id] || defaultExpiryDate()} onNote={(value) => setNotes((current) => ({ ...current, [row.assignment_id]: value }))} onExpiry={(value) => setExpiries((current) => ({ ...current, [row.assignment_id]: value }))} onDecision={(decision) => void decide(row, decision)} onRequestEvidence={() => void requestEvidence(row)} onValidateEvidence={(item, status, evidenceNote, requestReplacement) => void validateEvidence(row, item, status, evidenceNote, requestReplacement)} onStartRereview={() => void startRereview(row)} onReviewRereview={(decision) => void reviewRereview(row, decision)} />)}</div>}
        </section>
      </div>
    </main>
  );
}
