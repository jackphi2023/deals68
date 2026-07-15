import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  investorDisplayNameV10,
  investorNeedsReviewV10,
} from '../../lib/investorAdminV10';

export default function InvestorV10List({
  rows,
  selectedId,
  onSelect,
  search,
  onSearch,
  reviewOnly,
  onReviewOnly,
  page,
  pageCount,
  onPage,
  pendingCount,
}: {
  rows: InvestorRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  reviewOnly: boolean;
  onReviewOnly: (value: boolean) => void;
  page: number;
  pageCount: number;
  onPage: (value: number) => void;
  pendingCount: number;
}) {
  return (
    <aside className="d68-admin-card d68-v10-investor-list">
      <div className="d68-v10-section-head">
        <div>
          <h2>Nhà đầu tư</h2>
          <p>{pendingCount} hồ sơ cần duyệt</p>
        </div>
      </div>

      <input
        className="d68-admin-input"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Tìm tên, mã, email, quốc gia..."
      />
      <label className="d68-admin-check d68-v10-review-filter">
        <input
          type="checkbox"
          checked={reviewOnly}
          onChange={(event) => onReviewOnly(event.target.checked)}
        />{' '}
        Chỉ hồ sơ cần duyệt
      </label>

      <div className="d68-v10-investor-list__rows">
        {rows.map((row) => (
          <button
            type="button"
            key={row.id}
            className={row.id === selectedId ? 'active' : ''}
            onClick={() => onSelect(String(row.id))}
          >
            <b>{investorDisplayNameV10(row)}</b>
            <span>
              {row.code || '—'} · {row.country_iso2 || row.country || '—'}
            </span>
            {investorNeedsReviewV10(row) ? <em>Cần duyệt</em> : null}
          </button>
        ))}
      </div>

      <div className="d68-v10-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        <span>{page}/{pageCount}</span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
      </div>
    </aside>
  );
}
