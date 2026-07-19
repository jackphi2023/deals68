import { Link, useLocation } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import RelatedInvestorsSection from './investor/RelatedInvestorsSection';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

export default function Footer({ lang }: { lang: Lang }) {
  const location = useLocation();
  const investorDetailMatch = location.pathname.match(
    /^\/(?:en\/)?investors\/([^/]+)\/?$/,
  );
  let investorCode = '';
  try {
    investorCode = investorDetailMatch?.[1]
      ? decodeURIComponent(investorDetailMatch[1])
      : '';
  } catch {
    investorCode = investorDetailMatch?.[1] || '';
  }

  return <>
    {investorCode ? (
      <RelatedInvestorsSection code={investorCode} lang={lang} />
    ) : null}
    <footer style={{ background: '#0B2038', color: '#c6d5e6' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 24px 28px' }}>
        <div className="d68-grid-2 d68-list-cols" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 36 }}>
          <div>
            <img src="/assets/logo-white.png" alt="Deals68.com" style={{ height: 34, marginBottom: 16 }} />
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#8fa6c0', margin: '0 0 14px', maxWidth: 280 }}>
              <span className="l-vi">Sàn mua bán doanh nghiệp, M&amp;A, huy động vốn và kết nối nhà đầu tư trong nước và quốc tế cho doanh nghiệp Việt Nam trên toàn cầu.</span>
              <span className="l-en">Marketplace for business sales, M&amp;A, fundraising and domestic/international investor matching for Vietnamese businesses worldwide.</span>
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}><span className="l-vi">Nền tảng</span><span className="l-en">Platform</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
              <Link to="/businesses"><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
              <Link to="/investors"><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link>
              <Link to="/valuation"><span className="l-vi">Định giá DN</span><span className="l-en">Valuation</span></Link>
              <Link to="/pricing"><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></Link>
              <Link to="/partners"><span className="l-vi">Đối tác thị trường</span><span className="l-en">Market Partner</span></Link>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}><span className="l-vi">Công ty</span><span className="l-en">Company</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
              <Link to="/about"><span className="l-vi">Giới thiệu</span><span className="l-en">About</span></Link>
              <Link to="/terms"><span className="l-vi">Điều khoản</span><span className="l-en">Terms</span></Link>
              <Link to="/privacy"><span className="l-vi">Bảo mật</span><span className="l-en">Privacy</span></Link>
              <Link to="/contact"><span className="l-vi">Liên hệ</span><span className="l-en">Contact</span></Link>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}><span className="l-vi">Liên hệ</span><span className="l-en">Contact</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14.5 }}>
              <a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a>
              <span style={{ color: '#8fa6c0' }}><span className="l-vi">Thanh toán an toàn qua QR, Sepay, PayPal</span><span className="l-en">Secure payment via QR, Sepay, PayPal</span></span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 40, paddingTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontSize: 13.5, color: '#8fa6c0' }}>
          <span><span className="l-vi">Deals68.com: Kết nối thương vụ, khai mở lộc phát</span><span className="l-en">Deals68.com: Connecting Deals, Unlocking Prosperity</span></span>
          <span><span className="l-vi">© Một nền tảng của Viet Capital Partners &amp; Consulting.</span><span className="l-en">© A platform by Viet Capital Partners &amp; Consulting.</span></span>
        </div>
      </div>
    </footer>
  </>;
}
