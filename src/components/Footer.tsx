import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

export default function Footer({ lang }: { lang: Lang }) {
  return <footer className="d68-ref-footer">
    <div className="d68-ref-footer__inner">
      <div className="d68-foot-grid d68-ref-footer__grid">
        <div>
          <img src="/assets/logo-white.png" alt="Deals68.com" className="d68-ref-footer__logo" />
          <p>{T(lang,
            'Sàn mua bán doanh nghiệp, M&A, huy động vốn và kết nối nhà đầu tư cho Việt Nam, Đông Nam Á và toàn cầu.',
            'Marketplace for business sale, M&A, fundraising and investor matching across Vietnam, Southeast Asia and beyond.'
          )}</p>
        </div>
        <div>
          <div className="d68-ref-footer__title">{T(lang, 'Nền tảng', 'Platform')}</div>
          <div className="d68-ref-footer__links">
            <Link to="/businesses">{T(lang, 'Doanh nghiệp', 'Businesses')}</Link>
            <Link to="/investors">{T(lang, 'Nhà đầu tư', 'Investors')}</Link>
            <Link to="/valuation">{T(lang, 'Định giá doanh nghiệp', 'Valuation')}</Link>
            <Link to="/pricing">{T(lang, 'Bảng giá', 'Pricing')}</Link>
            <Link to="/partners">{T(lang, 'Đối tác thị trường', 'Market Partner')}</Link>
          </div>
        </div>
        <div>
          <div className="d68-ref-footer__title">{T(lang, 'Công ty', 'Company')}</div>
          <div className="d68-ref-footer__links">
            <Link to="/about">{T(lang, 'Giới thiệu', 'About')}</Link>
            <Link to="/terms">{T(lang, 'Điều khoản', 'Terms')}</Link>
            <Link to="/privacy">{T(lang, 'Bảo mật', 'Privacy')}</Link>
            <Link to="/contact">{T(lang, 'Liên hệ', 'Contact')}</Link>
          </div>
        </div>
        <div>
          <div className="d68-ref-footer__title">{T(lang, 'Liên hệ', 'Contact')}</div>
          <div className="d68-ref-footer__links">
            <a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a>
            <span>{T(lang, 'Hotline/Zalo: 0909.584.075', 'Hotline/Zalo: 0909.584.075')}</span>
            <span>{T(lang, 'Thanh toán an toàn qua QR, Sepay, PayPal', 'Secure payment via QR, Sepay, PayPal')}</span>
          </div>
        </div>
      </div>
      <div className="d68-ref-footer__bottom">
        <span>{T(lang, 'Deals68.com: Kết nối thương vụ, khai mở lộc phát', 'Deals68.com: Connecting Deals, Unlocking Prosperity')}</span>
        <span>{T(lang, '© Một nền tảng của Viet Capital Partners & Consulting.', '© A platform by Viet Capital Partners & Consulting.')}</span>
      </div>
    </div>
  </footer>;
}
