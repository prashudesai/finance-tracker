import type { TrackerData } from '../data/repository';
import { addDays, dayInMonth, lastDayOfMonth, nextMonth } from './calendar';
import { isLoanFailure, rebuildLoan } from './loan';
import { loanPayments } from './recurring';

export interface EmiDue {
  loanId: string;
  name: string;
  date: string;
  /** Day of the month. 0 means the last day. */
  day: number;
}

/** Each unpaid loan with a known EMI day: its schedule, first EMI date, or latest EMI paid. */
function emiDays(data: TrackerData, today: string) {
  const rows: Omit<EmiDue, 'date'>[] = [];
  for (const loan of data.loans) {
    const ledger = rebuildLoan(loan, loanPayments(data.expenses, loan.id), { asOf: today });
    if (isLoanFailure(ledger) || ledger.remaining <= 0) continue;
    const rule = data.recurringRules.find(
      (row) => row.kind === 'emi' && row.loanId === loan.id && !row.paused,
    );
    const paid = loanPayments(data.expenses, loan.id).filter(
      (row) => row.repaymentType !== 'part-payment',
    );
    const lastPaid = paid
      .map((row) => row.date)
      .sort()
      .at(-1);
    const known = loan.firstEmiDate ?? lastPaid;
    const day = rule?.day ?? (known ? Number(known.slice(-2)) : null);
    if (day !== null) rows.push({ loanId: loan.id, name: loan.type, day });
  }
  return rows;
}

/** EMIs due today or tomorrow that haven't been paid yet this month. */
export function emiReminders(data: TrackerData, today: string) {
  const tomorrow = addDays(today, 1);
  return emiDays(data, today).flatMap((loan): EmiDue[] => {
    const dates = [today, tomorrow].map((date) => dayInMonth(date.slice(0, 7), loan.day));
    const date = dates.find((row) => row === today || row === tomorrow);
    if (!date) return [];
    const paid = data.expenses.some(
      (row) =>
        row.loanId === loan.loanId &&
        row.repaymentType !== 'part-payment' &&
        row.date.startsWith(date.slice(0, 7)),
    );
    return paid ? [] : [{ ...loan, date }];
  });
}

const escapeText = (text: string) => text.replace(/[\;,]/g, '\\$&').replace(/\n/g, '\\n');

const compactDate = (date: string) => date.replaceAll('-', '');

function monthlyRule(day: number) {
  if (day === 0) return 'BYMONTHDAY=-1';
  // Days 29 to 31 fall back to the last day of shorter months.
  return day > 28 ? `BYMONTHDAY=${day},-1;BYSETPOS=1` : `BYMONTHDAY=${day}`;
}

function calendarEvent(uid: string, title: string, start: string, day: number, stamp: string) {
  const alarm = (trigger: string, description: string) => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${trigger}`,
    `DESCRIPTION:${escapeText(description)}`,
    'END:VALARM',
  ];
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@finance-tracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(start)}`,
    `RRULE:FREQ=MONTHLY;${monthlyRule(day)}`,
    `SUMMARY:${escapeText(title)}`,
    // 9 AM the day before, and 9 AM on the day.
    ...alarm('-PT15H', `Tomorrow: ${title}`),
    ...alarm('PT9H', title),
    'END:VEVENT',
  ];
}

/** A calendar file, so the phone itself reminds people without any server seeing their dates. */
export function reminderCalendar(data: TrackerData, today: string) {
  const stamp = `${compactDate(today)}T000000Z`;
  const month = today.slice(0, 7);
  const firstDate = (day: number) => {
    const date = dayInMonth(month, day);
    return date >= today ? date : dayInMonth(nextMonth(month), day);
  };
  const events = emiDays(data, today).flatMap(({ loanId, name, day }) =>
    calendarEvent(`emi-${loanId}`, `${name} EMI due`, firstDate(day), day, stamp),
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Finance Tracker//Reminders//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    ...calendarEvent(
      'month-end',
      'Finance Tracker month-end review',
      lastDayOfMonth(month),
      0,
      stamp,
    ),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}
