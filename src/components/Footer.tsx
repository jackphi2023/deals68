import { Link } from 'react-router-dom';

export default function Footer(){return <footer className="d68-ref-footer">
  <div className="d68-ref-footer__inner">
    <div className="d68-grid-2 d68-ref-footer__grid">
      <div>
        <img src="/assets/logo-white.png" alt="Deals68.com" className="d68-ref-footer__logo" />
        <p><span className="l-vi">Sàn mua bán doanh nghiệp, M&amp;A, huy động vốn và kết nối nhà đầu tư cho Việt Nam, Đông Nam Á và toàn cầu.</span><span className="l-en">Marketplace for business sale, M&amp;A, fundraising and investor matching across Vietnam, Southeast Asia and beyond.</span></p>
      </div>
      <div>
        <div className="d68-ref-footer__title"><span className="l-vi">Nền tảng</span><span className="l-en">Platform</span></div>
        <div className="d68-ref-footer__links">
          <Link to="/businesses"><span className="l-vi">Doanh nghiệp</span><span className="l-en">Businesses</span></Link>
          <Link to="/investors"><span className="l-vi">Nhà đầu tư</span><span className="l-en">Investors</span></Link>
          <Link to="/valuation"><span className="l-vi">Định giá doanh nghiệp</span><span className="l-en">Valuation</span></Link>
          <Link to="/pricing"><span className="l-vi">Bảng giá</span><span className="l-en">Pricing</span></Link>
          <Link to="/partners"><span className="l-vi">Đối tác thị trường</span><span className="l-en">Market Partner</span></Link>
        </div>
      </div>
      <div>
        <div className="d68-ref-footer__title"><span className="l-vi">Công ty</span><span className="l-en">Company</span></div>
        <div className="d68-ref-footer__links">
          <Link to="/about"><span className="l-vi">Giới thiệu</span><span className="l-en">About</span></Link>
          <Link to="/terms"><span className="l-vi">Điều khoản</span><span className="l-en">Terms</span></Link>
          <Link to="/privacy"><span className="l-vi">Bảo mật</span><span className="l-en">Privacy</span></Link>
          <Link to="/contact"><span className="l-vi">Liên hệ</span><span className="l-en">Contact</span></Link>
        </div>
      </div>
      <div>
        <div className="d68-ref-footer__title"><span className="l-vi">Liên hệ</span><span className="l-en">Contact</span></div>
        <div className="d68-ref-footer__links">
          <a href="mailto:partner@vietcapitalpartners.com">partner@vietcapitalpartners.com</a>
          <span><span className="l-vi">Hotline/Zalo: 0909.584.075</span><span className="l-en">Hotline/Zalo: +84 909 584 075</span></span>
          <span><span className="l-vi">Thanh toán an toàn qua mã QR, Sepay, PayPal</span><span className="l-en">Secure payment via QR, Sepay and PayPal</span></span>
        </div>
      </div>
    </div>
    <div className="d68-ref-footer__bottom"><span><span className="l-vi">Deals68.com: Kết nối thương vụ, khai mở lộc phát.</span><span className="l-en">Deals68.com: Connecting Deals, Unlocking Prosperity.</span></span><span>© 2026 Viet Capital Partners &amp; Consulting.</span></div>
  </div>
</footer>}
