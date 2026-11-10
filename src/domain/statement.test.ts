import { describe, expect, test } from 'vitest';
import {
  alreadyRecorded,
  checkBalances,
  detectDateOrder,
  learnPayees,
  parseAmount,
  parseCsv,
  parseDate,
  payeeOf,
  readStatement,
  suggest,
  type ParsedStatement,
} from './statement';

const read = (text: string) => {
  const result = readStatement(parseCsv(text));
  if ('error' in result) throw new Error(result.error);
  return result;
};

describe('CSV', () => {
  test('quotes, doubled quotes, line breaks in quotes, CRLF and a byte order mark', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  test('semicolons and tabs are found on their own', () => {
    expect(parseCsv('a;b;c\n1;2,5;3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2,5', '3'],
    ]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('dates and amounts', () => {
  test('the many ways banks write a date', () => {
    expect(parseDate('05/11/2026')).toBe('2026-11-05');
    expect(parseDate('5-11-26')).toBe('2026-11-05');
    expect(parseDate('05.11.2026 14:32')).toBe('2026-11-05');
    expect(parseDate('2026-11-05')).toBe('2026-11-05');
    expect(parseDate('05-Nov-2026')).toBe('2026-11-05');
    expect(parseDate('05 Nov 26')).toBe('2026-11-05');
    expect(parseDate('5 September 2026')).toBe('2026-09-05');
    expect(parseDate('Nov 5, 2026')).toBe('2026-11-05');
    expect(parseDate('11/05/2026', 'mdy')).toBe('2026-11-05');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Opening Balance')).toBeNull();
  });

  test('day first unless some date can only be month first', () => {
    expect(detectDateOrder(['03/04/2026', '13/04/2026'])).toBe('dmy');
    expect(detectDateOrder(['04/03/2026', '04/13/2026'])).toBe('mdy');
    expect(detectDateOrder(['03/04/2026'])).toBe('dmy');
    expect(detectDateOrder(['2026-04-03'])).toBe('ymd');
  });

  test('amounts with commas, symbols, Dr and Cr, signs and brackets', () => {
    expect(parseAmount('1,23,456.78')).toEqual({ value: 123456.78, hint: null });
    expect(parseAmount('₹ 500')).toEqual({ value: 500, hint: null });
    expect(parseAmount('Rs. 1,500.00')).toEqual({ value: 1500, hint: null });
    expect(parseAmount('2,000.00 Cr')).toEqual({ value: 2000, hint: 'in' });
    expect(parseAmount('2,000.00(Dr)')).toEqual({ value: 2000, hint: 'out' });
    expect(parseAmount('-450')).toEqual({ value: 450, hint: 'out' });
    expect(parseAmount('(450)')).toEqual({ value: 450, hint: 'out' });
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount('12a')).toBeNull();
  });
});

const HDFC = `HDFC BANK Ltd.
Statement of account
Account No :50100012345678
Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/11/26,SAL CR NOV ACME TECH PVT LTD,0000123,01/11/26,,"1,50,000.00","2,00,000.00"
02/11/26,UPI-SWIGGY-swiggy@icici-ICIC0001-412345678901-PAYMENT,412345678901,02/11/26,450.00,,"1,99,550.00"
03/11/26,UPI-BIGBASKET-bigbasket@hdfcbank-HDFC0000001-412345678902,412345678902,03/11/26,"2,340.50",,"1,97,209.50"
04/11/26,CREDIT CARD PAYMENT HDFC CC XX1234,000000,04/11/26,"25,000.00",,"1,72,209.50"
05/11/26,NEFT DR-ACME HOME FIN-HOME LOAN EMI,N12345,05/11/26,"34,700.00",,"1,37,509.50"
06/11/26,ACH D- ZERODHA BROKING-SIP,ACH123,06/11/26,"10,000.00",,"1,27,509.50"
07/11/26,ATM WDL MG ROAD,ATM1,07/11/26,"5,000.00",,"1,22,509.50"
08/11/26,UPI-AMAZON REFUND,R1,08/11/26,,999.00,"1,23,508.50"
09/11/26,APOLLO PHARMACY KORAMANGALA,P1,09/11/26,820.00,,"1,22,688.50"
"",STATEMENT SUMMARY,,,,,
Opening Balance,,,,,,"50,000.00"
`;

describe('reading a statement', () => {
  test('an HDFC-style CSV with a preamble, withdrawal and deposit columns and a balance', () => {
    const parsed = read(HDFC);
    expect(parsed.lines).toHaveLength(9);
    expect(parsed.problems).toEqual([]);
    expect(parsed.from).toBe('2026-11-01');
    expect(parsed.to).toBe('2026-11-09');
    expect(parsed.lines[0]).toMatchObject({
      date: '2026-11-01',
      amount: 150000,
      direction: 'in',
      balance: 200000,
      reference: '0000123',
    });
    expect(parsed.lines[2]).toMatchObject({ amount: 2340.5, direction: 'out' });
    expect(parsed.balance).toEqual({ checked: 8, mismatches: [] });
  });

  test('an amount column with a separate Dr / Cr column, newest first', () => {
    const parsed = read(
      [
        'Sl. No.,Transaction Date,Description,Amount,Dr / Cr,Balance',
        '2,03-Nov-2026,UPI/NETFLIX,649.00,DR,"49,351.00"',
        '1,01-Nov-2026,INTEREST CREDIT,"1,200.00",CR,"50,000.00"',
      ].join('\n'),
    );
    expect(parsed.lines.map((row) => [row.date, row.direction, row.amount])).toEqual([
      ['2026-11-01', 'in', 1200],
      ['2026-11-03', 'out', 649],
    ]);
    expect(parsed.balance?.mismatches).toEqual([]);
  });

  test('a signed amount column alone', () => {
    const parsed = read('Date,Description,Amount\n2026-11-01,Salary,85000\n2026-11-02,Rent,-25000');
    expect(parsed.lines.map((row) => row.direction)).toEqual(['in', 'out']);
  });

  test('wrapped narrations join the line above', () => {
    const parsed = read(
      'Date,Particulars,Debit,Credit,Balance\n01/11/2026,UPI/DR/123/SWIGGY,450,,1000\n,FOOD ORDER,,,\n',
    );
    expect(parsed.lines[0]?.description).toBe('UPI/DR/123/SWIGGY FOOD ORDER');
  });

  test('rows that can’t be read are kept as problems with their line number', () => {
    const parsed = read(
      [
        'Date,Description,Debit,Credit,Balance',
        '01/11/2026,Fine,100,,900',
        '45/11/2026,Bad date,100,,800',
        '02/11/2026,Bad amount,abc,,800',
        '03/11/2026,Both,100,100,800',
        '04/11/2026,Neither,,,800',
      ].join('\n'),
    );
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.problems.map((row) => [row.line, row.reason])).toEqual([
      [3, 'The date "45/11/2026" couldn’t be read.'.replace('’', "'")],
      [4, 'The withdrawal "abc" isn\'t an amount.'],
      [5, 'It has both a withdrawal and a deposit.'],
      [6, 'There is no amount.'],
    ]);
  });

  test('a balance that doesn’t follow is pointed out', () => {
    const parsed = read(
      'Date,Description,Debit,Credit,Balance\n01/11/2026,A,100,,900\n02/11/2026,B,100,,700\n',
    );
    expect(parsed.balance?.mismatches).toEqual([3]);
  });

  test('a file that isn’t a statement says so plainly', () => {
    const result = readStatement(parseCsv('name,age\nA,3'));
    expect(result).toMatchObject({ error: expect.stringContaining('bank statement') });
  });

  test('balances are only checked when most lines have one', () => {
    expect(
      checkBalances([
        { line: 1, date: '2026-11-01', description: 'a', amount: 1, direction: 'in' },
        { line: 2, date: '2026-11-02', description: 'b', amount: 1, direction: 'in', balance: 3 },
      ]),
    ).toBeNull();
  });
});

describe('what each line is', () => {
  const options = {
    incomeSources: ['Salary', 'Bonus', 'Investments', 'Rental Income', 'Other'],
    expenseCategories: ['Healthcare', 'Entertainment', 'Groceries', 'Food', 'EMI Payment', 'Other'],
  };
  const parsed: ParsedStatement = read(HDFC);
  const by = (text: string) => {
    const line = parsed.lines.find((row) => row.description.includes(text));
    if (!line) throw new Error(text);
    return suggest(line, options);
  };

  test('payees come out of UPI and NEFT narrations', () => {
    expect(payeeOf('UPI-SWIGGY-swiggy@icici-ICIC0001-412345678901-PAYMENT')).toBe('SWIGGY');
    expect(payeeOf('UPI/DR/412345678901/BIG BAZAAR/YESB/x@ybl')).toBe('BIG BAZAAR');
    expect(payeeOf('NEFT DR-ACME HOME FIN-HOME LOAN EMI')).toBe('ACME HOME');
  });

  test('income and spending by keyword, in the family’s own categories', () => {
    expect(by('SAL CR')).toMatchObject({ action: 'income', category: 'Salary' });
    expect(by('SWIGGY')).toMatchObject({ action: 'expense', category: 'Food' });
    expect(by('BIGBASKET')).toMatchObject({ action: 'expense', category: 'Groceries' });
    expect(by('APOLLO')).toMatchObject({ action: 'expense', category: 'Healthcare' });
  });

  test('card bills, loans, investments, cash and refunds are left out to begin with', () => {
    expect(by('CREDIT CARD')).toMatchObject({ action: 'skip', skip: 'cardBill' });
    expect(by('HOME LOAN')).toMatchObject({ action: 'skip', skip: 'loan' });
    expect(by('ZERODHA')).toMatchObject({ action: 'skip', skip: 'investment' });
    expect(by('ATM')).toMatchObject({ action: 'skip', skip: 'cash' });
    expect(by('REFUND')).toMatchObject({ action: 'skip', skip: 'refund' });
  });

  test('earlier choices for a payee win over keywords', () => {
    const learned = learnPayees({
      income: [],
      expenses: [
        {
          notes: 'UPI-SWIGGY-swiggy@icici-ICIC0001-1',
          category: 'Entertainment',
          date: '2026-10-01',
        },
        {
          notes: 'UPI-SWIGGY-swiggy@icici-ICIC0001-2',
          category: 'Entertainment',
          date: '2026-10-05',
        },
        { notes: 'UPI-SWIGGY-swiggy@icici-ICIC0001-3', category: 'Food', date: '2026-10-09' },
      ],
    });
    const line = parsed.lines.find((row) => row.description.includes('SWIGGY'));
    if (!line) throw new Error('SWIGGY');
    expect(suggest(line, { ...options, learned })).toMatchObject({
      category: 'Entertainment',
      basis: 'learned',
    });
  });

  test('unknown spending is Other', () => {
    expect(
      suggest({ description: 'UPI/DR/1/RAMESH KUMAR', direction: 'out' }, options),
    ).toMatchObject({ action: 'expense', category: 'Other', basis: 'default' });
  });
});

describe('already recorded', () => {
  test('same amount within three days, each record used once, closest first', () => {
    const lines = [
      { line: 1, date: '2026-11-02', amount: 450, direction: 'out' as const },
      { line: 2, date: '2026-11-04', amount: 450, direction: 'out' as const },
      { line: 3, date: '2026-11-01', amount: 150000, direction: 'in' as const },
      { line: 4, date: '2026-11-20', amount: 450, direction: 'out' as const },
    ];
    const found = alreadyRecorded(lines, {
      income: [{ id: 'salary', date: '2026-11-01', amount: 150000 }],
      expenses: [
        { id: 'a', date: '2026-11-04', amount: 450 },
        { id: 'b', date: '2026-11-03', amount: 450 },
      ],
    });
    expect(Object.fromEntries(found)).toEqual({ 1: 'b', 2: 'a', 3: 'salary' });
  });

  test('money in never matches an expense', () => {
    const found = alreadyRecorded([{ line: 1, date: '2026-11-02', amount: 450, direction: 'in' }], {
      income: [],
      expenses: [{ id: 'a', date: '2026-11-02', amount: 450 }],
    });
    expect(found.size).toBe(0);
  });
});
