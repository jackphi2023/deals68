# Deals68 VietQR dynamic QR fallback patch

## Root cause

The Register page creates a dynamic VietQR image URL from `https://img.vietqr.io/...`, but `netlify.toml` Content-Security-Policy allows images only from:

- self
- data
- blob
- https://*.supabase.co

Therefore the browser can block `https://img.vietqr.io` images even when the QR URL itself is valid.

## Changes

1. `netlify.toml`
   - Adds `https://img.vietqr.io` to `img-src`.

2. `src/pages/Register.tsx`
   - Keeps dynamic QR with amount and transfer note.
   - Adds local static fallback `/assets/vietqr-vcb.png`.
   - If the dynamic QR fails to load, the image switches to the local static QR.

3. `public/assets/vietqr-vcb.png`
   - Static fallback QR from the uploaded image.

## Files included

- `scripts/apply-vietqr-dynamic-fallback.py`
- `public/assets/vietqr-vcb.png`

## Apply in Codespaces

```bash
cp public/assets/vietqr-vcb.png public/assets/vietqr-vcb.png
python3 scripts/apply-vietqr-dynamic-fallback.py
npm run build
git status
git add netlify.toml src/pages/Register.tsx public/assets/vietqr-vcb.png
git commit -m "fix: allow VietQR dynamic QR with static fallback"
git push origin beta-reference
```

Do not use `git add .` if `node_modules/` is untracked.
