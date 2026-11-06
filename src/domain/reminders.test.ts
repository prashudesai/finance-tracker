import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Loan } from '../schema/records';
import { emiReminders, missedEmis, reminderCalendar } from './reminders';

const loan: Loan = {
  id: 'l',
  type: 'Home Loan',
  member: 'A',
  date: '2026-01-01',
  principal: 500_000,
  openingRate: 8,
  openingEmi: 20_000,
  firstEmiDate: '2026-02-05',
  changes: [],
};
const data = (overrides: Partial<TrackerData> = {}): TrackerData => ({
  ...emptyTrackerData(),
  loans: [loan],
  ...overrides,
});
const payment = {
  id: 'p',
  date: '2026-03-03',
  category: 'EMI Payment',
  subcategory: '',
  isAnnual: false,
  amount: 20_000,
  loanId: 'l',
  repaymentType: 'emi' as const,
};

test('an EMI reminds the day before and on the day only', () => {
  expect(emiReminders(data(), '2026-03-03')).toEqual([]);
  expect(emiReminders(data(), '2026-03-04').map((row) => row.date)).toEqual(['2026-03-05']);
  expect(emiReminders(data(), '2026-03-05').map((row) => row.date)).toEqual(['2026-03-05']);
  expect(emiReminders(data(), '2026-03-06')).toEqual([]);
});

test('paying this month stops the reminder, and a part payment does not', () => {
  expect(emiReminders(data({ expenses: [payment] }), '2026-03-04')).toEqual([]);
  const part = { ...payment, repaymentType: 'part-payment' as const };
  expect(emiReminders(data({ expenses: [part] }), '2026-03-04')).toHaveLength(1);
});

test('a schedule decides the day, and a last-day EMI crosses months', () => {
  const rule = {
    id: 'r',
    name: 'EMI',
    kind: 'emi' as const,
    loanId: 'l',
    day: 0,
    startMonth: '2026-01',
    paused: false,
  };
  const state = data({ recurringRules: [rule] as never });
  expect(emiReminders(state, '2026-02-27').map((row) => row.date)).toEqual(['2026-02-28']);
  expect(emiReminders(state, '2026-02-28').map((row) => row.date)).toEqual(['2026-02-28']);
});

test('a loan without an EMI date follows its latest payment', () => {
  const plain = { ...loan };
  delete plain.firstEmiDate;
  const paid = { ...payment, date: '2026-02-12' };
  const state = data({ loans: [plain], expenses: [paid] });
  expect(emiReminders(state, '2026-03-11').map((row) => row.date)).toEqual(['2026-03-12']);
  expect(reminderCalendar(state, '2026-03-20')).toContain('BYMONTHDAY=12');
});

test('a loan with no known EMI day gives no reminder', () => {
  const plain = { ...loan };
  delete plain.firstEmiDate;
  expect(emiReminders(data({ loans: [plain] }), '2026-03-05')).toEqual([]);
});

test('the calendar file repeats monthly and alerts the day before and on the day', () => {
  const file = reminderCalendar(data(), '2026-03-10');
  expect(file).toContain('BEGIN:VCALENDAR');
  expect(file).toContain('SUMMARY:Home Loan EMI due');
  expect(file).toContain('DTSTART;VALUE=DATE:20260405');
  expect(file).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=5');
  expect(file).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1');
  expect(file).toContain('TRIGGER:-PT15H');
  expect(file).toContain('TRIGGER:PT9H');
  expect(file).not.toContain('20000');
  expect(file.split('\r\n').length).toBeGreaterThan(20);
});

test('late days fall back in short months, and text is escaped', () => {
  const late = { ...loan, type: 'Car, new', firstEmiDate: '2026-01-31' };
  const file = reminderCalendar(data({ loans: [late] }), '2026-03-01');
  expect(file).toContain('BYMONTHDAY=31,-1;BYSETPOS=1');
  expect(file).toContain('SUMMARY:Car\\, new EMI due');
});

describe('an EMI past its due date with nothing recorded', () => {
  const dates = (state: TrackerData, today: string, since: string | null = null) =>
    missedEmis(state, today, since).map((row) => row.date);

  test("last month's is flagged until it's recorded", () => {
    expect(dates(data(), '2026-04-10')).toEqual(['2026-03-05']);
    expect(dates(data({ expenses: [payment] }), '2026-04-10')).toEqual([]);
  });

  test("this month's is flagged on the month's last day, not before", () => {
    const paidMarch = data({ expenses: [payment] });
    expect(dates(paidMarch, '2026-04-29')).toEqual([]);
    expect(dates(paidMarch, '2026-04-30')).toEqual(['2026-04-05']);
  });

  test('nothing before the EMIs began or tracking started', () => {
    // EMIs began on 5 February, so January's isn't missed.
    expect(dates(data(), '2026-02-10')).toEqual([]);
    // Tracking started in April, so March isn't asked about.
    expect(dates(data(), '2026-04-10', '2026-04')).toEqual([]);
  });
});
