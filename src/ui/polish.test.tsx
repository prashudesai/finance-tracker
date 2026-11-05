import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LoanLedger } from '../domain/loan';
import { debtFreeMonth, greeting, newlyPaidOff, type LoanSummary } from '../domain/summary';
import { Celebration } from './Celebration';
import {
  formatAmount,
  formatCompactMoney,
  formatLakhs,
  formatMoney,
  HIDDEN_AMOUNT,
  setAmountsHidden,
  signedMoney,
} from './format';
import { APP_URL, appInvite, familyInvite, shareMessage, shareStatus } from './share';

afterEach(() => {
  setAmountsHidden(false);
  vi.restoreAllMocks();
});

describe('hidden amounts', () => {
  test('every money format hides, with no sign to give a gain or loss away', () => {
    setAmountsHidden(true);
    expect(formatMoney(25_000)).toBe(HIDDEN_AMOUNT);
    expect(formatCompactMoney(25_00_000)).toBe(HIDDEN_AMOUNT);
    expect(signedMoney(-500)).toBe(HIDDEN_AMOUNT);
    setAmountsHidden(false);
    expect(formatMoney(25_000)).toBe('₹25,000');
  });
});

describe('lakhs and crores', () => {
  test('headline amounts read as people say them', () => {
    expect(formatAmount(38_000)).toBe('₹38,000');
    expect(formatAmount(15_12_000)).toBe('₹15.12L');
    expect(formatAmount(50_00_000)).toBe('₹50L');
    expect(formatAmount(20_50_000)).toBe('₹20.5L');
    expect(formatAmount(1_50_00_000)).toBe('₹1.5 Cr');
    expect(formatAmount(4_81_07_032)).toBe('₹4.81 Cr');
    expect(formatAmount(-2_00_000)).toBe('−₹2L');
  });

  test('switches to crores from ₹1 crore', () => {
    expect(formatLakhs(98_50_000, 1)).toBe('₹98.5L');
    expect(formatLakhs(1_02_30_000, 1)).toBe('₹1.02 Cr');
    expect(formatLakhs(-1_50_00_000)).toBe('−₹1.50 Cr');
  });
});

describe('debt-free month', () => {
  const loan = (remaining: number, emi: number): LoanSummary => ({
    id: String(remaining),
    type: 'Loan',
    member: '',
    error: null,
    ledger: { remaining, emi, rate: 0, totalPrincipal: remaining * 2 } as LoanLedger,
  });

  test('is when the longest loan clears', () => {
    expect(debtFreeMonth([loan(3_000, 1_000), loan(12_000, 1_000)], '2026-11')).toBe('2027-11');
  });

  test('is unknown when nothing is owed, or an EMI never clears a loan', () => {
    expect(debtFreeMonth([loan(0, 1_000)], '2026-11')).toBeNull();
    expect(debtFreeMonth([loan(3_000, 0)], '2026-11')).toBeNull();
  });
});

describe('greeting', () => {
  test('follows the hour and uses the first name only', () => {
    expect(greeting(8, 'Sam Morgan')).toBe('Good morning, Sam');
    expect(greeting(14, 'Sam')).toBe('Good afternoon, Sam');
    expect(greeting(21, 'Sam')).toBe('Good evening, Sam');
    expect(greeting(2, 'Sam')).toBe('Good evening, Sam');
  });

  test('leaves out an email or a placeholder name', () => {
    expect(greeting(9, 'sam@example.test')).toBe('Good morning');
    expect(greeting(9, 'You')).toBe('Good morning');
    expect(greeting(9, '')).toBe('Good morning');
  });
});

describe('celebrations', () => {
  test('only a loan seen owing, and now paid, counts', () => {
    expect(newlyPaidOff(new Set(['a', 'b']), new Set(['a', 'c']))).toEqual(['a']);
    expect(newlyPaidOff(new Set(), new Set(['c']))).toEqual([]);
  });

  test('shows the message, and closes when tapped', () => {
    const onDone = vi.fn();
    render(<Celebration message="Home Loan is paid off!" onDone={onDone} />);
    expect(screen.getByRole('status').textContent).toContain('Home Loan is paid off!');
    fireEvent.click(screen.getByRole('presentation'));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('sharing', () => {
  test('a family invite says how to join, with their email and the link', () => {
    const { text } = familyInvite('Priyanka', 'priyanka@gmail.com');
    expect(text).toContain('Hi Priyanka,');
    expect(text).toContain('priyanka@gmail.com');
    expect(text).toContain(APP_URL);
    expect(familyInvite(null, 'a@b.test').text.startsWith('Hi,')).toBe(true);
    expect(appInvite.text).toContain(APP_URL);
  });

  test('uses the share menu where there is one', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { share });
    expect(await shareMessage(appInvite)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: appInvite.title, text: appInvite.text });
    Object.assign(navigator, { share: () => Promise.reject(new DOMException('no', 'AbortError')) });
    expect(await shareMessage(appInvite)).toBe('cancelled');
    Object.assign(navigator, { share: undefined });
  });

  test('copies where there is no share menu, and says so', async () => {
    Object.assign(navigator, {
      share: undefined,
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
    expect(await shareMessage(appInvite)).toBe('copied');
    expect(shareStatus('copied')).toMatch(/Copied/);
    expect(shareStatus('shared')).toBe('');
  });
});
