import type { Expense, Income } from '../schema/records';
import { daysInMonth, isValidDate, roundMoney, toDayNumber } from './calendar';

/**
 * Reading a bank statement into money in and money out, from rows of text cells: a CSV file's
 * rows, or a PDF's lines split into columns. Nothing is guessed silently: every row that can't
 * be read is kept as a problem with its line number, and the running balance, where the
 * statement has one, is checked against every amount.
 */

export type Direction = 'in' | 'out';

export interface StatementLine {
  /** Row number in the file, counting from 1, for pointing at problems. */
  line: number;
  date: string;
  description: string;
  amount: number;
  direction: Direction;
  balance?: number;
  reference?: string;
}

export interface StatementProblem {
  line: number;
  text: string;
  reason: string;
}

export interface ColumnMap {
  date: number;
  description: number;
  debit?: number;
  credit?: number;
  amount?: number;
  direction?: number;
  balance?: number;
  reference?: number;
}

export interface BalanceCheck {
  /** Lines whose balance could be compared with the one before. */
  checked: number;
  /** Lines where the balance doesn't follow from the amount. */
  mismatches: number[];
}

export interface ParsedStatement {
  lines: StatementLine[];
  problems: StatementProblem[];
  columns: ColumnMap;
  headers: string[];
  dateOrder: DateOrder;
  balance: BalanceCheck | null;
  from: string | null;
  to: string | null;
}

export type DateOrder = 'dmy' | 'mdy' | 'ymd';

/** Statements longer than this are better split by month or year. */
export const MAX_LINES = 5000;

// ---------------------------------------------------------------------------------------------
// CSV

