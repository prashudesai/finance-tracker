import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { greeting, newlyPaidOff } from '../domain/summary';
import { Celebration } from './Celebration';
import {
  formatCompactMoney,
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
