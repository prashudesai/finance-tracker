import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DataJourney } from './DataJourney';

const current = () => document.querySelector('[aria-current="step"] strong')?.textContent ?? null;

const motion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('the data journey', () => {
  test('plays through once, scrambling the salary when it locks, then stops', () => {
    vi.useFakeTimers();
    motion(false);
    render(<DataJourney />);
    expect(current()).toBe('You type it');
    act(() => vi.advanceTimersByTime(2600));
    expect(current()).toBe('Your phone locks it');
    for (let step = 0; step < 2; step += 1) act(() => vi.advanceTimersByTime(2600));
    expect(current()).toBe('Only family can open it');
    expect(screen.getByText('Step 4 of 4')).toBeDefined();
    expect(screen.getAllByText('x9#Lq7&vT2')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(10_000));
    expect(current()).toBe('Only family can open it');
  });

  test('Next steps by hand, and Replay starts again', () => {
    vi.useFakeTimers();
    motion(false);
    render(<DataJourney />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(current()).toBe('Your phone locks it');
    // Stepping by hand stops the timer.
    act(() => vi.advanceTimersByTime(10_000));
    expect(current()).toBe('Your phone locks it');
    fireEvent.click(screen.getByRole('button', { name: /Replay/ }));
    expect(current()).toBe('You type it');
  });

  test('reduced motion shows every step at once, with no controls', () => {
    motion(true);
    render(<DataJourney />);
    expect(current()).toBe('Only family can open it');
    expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
    expect(screen.getAllByText('Salary ₹25,000')).toHaveLength(2);
  });
});
