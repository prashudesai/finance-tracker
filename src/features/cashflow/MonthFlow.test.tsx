import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MonthFlow } from './MonthFlow';

const show = (month: string, onMonth = vi.fn(), repaid = 0) => {
  render(
    <MonthFlow
      current="2026-11"
      earliest="2025-11"
      explainer={null}
      income={1_00_000}
      invested={20_000}
      month={month}
      onMonth={onMonth}
      repaid={repaid}
      spent={30_000}
      unrecorded={0}
    />,
  );
  return onMonth;
};

const swipe = (from: number, to: number) => {
  const card = screen.getByRole('region', { name: 'Selected month' });
  fireEvent.touchStart(card, { touches: [{ clientX: from, clientY: 100 }] });
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: to, clientY: 104 }] });
};

test('the month adds up to the balance, with each part of income', () => {
  show('2026-11');
  expect(screen.getByText('November 2026')).toBeDefined();
  expect(screen.getAllByText('₹50,000').length).toBe(2);
  expect(screen.getByText('30%')).toBeDefined();
});

test('loan EMIs show on their own line, between spending and investing, and still come off', () => {
  show('2026-11', vi.fn(), 10_000);
  expect(screen.getByText('Loan EMIs')).toBeDefined();
  // ₹1,00,000 less ₹30,000 spent, ₹10,000 of EMIs and ₹20,000 invested.
  expect(screen.getAllByText('₹40,000').length).toBe(2);
});

test('swiping or tapping moves a month, but never past the current one', () => {
  const onMonth = show('2026-10');
  swipe(300, 60);
  expect(onMonth).toHaveBeenLastCalledWith('2026-11');
  swipe(60, 300);
  expect(onMonth).toHaveBeenLastCalledWith('2026-09');
  fireEvent.click(screen.getByRole('button', { name: 'Previous month, September 2026' }));
  expect(onMonth).toHaveBeenLastCalledWith('2026-09');
  // A short or mostly upward drag is a scroll, not a swipe.
  onMonth.mockClear();
  swipe(100, 130);
  expect(onMonth).not.toHaveBeenCalled();
});

test('on the current month there is nowhere later to go', () => {
  const onMonth = show('2026-11');
  swipe(300, 60);
  expect(onMonth).not.toHaveBeenCalled();
  expect(
    (screen.getByRole('button', { name: 'No later month', hidden: true }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test('tapping the month opens a month picker that jumps straight there, within range', () => {
  const onMonth = show('2026-11');
  const picker = screen.getByLabelText('Month') as HTMLInputElement;
  expect(picker.type).toBe('month');
  expect(picker.min).toBe('2025-11');
  expect(picker.max).toBe('2026-11');
  fireEvent.change(picker, { target: { value: '2026-03' } });
  expect(onMonth).toHaveBeenLastCalledWith('2026-03');
  onMonth.mockClear();
  fireEvent.change(picker, { target: { value: '2027-01' } });
  expect(onMonth).not.toHaveBeenCalled();
});