/** Finds the delimiter used most in the first lines, outside quotes. */
function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 40).join('\n');
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const delimiter of candidates) {
    let count = 0;
    let quoted = false;
    for (const char of sample) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Splits CSV text into rows of cells: quoted cells, doubled quotes inside them, line breaks
 * inside quotes, Windows line endings and a leading byte order mark.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Columns

const key = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

type Role = keyof ColumnMap;

/** Which role a header cell plays, if any. Order matters: the more specific tests come first. */
function roleOf(header: string): Role | 'valueDate' | null {
  const value = key(header);
  if (!value) return null;
  if (value.includes('valuedate') || value === 'valuedt') return 'valueDate';
  if (
    [
      'date',
      'txndate',
      'trandate',
      'transactiondate',
      'postingdate',
      'postdate',
      'bookingdate',
    ].includes(value) ||
    (value.endsWith('date') && value.length <= 16)
  )
    return 'date';
  if (value.startsWith('balance') || value.endsWith('balance') || value === 'bal') return 'balance';
  if (
    value === 'drcr' ||
    value === 'crdr' ||
    value === 'debitcredit' ||
    value === 'type' ||
    value === 'transactiontype' ||
    value === 'txntype'
  )
    return 'direction';
  if (
    value.includes('withdraw') ||
    value.startsWith('debit') ||
    value === 'dr' ||
    value === 'dramount' ||
    value === 'amountdr' ||
    value === 'paidout' ||
    value === 'moneyout'
  )
    return 'debit';
  if (
    value.includes('deposit') ||
    value.startsWith('credit') ||
    value === 'cr' ||
    value === 'cramount' ||
    value === 'amountcr' ||
    value === 'paidin' ||
    value === 'moneyin'
  )
    return 'credit';
  if (
    [
      'narration',
      'description',
      'particulars',
      'details',
      'transactiondetails',
      'remarks',
      'transactionremarks',
      'transactiondescription',
      'transactionparticulars',
    ].includes(value)
  )
    return 'description';
  if (
    value === 'amount' ||
    value.startsWith('amount') ||
    value === 'transactionamount' ||
    value === 'amt'
  )
    return 'amount';
  if (
    value.includes('chq') ||
    value.includes('cheque') ||
    value.startsWith('ref') ||
    value.includes('refno') ||
    value === 'utr'
  )
    return 'reference';
  return null;
}

/** The columns a header row names, or null when it isn't a statement's header. */
export function columnsOf(cells: string[]): ColumnMap | null {
  const found: Partial<Record<Role | 'valueDate', number>> = {};
  cells.forEach((cell, index) => {
    const role = roleOf(cell);
    if (role && found[role] === undefined) found[role] = index;
  });
  const date = found.date ?? found.valueDate;
  if (date === undefined || found.description === undefined) return null;
  const hasAmounts =
    (found.debit !== undefined && found.credit !== undefined) || found.amount !== undefined;
  if (!hasAmounts) return null;
  return {
    date,
    description: found.description,
    ...(found.debit !== undefined && found.credit !== undefined
      ? { debit: found.debit, credit: found.credit }
      : {}),
    ...(found.amount !== undefined ? { amount: found.amount } : {}),
    ...(found.direction !== undefined ? { direction: found.direction } : {}),
    ...(found.balance !== undefined ? { balance: found.balance } : {}),
    ...(found.reference !== undefined ? { reference: found.reference } : {}),
  };
}

/** The first row, among the first 80, that reads as a statement's header. */
export function findHeader(rows: string[][]) {
  for (let index = 0; index < Math.min(rows.length, 80); index++) {
    const columns = columnsOf(rows[index] ?? []);
    if (columns) return { index, columns };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Dates and amounts

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

function build(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || year < 1990 || year > 2100) return null;
  if (day > daysInMonth(year, month)) return null;
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDate(date) ? date : null;
}

/** Numeric day-month parts of a date cell, for working out the order dates are written in. */
function numericParts(value: string): [number, number] | null {
  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/**
 * Whether dates like 03/04/2026 are day first or month first: month first only if some date's
 * second part is over 12 and none's first part is. Indian banks write day first.
 */
export function detectDateOrder(values: string[]): DateOrder {
  let dayFirst = false;
  let monthFirst = false;
  for (const value of values) {
    if (/^\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}/.test(value.trim())) return 'ymd';
    const parts = numericParts(value);
    if (!parts) continue;
    if (parts[0] > 12) dayFirst = true;
    if (parts[1] > 12) monthFirst = true;
  }
  return monthFirst && !dayFirst ? 'mdy' : 'dmy';
}

/**
 * A date cell as YYYY-MM-DD: 05/11/2026, 5-11-26, 05.11.2026, 2026-11-05, 05-Nov-2026,
 * 05 Nov 26, Nov 5, 2026 or 5 November 2026, with or without a time after it.
 */
export function parseDate(input: string, order: DateOrder = 'dmy'): string | null {
  const value = input.trim().replace(/\s+/g, ' ');
  if (!value) return null;
  let match = /^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})\b/.exec(value);
  if (match) return build(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/.exec(value);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = fullYear(Number(match[3]));
    return order === 'mdy' ? build(year, first, second) : build(year, second, first);
  }
  match = /^(\d{1,2})[\s/.\-]?([A-Za-z]{3,9})[\s/.\-,]*(\d{2}|\d{4})\b/.exec(value);
  if (match) {
    const month =
      MONTHS[(match[2] ?? '').toLowerCase().slice(0, 4)] ??
      MONTHS[(match[2] ?? '').toLowerCase().slice(0, 3)];
    return month ? build(fullYear(Number(match[3])), month, Number(match[1])) : null;
  }
  match = /^([A-Za-z]{3,9})[\s.\-]+(\d{1,2}),?[\s.\-]+(\d{2}|\d{4})\b/.exec(value);
  if (match) {
    const month = MONTHS[(match[1] ?? '').toLowerCase().slice(0, 3)];
    return month ? build(fullYear(Number(match[3])), month, Number(match[2])) : null;
  }
  return null;
}

export interface ParsedAmount {
  value: number;
  /** A Dr or Cr written with the amount, or a sign. */
  hint: Direction | null;
}

/**
 * An amount cell: 1,23,456.78, ₹500, Rs. 500, INR 500, 500.00 Cr, 500 Dr, -500 or (500).
 * Blank, a dash or zero reads as no amount.
 */
export function parseAmount(input: string): ParsedAmount | null {
  let value = input.trim();
  if (!value || /^[-–—]+$/.test(value)) return null;
  let hint: Direction | null = null;
  const suffix = /\s*\(?(cr|dr)\)?\.?$/i.exec(value);
  if (suffix) {
    hint = suffix[1]?.toLowerCase() === 'cr' ? 'in' : 'out';
    value = value.slice(0, suffix.index);
  }
  const prefix = /^(cr|dr)\.?\s*/i.exec(value);
  if (prefix) {
    hint = prefix[1]?.toLowerCase() === 'cr' ? 'in' : 'out';
    value = value.slice(prefix[0].length);
  }
  value = value.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
    hint = hint ?? 'in';
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const amount = roundMoney(Number(value));
  if (negative) hint = hint ?? 'out';
  return { value: amount, hint };
}

