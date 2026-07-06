#!/usr/bin/env python3
from pathlib import Path


def read(path: str) -> str:
    p = Path(path)
    if not p.exists():
        raise SystemExit(f"Missing file: {path}")
    return p.read_text(encoding="utf-8")


def write(path: str, content: str):
    Path(path).write_text(content, encoding="utf-8")
    print(f"updated {path}")


def replace_once(content: str, old: str, new: str, path: str) -> str:
    if old not in content:
        raise SystemExit(f"Pattern not found in {path}:\n{old[:500]}")
    return content.replace(old, new, 1)

# 1) Netlify CSP: allow VietQR dynamic image source.
path = "netlify.toml"
s = read(path)
s = replace_once(
    s,
    "img-src 'self' data: blob: https://*.supabase.co;",
    "img-src 'self' data: blob: https://*.supabase.co https://img.vietqr.io;",
    path,
)
write(path, s)

# 2) Register QR: keep dynamic VietQR, fallback to static asset if dynamic fails.
path = "src/pages/Register.tsx"
s = read(path)

s = replace_once(
    s,
    "const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];",
    "const DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];\nconst STATIC_VIETQR_URL = '/assets/vietqr-vcb.png';",
    path,
)

s = replace_once(
    s,
    "  const qrUrl = `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(bankContent)}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;\n\n  const benchmarkResult",
    "  const qrUrl = `https://img.vietqr.io/image/VCB-0011004000713-compact2.png?${qrAmountParam}addInfo=${encodeURIComponent(bankContent)}&accountName=${encodeURIComponent('Tieu Vo Dinh Phi')}`;\n  const [qrImageSrc, setQrImageSrc] = useState(qrUrl);\n  useEffect(() => { setQrImageSrc(qrUrl); }, [qrUrl]);\n\n  const benchmarkResult",
    path,
)

s = replace_once(
    s,
    '<div className="d68-bizreg-qrbox"><a href={qrUrl} target="_blank" rel="noreferrer"><img src={qrUrl} alt="QR Vietcombank" /></a><div>',
    '<div className="d68-bizreg-qrbox"><a href={qrImageSrc} target="_blank" rel="noreferrer"><img src={qrImageSrc} alt="QR Vietcombank" onError={() => setQrImageSrc(STATIC_VIETQR_URL)} /></a><div>',
    path,
)

write(path, s)
print("VietQR dynamic + static fallback patch applied. Next run: npm run build")
