export function formatMoney(value?: number | string | null, currency = 'VND') {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '-';
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

export function formatCompactMoney(value?: number | string | null, currency = 'VND') {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '-';
  if (currency === 'USD') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n.toLocaleString('en-US')}`;
  }
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)} tỷ ₫`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} triệu ₫`;
  return `${n.toLocaleString('vi-VN')} ₫`;
}

export function slugify(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function percent(n?: number | string | null) {
  const v = Number(n || 0);
  return `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;
}
