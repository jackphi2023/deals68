export function splitNumberParts(value: any, allowDecimal = false) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  const negative = raw.startsWith('-') ? '-' : '';
  let body = raw.replace(/-/g, '');
  let decimal = '';
  let hasDecimal = false;
  if (allowDecimal) {
    // Deals68 inputs use dot as thousands separator and comma as decimal separator.
    // Do not treat a dot as decimal; otherwise 10.000.000 would parse as 10000.
    const commaIndex = body.lastIndexOf(',');
    if (commaIndex >= 0) {
      hasDecimal = true;
      decimal = body.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 4);
      body = body.slice(0, commaIndex);
    }
  }
  const integer = body.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return { negative, integer, decimal, hasDecimal };
}

export function formatNumberTyping(value: any, allowDecimal = false) {
  const { negative, integer, decimal, hasDecimal } = splitNumberParts(value, allowDecimal);
  if (!integer && !decimal) return '';
  const grouped = (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative}${grouped}${hasDecimal ? `,${decimal}` : ''}`;
}

export function parseFormattedNumber(value: any, allowDecimal = false) {
  const { negative, integer, decimal } = splitNumberParts(value, allowDecimal);
  if (!integer && !decimal) return 0;
  return Number(`${negative}${integer || '0'}${allowDecimal && decimal ? `.${decimal}` : ''}`) || 0;
}

export function formatInitialNumber(value: any, allowDecimal = false) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const [integer, decimal = ''] = String(Math.abs(n)).split('.');
  const sign = n < 0 ? '-' : '';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return allowDecimal && decimal ? `${sign}${grouped},${decimal.slice(0, 4)}` : `${sign}${grouped}`;
}
