import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_NAV_SECTIONS } from '../config/adminNavigation';
import {
  listAdminAdvisorIntakes,
  requestAdminAdvisorAuthorityEvidence,
  reviewAdminAdvisorIntake,
  type AdminAdvisorIntake,
  type AdminAdvisorIntakeReviewStatus,
} from '../lib/adminAdvisorIntakes';
import AdminAdvisorIntakeCard, { titleOf } from '../components/AdminAdvisorIntakeCard';
import '../styles/pages/admin-advisor-intakes.css';

function defaultExpiryDate() {
  return new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
}

export default function AdminAdvisorIntakes() {
  const { profile, loading } = useAuth();
  const [rows, setRows] = useState<AdminAdvisorIntake[]>([]);
  const [filter, setFilter] = useState<'all' | AdminAdvisorIntakeReviewStatus>('pending_review');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expiries, setExpiries] = useState<Record<string, string>>({});
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
      setExpiries((current) => {
        const next = { ...current };
        queue.items.forEach((row) => { next[row.assignment_id] ||= row.assignment.expires_at?.slice(0, 10) || defaultExpiryDate(); });
        return next;
      });
    } catch (loadError: any) {
      setError(loadError?.message || 'Không thể tải danh sách Advisor intake.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { if (profile?.role === 'admin') void load(); }, [profile?.role]);

  const filteredRows = useMemo(() => rows.filter((row) => filter === 'all' || row.review_status === filter), [rows, filter]);
  const counts = useMemo(() => ({
    all: rows.length,
    pending_review: rows.filter((row) => row.review_status === 'pending_review').length,
    approved_awaiting_acceptance: rows.filter((row) => row.review_status === 'approved_awaiting_acceptance').length,
    accepted: rows.filter((row) => row.review_status === 'accepted').length,
    rejected: rows.filter((row) => row.review_status === 'rejected').length,
  }), [rows]);

  async function decide(row: AdminAdvisorIntake, decision: 'approve' | 'reject') {
    const note = (notes[row.assignment_id] || '').trim();
    if (decision === 'reject' && note.length < 5) {
      setError('Vui lòng nhập lý do từ chối tối thiểu 5 ký tự.');
      return;
    }
    const expiryDate = expiries[row.assignment_id] || defaultExpiryDate();
    const expiresAt = decision === 'approve' ? new Date(`${expiryDate}T23:59:59+07:00`).toISOString() : null;
    setBusyId(row.assignment_id);
    setMessage('');
    setError('');
    try {
      const result = await reviewAdminAdvisorIntake({ assignmentId: row.assignment_id, decision, expiresAt, note });
      setMessage(decision === 'approve'
        ? `Đã xác minh authority cho ${titleOf(row)}. Assignment vẫn chờ Advisor chấp nhận.`
        : `Đã từ chối authority cho ${titleOf(row)}. Business vẫn draft và không công khai.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load();
      setFilter(result.decision === 'approve' ? 'approved_awaiting_acceptance' : 'rejected');
    } catch (reviewError: any) {
      setError(reviewError?.message || 'Không thể cập nhật kết quả thẩm định.');
    } finally {
      setBusyId('');
    }
  }

  async function requestEvidence(row: AdminAdvisorIntake) {
    const note = (notes[row.assignment_id] || '').trim();
    if (note.length < 5) {
      setError('Vui lòng mô tả tài liệu/bằng chứng cần bổ sung tối thiểu 5 ký tự.');
      return;
    }
    setBusyId(row.assignment_id);
    setMessage('');
    setError('');
    try {
      await requestAdminAdvisorAuthorityEvidence({ assignmentId: row.assignment_id, note });
      setMessage(`Đã ghi yêu cầu bổ sung bằng chứng cho ${titleOf(row)}. Authority và Business vẫn giữ nguyên trạng thái chờ duyệt.`);
      setNotes((current) => ({ ...current, [row.assignment_id]: '' }));
      await load();
      setFilter('pending_review');
    } catch (requestError: any) {
      setError(requestError?.message || 'Không thể gửi yêu cầu bổ sung bằng chứng.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <main className="d68-admin-intakes"><div className="d68-admin-intakes__loading">Loading Admin...</div></main>;
  if (profile?.role !== 'admin') return <Navigate to="/admin/login?next=/admin/advisor-intakes" replace />;

  const filterOptions = [
    ['pending_review', 'Chờ duyệt'],
    ['approved_awaiting_acceptance', 'Chờ Advisor'],
    ['accepted', 'Đã chấp nhận'],
    ['rejected', 'Từ chối'],
    ['all', 'Tất cả'],
  ] as const;

  return (
    <main className="d68-admin-intakes">
      <div className="d68-admin-intakes__layout">
        <aside className="d68-admin-intakes__nav" aria-label="Admin navigation">
          <Link className="d68-admin-intakes__brand" to="/admin">Deals68 Admin</Link>
          {ADMIN_NAV_SECTIONS.map((section) => (
            <div className="d68-admin-intakes__nav-section" key={section.id}>
              <strong>{section.label}</strong>
              {section.items.map((item) => <Link className={item.id === 'advisor_intakes' ? 'is-active' : ''} key={item.id} to={item.href}><span>{item.icon}</span>{item.label}</Link>)}
            </div>
          ))}
        </aside>

        <section className="d68-admin-intakes__content">
          <header className="d68-admin-intakes__header">
            <div>
              <span className="d68-admin-intakes__eyebrow">Advisor/Broker · Phiên 6</span>
              <h1>Duyệt authority & bằng chứng Business intake</h1>
              <p>Xem tài liệu authority riêng tư, yêu cầu bổ sung, theo dõi lịch sử review và xác minh/từ chối quyền đại diện. Business vẫn không được public hoặc chuyển ownership.</p>
            </div>
            <button type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? 'Đang tải…' : 'Làm mới'}</button>
          </header>

          <div className="d68-admin-intakes__boundary">
            <strong>Ranh giới Phiên 6</strong>
            <span>Business vẫn ownerless · draft · visible=false.</span>
            <span>Bằng chứng nằm trong bucket private, tối đa 8 file, 10 MB/file, bất biến sau khi nộp.</span>
            <span>Admin có thể yêu cầu bổ sung; scope duyệt vẫn chỉ là Hồ sơ doanh nghiệp / Business profile.</span>
          </div>
          {message && <div className="d68-admin-intakes__notice is-success">{message}</div>}
          {error && <div className="d68-admin-intakes__notice is-error">{error}</div>}

          <div className="d68-admin-intakes__filters" role="tablist" aria-label="Lọc trạng thái">
            {filterOptions.map(([value, label]) => <button className={filter === value ? 'is-active' : ''} key={value} type="button" onClick={() => setFilter(value)}>{label} <span>{counts[value]}</span></button>)}
          </div>

          {!filteredRows.length ? <div className="d68-admin-intakes__empty">Không có hồ sơ phù hợp với bộ lọc hiện tại.</div> : (
            <div className="d68-admin-intakes__list">
              {filteredRows.map((row) => (
                <AdminAdvisorIntakeCard
                  key={row.assignment_id}
                  row={row}
                  busy={busyId === row.assignment_id}
                  note={notes[row.assignment_id] || ''}
                  expiry={expiries[row.assignment_id] || defaultExpiryDate()}
                  onNote={(value) => setNotes((current) => ({ ...current, [row.assignment_id]: value }))}
                  onExpiry={(value) => setExpiries((current) => ({ ...current, [row.assignment_id]: value }))}
                  onDecision={(decision) => void decide(row, decision)}
                  onRequestEvidence={() => void requestEvidence(row)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
