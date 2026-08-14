import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  adminDeleteNews,
  adminListNews,
  adminUpdateNews,
} from '../../services/newsService';
import {
  NEWS_DEFAULT_ADMIN_PAGE_SIZE,
  type NewsAdminStatusFilter,
  type NewsArticle,
} from '../../lib/newsTypes';
import AdminNewsEditor from './AdminNewsEditor';

function formatDate(value: string | null | undefined, includeTime = false) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const date = new Date(includeTime ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('vi-VN', includeTime
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  ).format(date);
}

function statusBadge(status: NewsArticle['status']) {
  if (status === 'published') return { label: 'Đã xuất bản', cls: 'ok' };
  if (status === 'deleted') return { label: 'Đã xóa', cls: 'err' };
  return { label: 'Bản nháp', cls: 'warn' };
}

function editArticleId(pathname: string) {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] !== 'admin' || parts[1] !== 'news') return '';
  if (!parts[2] || parts[2] === 'new' || parts[3] !== 'edit') return '';
  return decodeURIComponent(parts[2]);
}

function isCreateRoute(pathname: string) {
  return pathname.replace(/\/+$/, '') === '/admin/news/new';
}

export default function AdminNewsManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [search, setSearch] = useState(() => query.get('nq') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState<NewsAdminStatusFilter>(() => (query.get('ns') as NewsAdminStatusFilter) || 'active');
  const [featuredFilter, setFeaturedFilter] = useState(() => query.get('nf') || 'all');
  const [page, setPage] = useState(() => Math.max(1, Number(query.get('np') || 1)));
  const [rows, setRows] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const articleId = editArticleId(location.pathname);
  const editorMode = isCreateRoute(location.pathname) || Boolean(articleId);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function replaceQuery(patch: Record<string, string | number | null | undefined>) {
    const next = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      const clean = String(value ?? '').trim();
      if (!clean) next.delete(key);
      else next.set(key, clean);
    });
    const value = next.toString();
    navigate({ pathname: '/admin/news', search: value ? `?${value}` : '' }, { replace: true });
  }

  const loadRows = useCallback(async () => {
    if (editorMode) return;
    setLoading(true);
    setError('');
    try {
      const featured = featuredFilter === 'featured'
        ? true
        : featuredFilter === 'normal'
          ? false
          : undefined;
      const result = await adminListNews({
        page,
        pageSize: NEWS_DEFAULT_ADMIN_PAGE_SIZE,
        status,
        featured,
        search: debouncedSearch,
      });
      setRows(result.rows);
      setTotal(result.total);
      if (result.total > 0 && result.rows.length === 0 && page > 1) {
        const lastPage = Math.max(1, Math.ceil(result.total / NEWS_DEFAULT_ADMIN_PAGE_SIZE));
        setPage(lastPage);
        replaceQuery({ np: lastPage > 1 ? lastPage : null });
      }
    } catch (loadError: any) {
      setRows([]);
      setTotal(0);
      setError(loadError?.message || 'Không tải được danh sách News.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, editorMode, featuredFilter, page, status]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function toggleFeatured(article: NewsArticle) {
    if (article.status === 'deleted') return;
    setActionId(`featured:${article.id}`);
    setError('');
    setMessage('');
    try {
      await adminUpdateNews(article.id, { is_featured: !article.is_featured });
      setMessage(article.is_featured ? 'Đã bỏ Tin nổi bật.' : 'Đã đánh dấu Tin nổi bật.');
      await loadRows();
    } catch (actionError: any) {
      setError(actionError?.message || 'Không cập nhật được Tin nổi bật.');
    } finally {
      setActionId('');
    }
  }

  async function deleteArticle(article: NewsArticle) {
    if (article.status === 'deleted') return;
    const title = article.title_vi || article.title_en || article.slug_vi || article.id;
    if (!window.confirm(`Xóa mềm bài “${title}”? Bài sẽ biến mất khỏi public và không thể sửa trong NEWS-03.`)) return;
    setActionId(`delete:${article.id}`);
    setError('');
    setMessage('');
    try {
      await adminDeleteNews(article.id);
      setMessage('Đã xóa mềm bài News.');
      await loadRows();
    } catch (actionError: any) {
      setError(actionError?.message || 'Không xóa được bài News.');
    } finally {
      setActionId('');
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDebouncedSearch(search);
    setPage(1);
    replaceQuery({ nq: search || null, np: null });
  }

  if (editorMode) {
    return (
      <section className="d68-admin-news">
        <AdminNewsEditor
          articleId={articleId || undefined}
          onCancel={() => navigate('/admin/news')}
          onSaved={() => navigate('/admin/news')}
        />
      </section>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / NEWS_DEFAULT_ADMIN_PAGE_SIZE));

  return (
    <section className="d68-admin-news">
      <div className="d68-admin-card d68-admin-news__head">
        <div className="d68-admin-news__toolbar">
          <div>
            <h2>Quản trị Tin tức</h2>
            <p>Sắp xếp theo cập nhật mới nhất · {NEWS_DEFAULT_ADMIN_PAGE_SIZE} tin/trang · Xóa theo cơ chế soft delete.</p>
          </div>
          <button type="button" className="d68-admin-btn blue" onClick={() => navigate('/admin/news/new')}>+ Tạo tin mới</button>
        </div>

        <form className="d68-admin-news__filters" onSubmit={submitSearch}>
          <label className="d68-admin-field">
            <span>Tìm kiếm</span>
            <input
              className="d68-admin-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              onBlur={() => replaceQuery({ nq: search || null, np: null })}
              placeholder="Tiêu đề hoặc slug VI/EN..."
            />
          </label>
          <label className="d68-admin-field">
            <span>Trạng thái</span>
            <select className="d68-admin-input" value={status} onChange={(event) => {
              const value = event.target.value as NewsAdminStatusFilter;
              setStatus(value);
              setPage(1);
              replaceQuery({ ns: value === 'active' ? null : value, np: null });
            }}>
              <option value="active">Đang quản lý</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="deleted">Đã xóa</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
          <label className="d68-admin-field">
            <span>Nổi bật</span>
            <select className="d68-admin-input" value={featuredFilter} onChange={(event) => {
              const value = event.target.value;
              setFeaturedFilter(value);
              setPage(1);
              replaceQuery({ nf: value === 'all' ? null : value, np: null });
            }}>
              <option value="all">Tất cả</option>
              <option value="featured">Tin nổi bật</option>
              <option value="normal">Tin thường</option>
            </select>
          </label>
          <button className="d68-admin-btn light" type="submit">Tìm</button>
        </form>
      </div>

      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {error ? <div className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div><h3>Danh sách tin</h3><div className="d68-admin-subtle">{loading ? 'Đang tải...' : `Hiển thị ${rows.length}/${total} tin`}</div></div>
          <button type="button" className="d68-admin-btn light" onClick={() => void loadRows()} disabled={loading}>Refresh News</button>
        </div>

        {rows.length ? (
          <div className="d68-admin-table-wrap">
            <table className="d68-admin-table d68-admin-news__table">
              <thead><tr><th>Ảnh</th><th>Tiêu đề</th><th>Ngày đăng</th><th>Tags</th><th>Trạng thái</th><th>Nổi bật</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((article) => {
                  const badge = statusBadge(article.status);
                  const disabled = Boolean(actionId) || article.status === 'deleted';
                  return (
                    <tr key={article.id}>
                      <td>{article.featured_image_url ? <img className="d68-admin-news__thumb" src={article.featured_image_url} alt="" /> : <div className="d68-admin-news__thumb d68-admin-news__thumb--empty">4:3</div>}</td>
                      <td>
                        <b>{article.title_vi || 'Chưa có tiêu đề VI'}</b>
                        {article.title_en ? <small>{article.title_en}</small> : null}
                        <code>{article.slug_vi || article.slug_en || '—'}</code>
                      </td>
                      <td>{formatDate(article.published_date)}</td>
                      <td><div className="d68-admin-news__tags">{article.tags.slice(0, 3).map((tag) => <span key={tag.id}>{tag.label_vi}</span>)}{article.tags.length > 3 ? <em>+{article.tags.length - 3}</em> : null}{!article.tags.length ? '—' : null}</div></td>
                      <td><span className={`d68-admin-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>{article.is_featured ? <span className="d68-admin-badge warn">★ Nổi bật</span> : '—'}</td>
                      <td>{formatDate(article.updated_at, true)}</td>
                      <td>
                        <div className="d68-admin-actions d68-admin-news__actions">
                          {article.status !== 'deleted' ? <button type="button" className="d68-admin-btn light" onClick={() => navigate(`/admin/news/${article.id}/edit`)} disabled={Boolean(actionId)}>Sửa</button> : null}
                          {article.status !== 'deleted' ? <button type="button" className="d68-admin-btn gold" onClick={() => void toggleFeatured(article)} disabled={disabled}>{article.is_featured ? 'Bỏ nổi bật' : 'Nổi bật'}</button> : null}
                          {article.status !== 'deleted' ? <button type="button" className="d68-admin-btn red" onClick={() => void deleteArticle(article)} disabled={disabled}>{actionId === `delete:${article.id}` ? 'Đang xóa...' : 'Xóa'}</button> : <span className="d68-admin-subtle">Đã soft delete</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : loading ? null : <div className="d68-admin-empty">Không có bài News phù hợp bộ lọc.</div>}

        {pageCount > 1 ? (
          <div className="d68-admin-pagination">
            <button className="d68-admin-btn light" type="button" disabled={page <= 1 || loading} onClick={() => {
              const next = Math.max(1, page - 1);
              setPage(next);
              replaceQuery({ np: next > 1 ? next : null });
            }}>&lt; Trang trước</button>
            <span>{page} / {pageCount}</span>
            <button className="d68-admin-btn light" type="button" disabled={page >= pageCount || loading} onClick={() => {
              const next = Math.min(pageCount, page + 1);
              setPage(next);
              replaceQuery({ np: next > 1 ? next : null });
            }}>Trang tiếp &gt;</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
