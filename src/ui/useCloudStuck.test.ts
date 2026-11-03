import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useCloudStuck } from './useCloudStuck';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCloudStuck', () => {
  test('turns on after a long wait online, and off once the wait ends', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ waiting }) => useCloudStuck(waiting, 1000), {
      initialProps: { waiting: true },
    });
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    rerender({ waiting: false });
    expect(result.current).toBe(false);
  });

  test('stays off while the device is offline', () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result } = renderHook(() => useCloudStuck(true, 1000));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
    vi.restoreAllMocks();
  });
});
