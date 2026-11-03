import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { detectPlatform, InstallGuide } from './InstallGuide';
import { installNudge } from './InstallPrompts';

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

describe('installNudge', () => {
  const base = { installed: false, dismissed: null, phone: true, today: '2026-11-10' };

  test('offers the card once, and nothing once installed', () => {
    expect(installNudge(base)).toBe('card');
    expect(installNudge({ ...base, installed: true })).toBeNull();
  });

  test('reminds phones a week after Not now, and never computers', () => {
    expect(installNudge({ ...base, dismissed: '2026-11-04' })).toBeNull();
    expect(installNudge({ ...base, dismissed: '2026-11-03' })).toBe('reminder');
    expect(installNudge({ ...base, dismissed: '2026-10-01', phone: false })).toBeNull();
  });
});

describe('detectPlatform', () => {
  test('tells iPhones, Android phones and computers apart', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
  });
});

describe('the install guide', () => {
  test('walks the iPhone steps, then switches device and starts again', () => {
    vi.useFakeTimers();
    motion(false);
    render(<InstallGuide initial="ios" />);
    expect(current()).toBe('Tap Share');
    act(() => vi.advanceTimersByTime(500 + 2300));
    expect(current()).toBe('Tap Add to Home Screen');
    fireEvent.click(screen.getByRole('button', { name: 'Android' }));
    expect(current()).toBe('Tap the menu');
    expect(screen.getByText('Tap Install app')).toBeDefined();
  });

  test('a computer gets its own three steps', () => {
    motion(false);
    render(<InstallGuide initial="desktop" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Click the install icon')).toBeDefined();
  });

  test('reduced motion shows every step done, without Replay', () => {
    motion(true);
    render(<InstallGuide initial="ios" />);
    expect(screen.getAllByLabelText('Done')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Replay/ })).toBeNull();
  });
});
