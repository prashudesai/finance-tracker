import { describe, expect, test } from 'vitest';
import type { Holding } from '../schema/records';
import { holdingActivity, holdingDisplayName, isAccountNumber } from './activity';

const pf = (id: string, name: string, member: string): Holding => ({
  id,
  kind: 'pf',
  type: 'PF',
  name,
  member,
  date: '2026-01-01',
  openingInvested: 1_000_000,
  openingValue: 1_200_000,
  monthly: 0,
  autoContribute: false,
});

describe('names in lists', () => {
  test('an account number shows whose account it is', () => {
    const mine = pf('a', '100281757735', 'Prashanth');
    expect(isAccountNumber('1002 8175 7735')).toBe(true);
    expect(isAccountNumber('Balanced Index Fund')).toBe(false);
    expect(holdingDisplayName(mine, [mine])).toBe('Prashanth');
  });

  test('two accounts of one person add their last four digits; other people’s don’t', () => {
    const one = pf('a', '100281757735', 'Prashanth');
    const two = pf('b', '100896586946', 'Prashanth');
    const hers = pf('c', '100111222333', 'Asha');
    const all = [one, two, hers];
    expect(holdingDisplayName(one, all)).toBe('Prashanth ••7735');
    expect(holdingDisplayName(two, all)).toBe('Prashanth ••6946');
    expect(holdingDisplayName(hers, all)).toBe('Asha');
  });

  test('a proper name stays, and a number with no owner shows its last four digits', () => {
    const fund = { ...pf('f', 'Nifty 50 Index', 'Prashanth'), kind: 'investment' as const };
    expect(holdingDisplayName(fund, [fund])).toBe('Nifty 50 Index');
    const nobody = pf('n', '100281757735', '');
    expect(holdingDisplayName(nobody, [nobody])).toBe('A/c ••7735');
  });
});

describe('recent activity', () => {
  const account = pf('a', '100281757735', 'Prashanth');
  const data = {
    contributions: [
      { id: 'c1', holdingId: 'a', date: '2026-11-01', amount: 20_167, automatic: true },
      { id: 'c2', holdingId: 'a', date: '2026-10-15', amount: 5_000, automatic: false },
      { id: 'c3', holdingId: 'a', date: '2026-12-01', amount: 20_167, automatic: true },
    ],
    valuations: [
      { id: 'v1', holdingId: 'a', date: '2026-11-03', value: 1_360_847 },
      { id: 'v2', holdingId: 'a', date: '2026-11-11', value: 1_360_847 },
    ],
  };

  test('value updates say how far they moved, and an unchanged one moves by nothing', () => {
    const rows = holdingActivity([account], data, '2026-11-12');
    expect(rows.map((row) => [row.id, row.kind, row.change])).toEqual([
      ['v2', 'valued', 0],
      ['v1', 'valued', 1_360_847 - (1_200_000 + 20_167 + 5_000)],
      ['c1', 'scheduled', undefined],
      ['c2', 'contribution', undefined],
    ]);
  });

  test('nothing after today shows, and the list stops at the limit', () => {
    expect(holdingActivity([account], data, '2026-11-12').some((row) => row.id === 'c3')).toBe(
      false,
    );
    expect(holdingActivity([account], data, '2026-11-12', 2)).toHaveLength(2);
  });
});
