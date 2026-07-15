import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const ADMIN_LINKS = [
  ['/admin', '📊', 'Tổng quan'],
  ['/admin/payments', '💳', 'Thanh toán'],
  ['/admin/proposals', '📨', 'Proposal'],
  ['/admin/banners', '🖼️', 'Banner'],
  ['/admin/business-review', '✅', 'Duyệt public DN'],
  ['/admin/businesses', '🏢', 'Doanh nghiệp'],
  ['/admin/assets', '🗂️', 'Ảnh/File DN'],
  ['/admin/investors', '📈', 'Nhà đầu tư'],
  ['/admin/promo', '🎟️', 'Mã KM'],
  ['/admin/data-requests', '📂', 'Yêu cầu data'],
  ['/admin/leads', '📨', 'Liên hệ/Đối tác'],
  ['/admin/audit', '🧾', 'Audit'],
  ['/admin/settings', '⚙️', 'Cài đặt'],
] as const;

export default function AdminV10Shell({
  current,
  title,
  subtitle,
  actions,
  children,
}: {
  current: '/admin/banners' | '/admin/investors';
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="d68-admin-page d68-v10-admin-page">
      <header className="d68-admin-head">
        <div className="d68-admin-head__inner">
          <b className="d68-admin-head__title">Admin Panel</b>
        </div>
      </header>
      <div className="d68-admin-wrap">
        <div className="d68-admin-cols">
          <nav className="d68-admin-side" aria-label="Admin navigation">
            {ADMIN_LINKS.map(([href, icon, label]) => (
              <Link
                key={href}
                to={href}
                className={href === current ? 'active' : ''}
              >
                <span>{icon} {label}</span>
              </Link>
            ))}
          </nav>
          <main className="d68-v10-admin-main">
            <div className="d68-admin-title">
              <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              {actions}
            </div>
            {children}
          </main>
        </div>
      </div>
    </section>
  );
}
