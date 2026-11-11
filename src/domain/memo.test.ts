import { describe, expect, test } from 'vitest';
import { emptyTrackerData } from '../data/repository';
import { holdingRows, trackingStart } from './analytics';
import { remembered } from './memo';

describe('remembered results', () => {
  test('the same records and key are worked out once, and new records again', () => {
    let runs = 0;
    const count = remembered((data: { rows: number[] }, key: string) => {
      runs += 1;
      return { total: data.rows.length, key };
    });
    const data = { rows: [1, 2] };
    expect(count(data, 'a')).toBe(count(data, 'a'));
    expect(runs).toBe(1);
    count(data, 'b');
    count({ rows: [1, 2] }, 'a');
    expect(runs).toBe(3);
  });

  test('older keys make room, and are worked out again when asked for', () => {
    let runs = 0;
    const work = remembered((_: object, key: string) => ({ key, run: ++runs }), 2);
    const data = {};
    work(data, 'a');
    work(data, 'b');
    work(data, 'c');
    expect(work(data, 'c').run).toBe(3);
    expect(work(data, 'a').run).toBe(4);
  });

  test('a remembered list can’t be changed by whoever reads it', () => {
    const rows = holdingRows(emptyTrackerData(), '2026-11-11');
    expect(Object.isFrozen(rows)).toBe(true);
    expect(holdingRows(emptyTrackerData(), '2026-11-11')).not.toBe(rows);
  });
});

test('tracking starts in the earliest month with income or spending', () => {
  const row = (date: string) => ({ date });
  expect(trackingStart({ income: [], expenses: [] } as never)).toBeNull();
  expect(
    trackingStart({
      income: [row('2026-03-10'), row('2025-12-31')],
      expenses: [row('2026-01-01'), row('2025-11-02'), row('2026-09-09')],
    } as never),
  ).toBe('2025-11');
});
