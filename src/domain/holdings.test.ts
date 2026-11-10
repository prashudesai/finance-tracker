import { describe, expect, test } from 'vitest';
import { returnMeasure } from './holdings';

describe('how each holding’s return is measured', () => {
  test('fixed-rate kinds use their interest rate, plain cash its gain, and markets XIRR', () => {
    expect(returnMeasure({ kind: 'investment', type: 'Fixed Deposits' })).toBe('rate');
    expect(returnMeasure({ kind: 'investment', type: 'Bonds' })).toBe('rate');
    expect(returnMeasure({ kind: 'pf', type: 'PF' })).toBe('rate');
    expect(returnMeasure({ kind: 'ppf', type: 'PPF' })).toBe('rate');
    expect(returnMeasure({ kind: 'nps', type: 'NPS' })).toBe('xirr');
    expect(returnMeasure({ kind: 'investment', type: 'Mutual Funds' })).toBe('xirr');
    expect(
      returnMeasure({ kind: 'investment', type: 'Cash' }, { growthTypes: { Cash: 'no-return' } }),
    ).toBe('absolute');
  });
});
