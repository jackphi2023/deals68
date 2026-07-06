# QA — VietQR dynamic + static fallback

After Netlify deploy:

1. Open `/register/business`.
2. Select VN payment so QR amount is VND.
3. Check QR image loads.
4. Open DevTools Console; there should be no CSP error for `img.vietqr.io`.
5. Temporarily block `https://img.vietqr.io` in the browser/network if possible; QR should fallback to `/assets/vietqr-vcb.png`.

Expected behavior:

- Dynamic QR shows amount + transfer note when VietQR loads.
- Static QR is shown only if dynamic QR fails.
- Payment text still shows exact amount and transfer note next to QR.
