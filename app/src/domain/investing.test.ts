import { defaultSettings, type GratuityAccount, type Holding } from '../schema/records';
import { addMonths, isValidDate } from './calendar';
import { estimateGratuity } from './gratuity';
import { dueContributions, holdingPosition } from './holdings';
import { loadLegacyFunctions } from './legacy.testutil';
import { gratuityAsset, projectionAssets, runProjection, type ProjectionAsset } from './projection';
import { calculateXirr } from './returns';

function random(seed: number) {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const holding = (overrides: Partial<Holding> = {}): Holding => ({
  id: 'h',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Index fund',
  member: 'A',
  date: '2025-01-15',
  openingInvested: 100_000,
  openingValue: 100_000,
  monthly: 0,
  autoContribute: false,
  ...overrides,
});

describe('holding positions', () => {
  test('current adds contributions made after the latest valuation only', () => {
    const data = {
      contributions: [
        { id: 'a', holdingId: 'h', date: '2025-02-01', amount: 10_000, automatic: false },
        { id: 'b', holdingId: 'h', date: '2025-04-01', amount: 10_000, automatic: false },
      ],
      valuations: [{ id: 'v', holdingId: 'h', date: '2025-03-01', value: 130_000 }],
    };
    const position = holdingPosition(holding(), data, '2025-05-01');
    expect(position.invested).toBe(120_000);
    expect(position.current).toBe(140_000);
    expect(position.gain).toBe(20_000);
  });

  test('skipped contributions do not count', () => {
    const data = {
      contributions: [
        {
          id: 'a',
          holdingId: 'h',
          date: '2025-02-01',
          amount: 10_000,
          automatic: true,
          skipped: true,
        },
      ],
      valuations: [],
    };
    expect(holdingPosition(holding(), data, '2025-05-01').invested).toBe(100_000);
  });
});

describe('scheduled contributions', () => {
  const scheduled = holding({
    monthly: 5000,
    autoContribute: true,
    autoStart: '2026-01-31',
  });

  test('posts each due month, clamped to short months', () => {
    expect(dueContributions([scheduled], [], '2026-03-31').map((row) => row.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  test('running twice posts nothing new, so devices cannot double up', () => {
    const first = dueContributions([scheduled], [], '2026-03-31');
    expect(dueContributions([scheduled], first, '2026-03-31')).toEqual([]);
  });

  test('a removed contribution is not posted again', () => {
    const [first] = dueContributions([scheduled], [], '2026-01-31');
    if (!first) throw new Error('Expected a contribution.');
    const skipped = { ...first, skipped: true };
    expect(dueContributions([scheduled], [skipped], '2026-01-31')).toEqual([]);
  });

  test('PF posts the employee and employer share, less EPS', () => {
    const pf = holding({
      kind: 'pf',
      employee: 7000,
      employer: 3000,
      epsMonthly: 1250,
      autoContribute: true,
      autoStart: '2026-01-01',
    });
    expect(dueContributions([pf], [], '2026-01-31')[0]).toMatchObject({
      amount: 8750,
      epsAmount: 1250,
    });
  });

  test('stopped schedules post nothing', () => {
    expect(dueContributions([{ ...scheduled, autoContribute: false }], [], '2026-03-31')).toEqual(
      [],
    );
  });
});

/** The legacy formulas are the reference until they are deleted at cutover. */
describe('parity with the legacy formulas', () => {
  const dateKey = (value: number) => new Date(value * 86_400_000).toISOString().slice(0, 10);

  test('XIRR matches across seeded cash flows', () => {
    const legacy = loadLegacyFunctions(['08-nps.js'], ['calculateXirr'], {
      validCalendarDate: isValidDate,
    });
    for (let seed = 1; seed <= 1500; seed++) {
      const next = random(seed);
      const flows = Array.from({ length: 2 + Math.floor(next() * 10) }, (_, index) => ({
        date: dateKey(19_000 + Math.floor(next() * 2500)),
        amount: Math.round((next() - (index === 0 ? 1.2 : 0.6)) * 100_000),
      }));
      expect(calculateXirr(flows), `seed ${seed}`).toBe(legacy.calculateXirr?.(flows));
    }
  });

  test('gratuity matches across service dates', () => {
    const legacy = loadLegacyFunctions(
      ['07-investments.js'],
      ['shiftGratuityDate', 'gratuityService', 'estimateGratuity'],
      {
        validCalendarDate: isValidDate,
        localDateKey: () => '2026-11-01',
        GRATUITY_CAP: 2_000_000,
      },
    );
    for (let seed = 1; seed <= 1500; seed++) {
      const next = random(seed);
      const account: GratuityAccount = {
        id: 'g',
        member: 'A',
        date: dateKey(11_000 + Math.floor(next() * 9000)),
        basicSalary: 20_000 + Math.floor(next() * 200_000),
      };
      const asOf = dateKey(20_000 + Math.floor(next() * 3000));
      const result = legacy.estimateGratuity?.(account, asOf);
      expect({ ...estimateGratuity(account, asOf) }, `seed ${seed}`).toEqual({
        ...(result as unknown as object),
      });
    }
  });

  test('the projection engine matches across seeded portfolios', () => {
    const asset = (
      name: string,
      kind: ProjectionAsset['kind'],
      next: () => number,
      rate: number,
    ): ProjectionAsset => ({
      name,
      kind,
      current: Math.round(next() * 2_000_000),
      invested: 0,
      monthly: Math.round(next() * 40_000),
      sourceMonthly: 0,
      stepUpPercent: Math.round(next() * 10),
      assumptionGroup: 'market',
      returns: { stress: rate - 2, base: rate, optimistic: rate + 3 },
    });

    for (let seed = 1; seed <= 400; seed++) {
      const next = random(seed);
      const gratuityAccounts: GratuityAccount[] =
        next() < 0.5 ? [{ id: 'g', member: 'A', date: dateKey(13_000), basicSalary: 80_000 }] : [];
      const assets = [
        asset('PF', 'pf', next, 8.25),
        asset('EPS', 'eps', next, 0),
        asset('PPF', 'ppf', next, 7.1),
        asset('NPS', 'nps', next, 7.5),
        asset('Mutual Funds', 'investment', next, 12),
        asset('Stallion PMS', 'pms', next, 11),
      ];
      const projectionAdjustments = [
        {
          id: 'a',
          category: 'Mutual Funds',
          date: addMonths('2027-02-10', Math.floor(next() * 20)),
          type: 'add' as const,
          amount: 50_000,
        },
      ];
      const excluded = next() < 0.3 ? ['PF'] : [];
      const years = 1 + Math.floor(next() * 12);
      const scenario = (['stress', 'base', 'optimistic'] as const)[seed % 3] ?? 'base';

      const withGratuity =
        gratuityAccounts.length > 0 ? [...assets, gratuityAsset(1_000_000)] : assets;
      const legacy = loadLegacyFunctions(
        ['15-projections.js', '07-investments.js'],
        [
          'projectionMonthIndex',
          'projectionMonthKey',
          'projectionMonthEndDate',
          'runGrowthProjection',
          'shiftGratuityDate',
          'gratuityService',
          'estimateGratuity',
          'totalGratuityEstimate',
        ],
        {
          state: {
            projectionSettings: {
              includeMonthlyContributions: true,
              excludedMonthlyContributions: excluded,
            },
            projectionAdjustments,
            gratuityAccounts,
          },
          currentMonthKey: () => '2026-11',
          localDateKey: () => '2026-11-01',
          validCalendarDate: isValidDate,
          profileRows: (rows: unknown[]) => rows,
          GRATUITY_CAP: 2_000_000,
        },
      );
      const reference = legacy.runGrowthProjection?.(withGratuity, years, scenario);
      const result = runProjection(withGratuity, {
        years,
        scenario,
        currentMonth: '2026-11',
        includeMonthly: true,
        excluded,
        adjustments: projectionAdjustments,
        gratuityAccounts,
      });
      const summary = (value: object) => JSON.parse(JSON.stringify(value));
      expect(summary(result), `seed ${seed}`).toEqual(summary(reference as unknown as object));
    }
  });

  test('assets group holdings and apply saved assumptions', () => {
    const settings = {
      ...defaultSettings(),
      returns: { 'Mutual Funds': { base: 13 } },
      stepUps: { 'Mutual Funds': 5 },
    };
    const assets = projectionAssets(
      [
        holding({ monthly: 1000, autoContribute: true }),
        holding({ id: 'pf', kind: 'pf', type: 'PF', rate: 8.25, epsOpening: 500 }),
        holding({ id: 'fd', type: 'Fixed Deposits', rate: 7 }),
      ],
      { contributions: [], valuations: [] },
      settings,
      [],
      '2026-11-01',
    );
    expect(assets.map((row) => row.name)).toEqual(['PF', 'EPS', 'Fixed Deposits', 'Mutual Funds']);
    const funds = assets.find((row) => row.name === 'Mutual Funds');
    expect(funds?.returns.base).toBe(13);
    expect(funds?.stepUpPercent).toBe(5);
    expect(assets.find((row) => row.name === 'Fixed Deposits')?.returns.stress).toBe(7);
  });
});
