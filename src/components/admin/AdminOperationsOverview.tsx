import { Link } from 'react-router-dom';
import {
  adminRefreshLabel,
  type AdminQueueCounts,
  type AdminTotals,
} from '../../lib/adminOperations';

type QueueCard = {
  key: keyof AdminQueueCounts;
  label: string;
  note: string;
  href: string;
  icon: string;
  tone: 'red' | 'gold' | 'blue' | 'green';
};

const queueCards: QueueCard[] = [
  {
    key: 'payments',
    label: 'Thanh toán chờ xác nhận',
    note: 'Ưu tiên đối soát và xác nhận trước.',
    href: '/admin/payments?ps=pending',
    icon: '💳',
    tone: 'red',
  },
  {
    key: 'businesses',
    label: 'Doanh nghiệp chờ duyệt',
    note: 'Hồ sơ mới, nội dung sửa hoặc tài sản chờ duyệt.',
    href: '/admin/business-review?queue=pending',
    icon: '🏢',
    tone: 'gold',
  },
  {
    key: 'investors',
    label: 'Nhà đầu tư chờ duyệt',
    note: 'Tài khoản mới hoặc thay đổi hồ sơ công khai.',
    href: '/admin/investors?review=pending',
    icon: '📈',
    tone: 'blue',
  },
  {
    key: 'proposals',
    label: 'Proposal chưa duyệt',
    note: 'Proposal Business gửi tới Nhà đầu tư.',
    href: '/admin/proposals?prs=sent',
    icon: '📨',
    tone: 'green',
  },
];

export function AdminOperationsOverview({
  queueCounts,
  totals,
  refreshedAt,
}: {
  queueCounts: AdminQueueCounts;
  totals: AdminTotals;
  refreshedAt: string;
}) {
  const secondaryPending =
    queueCounts.requests + queueCounts.leads;
  const primaryPending = queueCards.reduce(
    (sum, item) => sum + queueCounts[item.key],
    0,
  );

  return (
    <div className="d68-admin-operations">
      <section className="d68-admin-ops-head">
        <div>
          <span className="d68-admin-ops-kicker">
            Hàng chờ vận hành
          </span>
          <h2>
            {primaryPending
              ? `${primaryPending} việc chính cần xử lý`
              : 'Không có việc chính đang chờ'}
          </h2>
          <p>
            Dữ liệu cập nhật lúc {adminRefreshLabel(refreshedAt)}.
            Các hàng chờ được ưu tiên trước dữ liệu đã xử lý.
          </p>
        </div>
        <span
          className={
            `d68-admin-ops-health ${
              primaryPending ? 'warn' : 'ok'
            }`
          }
        >
          {primaryPending ? 'Cần xử lý' : 'Đã sạch hàng chờ'}
        </span>
      </section>

      <div className="d68-admin-queue-grid">
        {queueCards.map((item) => {
          const count = queueCounts[item.key];

          return (
            <Link
              key={item.key}
              to={item.href}
              className={`d68-admin-queue-card ${item.tone}`}
            >
              <div className="d68-admin-queue-card__top">
                <span>{item.icon}</span>
                <b>{count}</b>
              </div>
              <h3>{item.label}</h3>
              <p>{item.note}</p>
              <strong>
                {count ? 'Mở hàng chờ' : 'Xem danh sách'} →
              </strong>
            </Link>
          );
        })}
      </div>

      <section className="d68-admin-ops-summary">
        <div>
          <span>Business</span>
          <b>{totals.businesses}</b>
        </div>
        <div>
          <span>Investor</span>
          <b>{totals.investors}</b>
        </div>
        <div>
          <span>Profiles</span>
          <b>{totals.profiles}</b>
        </div>
        <div>
          <span>Payment orders</span>
          <b>{totals.payments}</b>
        </div>
        <div>
          <span>Proposals</span>
          <b>{totals.proposals}</b>
        </div>
      </section>

      <section className="d68-admin-ops-secondary">
        <div>
          <h3>Hàng chờ bổ sung</h3>
          <p>
            Yêu cầu dữ liệu và liên hệ/đối tác cần phản hồi:
            <b> {secondaryPending}</b>
          </p>
        </div>
        <div className="d68-admin-actions">
          <Link
            to="/admin/data-requests"
            className="d68-admin-btn light"
          >
            Yêu cầu data ({queueCounts.requests})
          </Link>
          <Link
            to="/admin/leads"
            className="d68-admin-btn light"
          >
            Liên hệ/Đối tác ({queueCounts.leads})
          </Link>
        </div>
      </section>

      <details className="d68-admin-ops-workflow">
        <summary>Luồng vận hành chuẩn Beta</summary>
        <ol className="d68-admin-steps">
          <li>
            Xác nhận payment để mở dashboard và áp dụng gói/quota
            atomically.
          </li>
          <li>
            Duyệt Business/Investor nhưng không tự public dữ liệu chưa
            kiểm tra.
          </li>
          <li>
            Duyệt hoặc từ chối Proposal, yêu cầu data và lead.
          </li>
          <li>
            Kiểm tra audit log khi có thay đổi quan trọng.
          </li>
        </ol>
      </details>
    </div>
  );
}
