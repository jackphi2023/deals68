import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import InvestorAppetiteEditorV10 from '../components/admin/InvestorAppetiteEditorV10';
import InvestorCoverEditorV10 from '../components/admin/InvestorCoverEditorV10';
import InvestorProfileEditorV10 from '../components/admin/InvestorProfileEditorV10';
import InvestorV10List from '../components/admin/InvestorV10List';
import AdminV10Shell from '../components/admin/AdminV10Shell';
import { useAuth } from '../contexts/AuthContext';
import type { InvestorRow } from '../lib/investorAdminV10';
import { investorNeedsReviewV10 } from '../lib/investorAdminV10';
import {
  getDefaultInvestorCover,
  type InvestorCoverBanner,
} from '../lib/investorProfileService';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 24;

export default function AdminInvestorsV10() {
  const { profile, loading } = useAuth();
  const [rows, setRows] = useState<InvestorRow[]>([]);
  const [defaultCover, setDefaultCover] =
    useState<InvestorCoverBanner | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const selected = rows.find((row) => String(row.id) === selectedId) || null;

  async function loadAll() {
    setBusy(true);
    setError('');
    try {
      const [investorResult, coverResult] = await Promise.all([
        supabase
          .from('investors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3000),
        getDefaultInvestorCover('vi', true).catch(() => null),
      ]);
      if (investorResult.error) throw investorResult.error;
      const nextRows = Array.isArray(investorResult.data)
        ? investorResult.data
        : [];
      setRows(nextRows);
      setDefaultCover(coverResult);
      setSelectedId((current) =>
        current && nextRows.some((row) => String(row.id) === current)
          ? current
          : String(nextRows[0]?.id || ''),
      );
    } catch (loadError: any) {
      setError(loadError?.message || 'Không tải được danh sách Investor.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshInvestor(id: string) {
    const { data, error: refreshError } = await supabase
      .from('investors')
      .select('*')
      .eq('id', id)
      .single();
    if (refreshError) throw refreshError;
    setRows((current) =>
      current.map((row) => (String(row.id) === id ? data : row)),
    );
  }

  useEffect(() => {
    if (profile?.role === 'admin') loadAll();
  }, [profile?.role]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (reviewOnly && !investorNeedsReviewV10(row)) return false;
        if (!keyword) return true;
        return [
          row.code,
          row.private_name,
          row.private_email,
          row.title_vi,
          row.title_en,
          row.type,
          row.country,
          row.country_iso2,
          row.status,
        ].some((value) =>
          String(value || '').toLowerCase().includes(keyword),
        );
      })
      .sort((left, right) => {
        const priority =
          Number(investorNeedsReviewV10(right)) -
          Number(investorNeedsReviewV10(left));
        if (priority) return priority;
        return (
          new Date(right.updated_at || right.created_at || 0).getTime() -
          new Date(left.updated_at || left.created_at || 0).getTime()
        );
      });
  }, [rows, search, reviewOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  if (loading) {
    return <section className="d68-admin-page"><div className="d68-admin-wrap">Đang tải...</div></section>;
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/login?next=/admin/investors" replace />;
  }

  return (
    <AdminV10Shell
      current="/admin/investors"
      title="Quản trị Nhà đầu tư"
      subtitle="Một nguồn dữ liệu duy nhất; tải lại đúng Investor sau từng thao tác."
      actions={<button type="button" className="d68-admin-btn" disabled={busy} onClick={loadAll}>{busy ? 'Đang tải...' : 'Làm mới'}</button>}
    >
      {error ? <div className="d68-admin-notice err">{error}</div> : null}
      <div className="d68-v10-investor-admin-grid">
        <InvestorV10List
          rows={paginated}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          reviewOnly={reviewOnly}
          onReviewOnly={(value) => { setReviewOnly(value); setPage(1); }}
          page={safePage}
          pageCount={pageCount}
          onPage={setPage}
          pendingCount={rows.filter(investorNeedsReviewV10).length}
        />
        <section className="d68-v10-investor-editor">
          {!selected ? (
            <div className="d68-admin-card">Không có Investor phù hợp.</div>
          ) : (
            <>
              <InvestorCoverEditorV10
                investor={selected}
                defaultCover={defaultCover}
                onRefresh={() => refreshInvestor(String(selected.id))}
              />
              <InvestorAppetiteEditorV10
                investor={selected}
                onRefresh={() => refreshInvestor(String(selected.id))}
              />
              <InvestorProfileEditorV10
                investor={selected}
                onRefresh={() => refreshInvestor(String(selected.id))}
              />
            </>
          )}
        </section>
      </div>
    </AdminV10Shell>
  );
}