/** Dr or Cr, debit or credit, written in its own column. */
function directionWord(value: string): Direction | null {
  const word = key(value);
  if (['cr', 'credit', 'c', 'deposit', 'in'].includes(word)) return 'in';
  if (['dr', 'debit', 'd', 'withdrawal', 'out'].includes(word)) return 'out';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Rows to lines

const SUMMARY_ROW =
  /opening balance|closing balance|^total|grand total|balance b\/?f|balance c\/?f|carried forward|brought forward/i;

const cellAt = (row: string[], index: number | undefined) =>
  index === undefined ? '' : (row[index] ?? '').trim();

/**
 * Reads statement rows into lines. Rows above the header are the bank's preamble and are
 * passed over; a row with only text continues the line above's description, as long
 * narrations wrap; summary rows such as the opening balance are passed over; anything else
 * that can't be read becomes a problem with its line number.
 */
export function readStatement(rows: string[][]): ParsedStatement | { error: string } {
  const header = findHeader(rows);
  if (!header) {
    return {
      error:
        "This doesn't look like a bank statement: no row names a date, a description and the amounts. Download the statement again as CSV or PDF from net banking, not a summary or a passbook image.",
    };
  }
  const { columns, index: headerIndex } = header;
  const body = rows.slice(headerIndex + 1);
  const order = detectDateOrder(body.map((row) => cellAt(row, columns.date)));
  const lines: StatementLine[] = [];
  const problems: StatementProblem[] = [];

  body.forEach((row, offset) => {
    const line = headerIndex + offset + 2;
    const text = row.filter(Boolean).join(' · ');
    if (!text) return;
    // A repeated header, as on each page of a PDF.
    if (columnsOf(row)) return;
    const dateCell = cellAt(row, columns.date);
    const description = cellAt(row, columns.description).replace(/\s+/g, ' ');
    const date = parseDate(dateCell, order);
    const amounts = [columns.debit, columns.credit, columns.amount]
      .map((index) => cellAt(row, index))
      .filter(Boolean);

    if (!date) {
      if (SUMMARY_ROW.test(text)) return;
      const previous = lines.at(-1);
      if (!dateCell && amounts.length === 0 && description && previous) {
        previous.description = `${previous.description} ${description}`.trim();
        return;
      }
      if (amounts.length === 0) return;
      problems.push({
        line,
        text,
        reason: dateCell ? `The date "${dateCell}" couldn't be read.` : 'There is no date.',
      });
      return;
    }
    if (SUMMARY_ROW.test(description)) return;

    let amount: number | null = null;
    let direction: Direction | null = null;
    if (columns.debit !== undefined && columns.credit !== undefined) {
      const debit = parseAmount(cellAt(row, columns.debit));
      const credit = parseAmount(cellAt(row, columns.credit));
      const debitCell = cellAt(row, columns.debit);
      const creditCell = cellAt(row, columns.credit);
      if (debitCell && !debit && !/^[-–—0.]+$/.test(debitCell)) {
        problems.push({ line, text, reason: `The withdrawal "${debitCell}" isn't an amount.` });
        return;
      }
      if (creditCell && !credit && !/^[-–—0.]+$/.test(creditCell)) {
        problems.push({ line, text, reason: `The deposit "${creditCell}" isn't an amount.` });
        return;
      }
      const out = debit && debit.value > 0 ? debit.value : 0;
      const into = credit && credit.value > 0 ? credit.value : 0;
      if (out > 0 && into > 0) {
        problems.push({ line, text, reason: 'It has both a withdrawal and a deposit.' });
        return;
      }
      if (out > 0) {
        amount = out;
        direction = 'out';
      }
      if (into > 0) {
        amount = into;
        direction = 'in';
      }
    } else if (columns.amount !== undefined) {
      const amountCell = cellAt(row, columns.amount);
      const parsed = parseAmount(amountCell);
      if (amountCell && !parsed) {
        problems.push({ line, text, reason: `The amount "${amountCell}" isn't an amount.` });
        return;
      }
      if (parsed && parsed.value > 0) {
        amount = parsed.value;
        direction =
          directionWord(cellAt(row, columns.direction)) ??
          parsed.hint ??
          (columns.direction === undefined ? 'in' : null);
        if (!direction) {
          problems.push({
            line,
            text,
            reason: `"${cellAt(row, columns.direction)}" doesn't say whether money came in or went out.`,
          });
          return;
        }
      }
    }
    if (amount === null || direction === null) {
      problems.push({ line, text, reason: 'There is no amount.' });
      return;
    }
    const balance = parseAmount(cellAt(row, columns.balance));
    const reference = cellAt(row, columns.reference);
    lines.push({
      line,
      date,
      description: description || '(no description)',
      amount,
      direction,
      ...(balance ? { balance: balance.hint === 'out' ? -balance.value : balance.value } : {}),
      ...(reference ? { reference } : {}),
    });
  });

  if (lines.length > MAX_LINES) {
    return {
      error: `This statement has ${lines.length} transactions. Import up to ${MAX_LINES} at a time: download a shorter period.`,
    };
  }

  const balance = checkBalances(lines);
  const sorted = [...lines].sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line);
  return {
    lines: sorted,
    problems,
    columns,
    headers: rows[headerIndex] ?? [],
    dateOrder: order,
    balance,
    from: sorted[0]?.date ?? null,
    to: sorted.at(-1)?.date ?? null,
  };
}

