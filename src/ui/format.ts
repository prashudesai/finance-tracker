const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compactRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** What a hidden amount looks like. Its length never hints at the real figure. */
export const HIDDEN_AMOUNT = '₹ ••••';

let hidden = false;

/**
 * Hides every amount the screen shows. Screens redraw when this changes (see the Shell).
 * PDF and CSV exports format their own figures, so they're never hidden.
 */
export function setAmountsHidden(value: boolean) {
  hidden = value;
}

export const formatMoney = (value: number) => (hidden ? HIDDEN_AMOUNT : rupees.format(value));

export const formatCompactMoney = (value: number) =>
  hidden ? HIDDEN_AMOUNT : compactRupees.format(value);

const CRORE = 10_000_000;

/** In lakhs, or in crores from ₹1 crore up, as amounts are said in India. */
export function formatLakhs(value: number, digits = 2) {
  if (hidden) return HIDDEN_AMOUNT;
  const sign = value < 0 ? '−' : '';
  const size = Math.abs(value);
  return size >= CRORE
    ? `${sign}₹${(size / CRORE).toFixed(2)} Cr`
    : `${sign}₹${(size / 100_000).toFixed(digits)}L`;
}

/**
 * Rupees as people say them: ₹38,000 under a lakh, then ₹15.12L and ₹4.81 Cr, without
 * trailing zeros. For headline figures, where a long run of digits is hard to read.
 */
export function formatAmount(value: number) {
  if (hidden) return HIDDEN_AMOUNT;
  if (Math.abs(value) < 100_000) return formatMoney(Math.round(value));
  return formatLakhs(value, 2).replace(/\.?0+(?=L| Cr)/, '');
}

export function localDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const formatMonth = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

export const formatShortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

export const formatShortMonthYear = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });

export const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const formatPercent = (value: number | null, digits = 1) =>
  value === null ? '—' : `${(value * 100).toFixed(digits)}%`;

// A hidden amount keeps no sign either, which would give away a gain or a loss.
export const signedMoney = (value: number) =>
  hidden ? HIDDEN_AMOUNT : `${value < 0 ? '−' : '+'}${formatMoney(Math.abs(value))}`;

export const gainClass = (value: number | null) => (value !== null && value < 0 ? 'loss' : 'gain');
