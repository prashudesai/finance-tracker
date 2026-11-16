import { describe, expect, test } from 'vitest';
import type { Contribution, Holding } from '../schema/records';
import { retirementMonth } from './retirementMonth';

const account = (id: string, kind: Holding['kind'], member: string, extra: Partial<Holding> = {}) =>
  ({
    id,
    kind,
    type: kind.toUpperCase(),
    name: id,
    member,
    date: '2025-01-01',
    openingInvested: 100_000,
    openingValue: 100_000,
    monthly: 0,
    autoContribute: false,
    ...extra,
  }) as Holding;

const paid = (id: string, holdingId: string, date: string, amount: number, extra = {}) =>
  ({ id, holdingId, date, amount, automatic: false, ...extra }) as Contribution;

const pf = account('pf', 'pf', 'Prashanth', {
  employee: 3_000,
  employer: 3_000,
  epsMonthly: 1_250,
  autoContribute: true,
  autoStart: '2025-04-28',
});
const ppfA = account('ppfA', 'ppf', 'Prashanth');
const ppfB = account('ppfB', 'ppf', 'Priyanka');
const nps = account('nps', 'nps', 'Priyanka', {
  monthly: 5_000,
  autoContribute: true,
  autoStart: '2025-04-20',
});
const fund = account('fund', 'investment', 'Prashanth');
const holdings = [pf, ppfA, ppfB, nps, fund];

const contributions = [
  paid('p1', 'pf', '2026-11-28', 4_750, { epsAmount: 1_250, automatic: true }),
  paid('p0', 'pf', '2026-10-28', 4_750, { epsAmount: 1_250, automatic: true }),
  paid('a1', 'ppfA', '2026-11-05', 5_000),
  paid('b1', 'ppfB', '2026-11-06', 2_000),
  paid('b2', 'ppfB', '2026-11-20', 3_000),
  paid('s1', 'nps', '2026-11-20', 5_000, { skipped: true, automatic: true }),
  paid('n0', 'nps', '2026-10-20', 5_000, { automatic: true }),
  paid('f1', 'fund', '2026-11-03', 50_000),
  paid('old', 'ppfA', '2026-03-31', 1_50_000),
];

describe('what went into retirement accounts in a month', () => {
  const month = retirementMonth(holdings, contributions, '2026-11');

  test('each type adds up what everyone put in, the PF pension share included', () => {
    expect(month.types.map((type) => [type.kind, type.total])).toEqual([
      ['pf', 6_000],
      ['ppf', 10_000],
      ['nps', 0],
    ]);
    expect(month.total).toBe(16_000);
  });

  test('PF shows the employer’s part, and each person’s share is listed', () => {
    expect(month.types[0]?.employer).toBe(3_000);
    expect(month.employer).toBe(3_000);
    expect(month.types[1]?.byMember).toEqual([
      { member: 'Prashanth', amount: 5_000 },
      { member: 'Priyanka', amount: 5_000 },
    ]);
  });

  test('a scheduled contribution with nothing recorded shows as expected, and a removed one doesn’t count', () => {
    expect(month.types[2]?.expected).toEqual([
      { holdingId: 'nps', member: 'Priyanka', date: '2026-11-20', amount: 5_000 },
    ]);
    expect(month.types[0]?.expected).toEqual([]);
  });

  test('last month and the financial year so far, investments left out', () => {
    expect(month.previousTotal).toBe(11_000);
    expect(month.yearTotal).toBe(27_000);
  });

  test('before a schedule starts, nothing is expected', () => {
    const early = retirementMonth(holdings, [], '2025-03');
    expect(early.types.flatMap((type) => type.expected)).toEqual([]);
  });
});