/**
 * Each balance should be the one before it plus what came in or less what went out. Statements
 * run oldest or newest first, so both are tried and the closer kept.
 */
export function checkBalances(lines: StatementLine[]): BalanceCheck | null {
  const withBalance = lines.filter((row) => row.balance !== undefined);
  if (withBalance.length < 2 || withBalance.length < lines.length * 0.9) return null;
  const run = (list: StatementLine[]) => {
    const mismatches: number[] = [];
    for (let index = 1; index < list.length; index++) {
      const before = list[index - 1]?.balance;
      const row = list[index];
      if (before === undefined || !row || row.balance === undefined) continue;
      const expected = before + (row.direction === 'in' ? row.amount : -row.amount);
      if (Math.abs(expected - row.balance) > 0.5) mismatches.push(row.line);
    }
    return mismatches;
  };
  const forward = run(lines);
  const backward = run([...lines].reverse());
  return {
    checked: lines.length - 1,
    mismatches: backward.length < forward.length ? backward : forward,
  };
}

// ---------------------------------------------------------------------------------------------
// What each line is

/** A name for who was paid or who paid, from a narration such as UPI/DR/412/SWIGGY/YESB/x. */
export function payeeOf(description: string): string {
  const NOISE =
    /^(upi|dr|cr|sal|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|neft|imps|rtgs|pos|ach|nach|ecs|mmt|inb|ib|mob|bil|billpay|to|from|by|transfer|trf|txn|ref|payment|paid|via|the|and|for|ltd|limited|pvt|private|india|bank|in|on|at|of|ymrp|p2a|p2m|vps|vpa|idfb|hdfc|icic|sbin|utib|kkbk|yesb|pytm|barb|punb|cnrb|ubin|ioba|indb|ibkl|fdrl)$/i;
  const words = description
    .replace(/[^\s/\-]*@[^\s/]*/g, ' ')
    .split(/[\s/\-_*:#|,.]+/)
    .filter((word) => /^[a-z&]{3,}$/i.test(word) && !NOISE.test(word))
    .map((word) => word.toUpperCase())
    .filter((word, index, list) => list.indexOf(word) === index);
  return words.slice(0, 2).join(' ');
}

export type SkipReason = 'cardBill' | 'refund' | 'ownTransfer' | 'investment' | 'loan' | 'cash';

export interface Suggestion {
  action: 'income' | 'expense' | 'skip';
  /** The income source or expense category. */
  category: string;
  skip?: SkipReason;
  /** Learned from earlier records, a keyword, or neither. */
  basis: 'learned' | 'keyword' | 'default';
}

const SKIPS: { reason: SkipReason; direction: Direction | 'both'; pattern: RegExp }[] = [
  {
    reason: 'cardBill',
    direction: 'out',
    pattern:
      /credit ?card|\bcc ?(pay|bill)|card ?(bill|payment|dues)|\bcred\b|cred club|cardpay|amex|sbi ?card|autopay.*card/i,
  },
  {
    reason: 'refund',
    direction: 'in',
    pattern: /refund|reversal|reversed|\brev\b|chargeback|cashback|\brfnd\b/i,
  },
  {
    reason: 'ownTransfer',
    direction: 'both',
    pattern:
      /\bself\b|own a\/?c|own account|to own|sweep|fd booking|fixed deposit|\bfd ?(no|a\/c|created|closure|proceeds)|\btd ?(a\/c|booking)|rd installment|recurring deposit/i,
  },
  {
    reason: 'investment',
    direction: 'out',
    pattern:
      /\bsip\b|mutual ?fund|\bmf\b|zerodha|groww|kuvera|\bcoin\b|\bnps\b|\bppf\b|indian clearing|\biccl\b|bse ?ltd|\bnsdl\b|\bcdsl\b|wint ?wealth|grip ?invest|upstox|angel ?one|smallcase|\bpms\b/i,
  },
  { reason: 'loan', direction: 'out', pattern: /\bemi\b|loan|\bhome ?fin|bajaj ?fin/i },
  {
    reason: 'cash',
    direction: 'out',
    pattern: /\batm\b|cash ?wdl|cash ?withdrawal|\bnwd\b|\bawb\b|cash ?w\/d|\bcwdr\b/i,
  },
];

const INCOME_RULES: { pattern: RegExp; names: string[] }[] = [
  { pattern: /salary|\bsal\b|payroll|\bsal ?cr/i, names: ['Salary'] },
  { pattern: /bonus|incentive/i, names: ['Bonus'] },
  {
    pattern: /dividend|\bdiv\b|interest|\bint\.? ?(pd|cr|paid)|\bint\b|coupon/i,
    names: ['Investments', 'Interest'],
  },
  { pattern: /\brent\b|rental/i, names: ['Rental Income', 'Rent'] },
];

const EXPENSE_RULES: { pattern: RegExp; names: string[] }[] = [
  {
    pattern:
      /bigbasket|blinkit|zepto|dmart|d ?mart|grocer|instamart|jiomart|supermarket|more retail|reliance fresh|nature'?s basket|kirana|milk|dairy/i,
    names: ['Groceries', 'Grocery'],
  },
  {
    pattern:
      /swiggy|zomato|restaurant|\bcafe\b|domino|pizza|\beats\b|kfc|mcdonald|starbucks|burger/i,
    names: ['Food', 'Dining', 'Eating out', 'Food & Dining', 'Restaurants'],
  },
  {
    pattern:
      /apollo|pharm|medplus|hospital|clinic|\b1mg\b|netmeds|diagnostic|\blabs?\b|doctor|medical|dental/i,
    names: ['Healthcare', 'Medical', 'Health'],
  },
  {
    pattern:
      /netflix|prime ?video|hotstar|spotify|bookmyshow|\bpvr\b|inox|youtube|sonyliv|zee5|jiocinema/i,
    names: ['Entertainment', 'Subscriptions'],
  },
  {
    pattern:
      /\blic\b|insurance|policy|premium|hdfc ?life|icici ?pru|max ?life|star ?health|acko|go ?digit|niva ?bupa|care ?health/i,
    names: ['Insurance'],
  },
  {
    pattern: /school|college|\bfees?\b|tuition|university|byju|udemy|coursera|academy|vidyalaya/i,
    names: ['Education'],
  },
  { pattern: /\brent\b|nobroker|housing\.com/i, names: ['House Rent', 'Rent'] },
  {
    pattern:
      /electricity|bescom|msedcl|tneb|tata ?power|adani ?elec|water ?bill|\bgas\b|indane|bharat ?gas|hp ?gas|broadband|airtel|\bjio\b|vodafone|\bvi\b|bsnl|fibernet|recharge|\bdth\b|tata ?play|postpaid/i,
    names: ['Utilities', 'Bills', 'Electricity', 'Household'],
  },
  {
    pattern:
      /petrol|fuel|hpcl|iocl|indian ?oil|bpcl|\bshell\b|\buber\b|\bola\b|rapido|irctc|metro|fastag|parking/i,
    names: ['Transport', 'Fuel', 'Travel', 'Commute'],
  },
  {
    pattern:
      /amazon|flipkart|myntra|ajio|nykaa|meesho|tata ?cliq|croma|reliance ?digital|decathlon|ikea/i,
    names: ['Shopping'],
  },
  {
    pattern:
      /makemytrip|goibibo|indigo|air ?india|vistara|akasa|\boyo\b|airbnb|hotel|cleartrip|yatra/i,
    names: ['Vacation', 'Travel'],
  },
  { pattern: /maintenance|society|mygate|nobrokerhood/i, names: ['Maintenance'] },
];

function pick(names: string[], options: string[]) {
  for (const name of names) {
    const found = options.find((option) => option.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return null;
}

const fallback = (options: string[]) => pick(['Other'], options) ?? options[0] ?? 'Other';

export interface Learned {
  income: Map<string, string>;
  expense: Map<string, string>;
}

/**
 * What each payee was recorded as before, from the notes on earlier records: the most frequent
 * choice, the latest winning a tie. An import saves the narration as the notes, so choices
 * made once are suggested next time.
 */
export function learnPayees(records: {
  income: Pick<Income, 'notes' | 'source' | 'date'>[];
  expenses: Pick<Expense, 'notes' | 'category' | 'date' | 'loanId'>[];
}): Learned {
  const tally = (rows: { notes?: string | undefined; name: string; date: string }[]) => {
    const counts = new Map<string, Map<string, { count: number; latest: string }>>();
    for (const row of rows) {
      if (!row.notes) continue;
      const payee = payeeOf(row.notes);
      if (!payee) continue;
      const names = counts.get(payee) ?? new Map<string, { count: number; latest: string }>();
      const entry = names.get(row.name) ?? { count: 0, latest: '' };
      names.set(row.name, {
        count: entry.count + 1,
        latest: row.date > entry.latest ? row.date : entry.latest,
      });
      counts.set(payee, names);
    }
    const result = new Map<string, string>();
    for (const [payee, names] of counts) {
      const best = [...names].sort(
        (a, b) => b[1].count - a[1].count || b[1].latest.localeCompare(a[1].latest),
      )[0];
      if (best) result.set(payee, best[0]);
    }
    return result;
  };
  return {
    income: tally(
      records.income.map((row) => ({ notes: row.notes, name: row.source, date: row.date })),
    ),
    expense: tally(
      records.expenses
        .filter((row) => !row.loanId)
        .map((row) => ({ notes: row.notes, name: row.category, date: row.date })),
    ),
  };
}

/**
 * What a line most likely is. Card bills, refunds, transfers between your own accounts,
 * investments, loan EMIs and cash withdrawals are left out to begin with, as each is recorded
 * elsewhere or would count something twice. The rest follows what this payee was recorded as
 * before, then keywords, then Other.
 */
export function suggest(
  line: Pick<StatementLine, 'description' | 'direction'>,
  options: { incomeSources: string[]; expenseCategories: string[]; learned?: Learned },
): Suggestion {
  const text = line.description;
  const action = line.direction === 'in' ? 'income' : 'expense';
  const names = action === 'income' ? options.incomeSources : options.expenseCategories;
  const learned = (action === 'income' ? options.learned?.income : options.learned?.expense)?.get(
    payeeOf(text),
  );
  const skip = SKIPS.find(
    (rule) =>
      (rule.direction === 'both' || rule.direction === line.direction) && rule.pattern.test(text),
  );
  if (skip) {
    return {
      action: 'skip',
      category: learned && names.includes(learned) ? learned : fallback(names),
      skip: skip.reason,
      basis: 'keyword',
    };
  }
  if (learned && names.includes(learned)) return { action, category: learned, basis: 'learned' };
  const rules = action === 'income' ? INCOME_RULES : EXPENSE_RULES;
  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    const name = pick(rule.names, names);
    if (name) return { action, category: name, basis: 'keyword' };
  }
  return { action, category: fallback(names), basis: 'default' };
}

// ---------------------------------------------------------------------------------------------
// Already recorded

/** Days either side of a statement date that a record may sit on and still be the same. */
const NEAR_DAYS = 3;

/**
 * Lines already recorded: an income for money in, or an expense for money out, of the same
 * amount within three days. Each record matches one line at most, the closest date first, so
 * two equal payments in a week match two records, not one.
 */
export function alreadyRecorded(
  lines: Pick<StatementLine, 'line' | 'date' | 'amount' | 'direction'>[],
  records: {
    income: Pick<Income, 'id' | 'date' | 'amount'>[];
    expenses: Pick<Expense, 'id' | 'date' | 'amount'>[];
  },
): Map<number, string> {
  const used = new Set<string>();
  const found = new Map<number, string>();
  const pairs: { line: number; id: string; distance: number }[] = [];
  for (const row of lines) {
    const pool = row.direction === 'in' ? records.income : records.expenses;
    for (const record of pool) {
      if (Math.abs(record.amount - row.amount) > 0.5) continue;
      const distance = Math.abs(toDayNumber(record.date) - toDayNumber(row.date));
      if (distance <= NEAR_DAYS) pairs.push({ line: row.line, id: record.id, distance });
    }
  }
  pairs.sort((a, b) => a.distance - b.distance || a.line - b.line);
  for (const pair of pairs) {
    if (used.has(pair.id) || found.has(pair.line)) continue;
    used.add(pair.id);
    found.set(pair.line, pair.id);
  }
  return found;
}
