const MS_PER_DAY = 86_400_000;

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export const isValidMonth = (value: unknown): value is string =>
  typeof value === 'string' && /^(19|20|21)\d\d-(0[1-9]|1[0-2])$/.test(value);

export const toDayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;

export const fromDayNumber = (day: number) => new Date(day * MS_PER_DAY).toISOString().slice(0, 10);

export const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

function dateParts(date: string): [number, number, number] {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  return [year, month, day];
}

export function nextMonth(month: string) {
  const [year, value] = dateParts(month);
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
}

export function previousMonth(month: string) {
  const [year, value] = dateParts(month);
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, '0')}`;
}

/** The same day next month, clamped to that month's length. */
export function monthlyAnniversary(date: string) {
  const [year, month, day] = dateParts(date);
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month + 1))))
    .toISOString()
    .slice(0, 10);
}

/** A day of `month`, clamped to its length. Day 0 means the last day of the month. */
export function dayInMonth(month: string, day: number) {
  const [year, value] = dateParts(month);
  const last = daysInMonth(year, value);
  return `${month}-${String(day === 0 ? last : Math.min(day, last)).padStart(2, '0')}`;
}

/** Adds months, keeping `anchorDay` where the target month is long enough. */
export function addMonths(date: string, months: number, anchorDay?: number) {
  const [year, month, day] = dateParts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const last = daysInMonth(targetYear, targetMonth);
  const clamped = Math.min(anchorDay ?? day, last);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth)}-${pad(clamped)}`;
}

export const lastDayOfMonth = (month: string) => dayInMonth(month, 0);

/** The starting year of the April–March financial year containing a date or month. */
export function financialYearStart(dateOrMonth: string) {
  const [year, month] = dateParts(dateOrMonth);
  return month < 4 ? year - 1 : year;
}

export const financialYearLabel = (startYear: number) =>
  `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

export const financialYearRange = (startYear: number) => ({
  start: `${startYear}-04-01`,
  end: `${startYear + 1}-03-31`,
});

export const addDays = (date: string, days: number) => fromDayNumber(toDayNumber(date) + days);
