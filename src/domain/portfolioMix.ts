import type { TrackerData } from '../data/repository';
import type { Holding, TrackerSettings } from '../schema/records';
import type { PositionRow } from './analytics';
import { roundMoney, toDayNumber } from './calendar';
import { emergencyTarget, monthlyAverages } from './goals';
import { growthType, PAYOUT_MONTHS } from './holdings';

/**
 * What a portfolio is made of, and general rules of thumb about that mix. Rules of thumb only:
 * the wording around them says so, and nothing here knows a family's taxes, plans or appetite
 * for risk the way an adviser would.
 */

export const ASSET_CLASSES = ['equity', 'debt', 'gold', 'realEstate', 'cash'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

type Split = Partial<Record<AssetClass, number>>;

const GOLD = /gold|silver|sgb|precious/i;
const REAL_ESTATE = /reit|invit|real estate|property|land|plot/i;
const DEBT_FUND = /debt|liquid|gilt|bond fund|money market|overnight|arbitrage|corporate bond/i;
const HYBRID = /hybrid|balanced|multi.?asset|dynamic asset/i;

/** NPS mixes equity and bonds; without the scheme's split, half and half is the usual middle. */
const NPS_SPLIT: Split = { equity: 0.5, debt: 0.5 };

/**
 * The asset classes a holding stands for, as shares adding to 1. Names help where the type
 * alone doesn't say, such as a gold ETF saved under Mutual Funds or a debt fund.
 */
export function assetSplit(
  holding: Pick<Holding, 'kind' | 'type' | 'name'>,
  settings?: Pick<TrackerSettings, 'growthTypes'>,
): Split {
  if (holding.kind === 'pf' || holding.kind === 'ppf') return { debt: 1 };
  if (holding.kind === 'nps') return NPS_SPLIT;
  const words = `${holding.type} ${holding.name}`;
  if (GOLD.test(words)) return { gold: 1 };
  if (REAL_ESTATE.test(words)) return { realEstate: 1 };
  const growth = growthType(holding.type, settings);
  if (growth === 'no-return') return { cash: 1 };
  if (growth === 'fixed') return { debt: 1 };
  if (DEBT_FUND.test(words)) return { debt: 1 };
  if (HYBRID.test(words)) return { equity: 0.5, debt: 0.5 };
  return { equity: 1 };
}

export interface ClassShare {
  key: AssetClass;
  value: number;
  share: number;
}

export interface PortfolioMix {
  total: number;
  classes: ClassShare[];
  share: Record<AssetClass, number>;
  value: Record<AssetClass, number>;
  /** PF, PPF and NPS, which can't be drawn on freely before retirement. */
  locked: number;
  /** Fixed payouts a year, as interest or a coupon, spread over twelve months. */
  monthlyPayouts: number;
  /** Bonds, deposits and cash outside PF, PPF and NPS: what could be moved. */
  freeSteady: number;
}

const zero = (): Record<AssetClass, number> => ({
  equity: 0,
  debt: 0,
  gold: 0,
  realEstate: 0,
  cash: 0,
});

export function portfolioMix(
  rows: readonly PositionRow[],
  settings?: Pick<TrackerSettings, 'growthTypes'>,
): PortfolioMix {
  const value = zero();
  let locked = 0;
  let payouts = 0;
  let free = 0;
  for (const { holding, position } of rows) {
    const current = Math.max(0, position.current);
    for (const [key, part] of Object.entries(assetSplit(holding, settings)) as [
      AssetClass,
      number,
    ][]) {
      value[key] += current * part;
      if (holding.kind === 'investment' && (key === 'debt' || key === 'cash')) {
        free += current * part;
      }
    }
    if (holding.kind !== 'investment') locked += current;
    if (holding.payout?.amount) {
      payouts += (holding.payout.amount * 12) / PAYOUT_MONTHS[holding.payout.every];
    }
  }
  const total = ASSET_CLASSES.reduce((sum, key) => sum + value[key], 0);
  const share = zero();
  for (const key of ASSET_CLASSES) share[key] = total > 0 ? value[key] / total : 0;
  return {
    total: roundMoney(total),
    classes: ASSET_CLASSES.map((key) => ({
      key,
      value: roundMoney(value[key]),
      share: share[key],
    })).filter((row) => row.value > 0),
    share,
    value: Object.fromEntries(ASSET_CLASSES.map((key) => [key, roundMoney(value[key])])) as Record<
      AssetClass,
      number
    >,
    locked: roundMoney(locked),
    monthlyPayouts: roundMoney(payouts / 12),
    freeSteady: roundMoney(free),
  };
}

export interface GuideMix {
  equity: number;
  gold: number;
  /** Debt, real estate and cash together: what steadies the rest. */
  steady: number;
  /** Whether the guide comes from an age, or the middle used without one. */
  age: number | null;
}

/**
 * A common starting point, not a target set for anyone: equity of about 100 minus age, kept
 * between 30% and 75%, gold at 10%, and the rest in steadier things. Without an age, 60%
 * equity.
 */
export function guideMix(age: number | null): GuideMix {
  const equity = age === null ? 0.6 : Math.min(0.75, Math.max(0.3, (100 - age) / 100));
  const gold = 0.1;
  return { equity, gold, steady: 1 - equity - gold, age };
}

/** Whole years from a birth date to today. */
export function ageOn(birthDate: string | undefined, today: string): number | null {
  if (!birthDate || birthDate > today) return null;
  let years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  if (today.slice(5) < birthDate.slice(5)) years -= 1;
  return years;
}

/** How far a share may stray from the guide before a tip mentions it. */
const BAND = 0.1;
/** Below this, gold is as good as none. */
const GOLD_FLOOR = 0.03;
const GOLD_CEILING = 0.2;
/** One holding above this share of everything is a lot riding on one thing. */
const CONCENTRATION = 0.35;
/** A fixed-income holding at this rate or more is lending to riskier companies. */
const HIGH_YIELD = 10;
const HIGH_YIELD_SHARE = 0.2;
const LOCKED_SHARE = 0.6;
/** Within this many years of retiring, steady income starts to matter. */
const INCOME_YEARS = 10;
/** Too small a portfolio to say much about its mix. */
const MIN_TOTAL = 50_000;

export type TipTone = 'act' | 'consider' | 'good';

export type Tip =
  | {
      kind: 'equityHigh';
      tone: TipTone;
      share: number;
      guide: number;
      /** Added to everything else, with no selling, to bring equity back to the guide. */
      toAdd: number;
      /** Moved out of equity instead, to the same end. */
      toMove: number;
    }
  | {
      kind: 'equityLow';
      tone: TipTone;
      share: number;
      guide: number;
      /** The gap to the guide. */
      gap: number;
      /** What could be moved towards it, leaving PF, PPF and NPS where they are. */
      toMove: number;
    }
  | { kind: 'goldNone'; tone: TipTone; share: number; toAdd: number }
  | { kind: 'goldHigh'; tone: TipTone; share: number }
  | { kind: 'concentration'; tone: TipTone; name: string; share: number }
  | { kind: 'highYield'; tone: TipTone; share: number; names: string[] }
  | {
      kind: 'emergency';
      tone: TipTone;
      liquid: number;
      target: number;
      short: number;
      monthly: number;
    }
  | {
      kind: 'income';
      tone: TipTone;
      monthlyPayouts: number;
      monthlySpend: number;
      years: number | null;
    }
  | { kind: 'locked'; tone: TipTone; share: number }
  | { kind: 'balanced'; tone: TipTone; equity: number; guide: number };

export type TipKind = Tip['kind'];

export interface MixReview {
  mix: PortfolioMix;
  guide: GuideMix;
  tips: Tip[];
}

const ORDER: Record<TipTone, number> = { act: 0, consider: 1, good: 2 };

/** The latest bank balance recorded on or before this month, if any. */
function bankBalance(data: Pick<TrackerData, 'monthlyBalances'>, today: string) {
  const latest = data.monthlyBalances
    .filter((row) => row.month <= today.slice(0, 7))
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  return latest ? Math.max(0, latest.startBalance) : 0;
}

/** Fixed deposits break early at a small cost, so they count as money to hand. */
const isDeposit = (holding: Holding) => /deposit|\bfd\b/i.test(`${holding.type} ${holding.name}`);

/**
 * Rules-of-thumb tips for a portfolio's mix, most pressing first: too much or too little in
 * the market, no gold, one holding carrying too much, high-yield bonds piling up, too little
 * to hand for an emergency, little steady income near retirement, and most of it locked away.
 */
export function reviewMix(
  rows: readonly PositionRow[],
  data: Pick<TrackerData, 'monthlyBalances' | 'expenses' | 'income'>,
  options: {
    today: string;
    settings?: Pick<TrackerSettings, 'growthTypes'>;
    birthDate?: string;
    retireDate?: string;
  },
): MixReview {
  const { today, settings } = options;
  const mix = portfolioMix(rows, settings);
  const age = ageOn(options.birthDate, today);
  const guide = guideMix(age);
  const tips: Tip[] = [];
  if (mix.total < MIN_TOTAL) return { mix, guide, tips };

  const equity = mix.share.equity;
  if (equity > guide.equity + BAND) {
    tips.push({
      kind: 'equityHigh',
      tone: equity > guide.equity + 2 * BAND ? 'act' : 'consider',
      share: equity,
      guide: guide.equity,
      toAdd: roundMoney(mix.value.equity / guide.equity - mix.total),
      toMove: roundMoney(mix.value.equity - guide.equity * mix.total),
    });
  } else if (equity < guide.equity - BAND) {
    const gap = roundMoney(guide.equity * mix.total - mix.value.equity);
    tips.push({
      kind: 'equityLow',
      tone: 'consider',
      share: equity,
      guide: guide.equity,
      gap,
      toMove: Math.min(gap, mix.freeSteady),
    });
  }

  if (mix.share.gold < GOLD_FLOOR) {
    tips.push({
      kind: 'goldNone',
      tone: 'consider',
      share: mix.share.gold,
      toAdd: roundMoney(Math.max(0, guide.gold * mix.total - mix.value.gold)),
    });
  } else if (mix.share.gold > GOLD_CEILING) {
    tips.push({ kind: 'goldHigh', tone: 'consider', share: mix.share.gold });
  }

  const biggest = rows
    .filter((row) => row.holding.kind === 'investment')
    .sort((a, b) => b.position.current - a.position.current)[0];
  if (biggest && biggest.position.current / mix.total > CONCENTRATION) {
    tips.push({
      kind: 'concentration',
      tone: 'consider',
      name: biggest.holding.name,
      share: biggest.position.current / mix.total,
    });
  }

  const risky = rows.filter(
    (row) =>
      row.holding.kind === 'investment' &&
      growthType(row.holding.type, settings) === 'fixed' &&
      (row.holding.rate ?? 0) >= HIGH_YIELD,
  );
  const riskyValue = risky.reduce((sum, row) => sum + row.position.current, 0);
  if (riskyValue / mix.total > HIGH_YIELD_SHARE) {
    tips.push({
      kind: 'highYield',
      tone: 'consider',
      share: riskyValue / mix.total,
      names: risky.map((row) => row.holding.name),
    });
  }

  const emergency = emergencyTarget(data, today);
  if (emergency) {
    const liquid = roundMoney(
      bankBalance(data, today) +
        rows
          .filter((row) => row.holding.kind === 'investment')
          .filter(
            (row) =>
              assetSplit(row.holding, settings).cash === 1 ||
              isDeposit(row.holding) ||
              /liquid|overnight|money market/i.test(`${row.holding.type} ${row.holding.name}`),
          )
          .reduce((sum, row) => sum + row.position.current, 0),
    );
    if (liquid < emergency.target) {
      tips.push({
        kind: 'emergency',
        tone: liquid < emergency.target / 2 ? 'act' : 'consider',
        liquid,
        target: emergency.target,
        short: roundMoney(emergency.target - liquid),
        monthly: emergency.average,
      });
    }
  }

  const spend = monthlyAverages(data, today)?.expenses ?? 0;
  const years =
    options.retireDate && options.retireDate > today
      ? Math.floor((toDayNumber(options.retireDate) - toDayNumber(today)) / 365.25)
      : null;
  const retiringSoon = years !== null && years <= INCOME_YEARS;
  const retired = Boolean(options.retireDate && options.retireDate <= today);
  if (spend > 0 && (retiringSoon || retired) && mix.monthlyPayouts < spend * 0.5) {
    tips.push({
      kind: 'income',
      tone: retired ? 'act' : 'consider',
      monthlyPayouts: mix.monthlyPayouts,
      monthlySpend: spend,
      years,
    });
  }

  if (mix.locked / mix.total > LOCKED_SHARE) {
    tips.push({ kind: 'locked', tone: 'consider', share: mix.locked / mix.total });
  }

  if (!tips.some((tip) => tip.kind === 'equityHigh' || tip.kind === 'equityLow')) {
    tips.push({ kind: 'balanced', tone: 'good', equity, guide: guide.equity });
  }

  tips.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
  return { mix, guide, tips };
}

export interface MemberMix {
  member: string;
  mix: PortfolioMix;
}

/** Each person's own mix, largest portfolio first, for families with more than one. */
export function memberMixes(
  rows: readonly PositionRow[],
  settings?: Pick<TrackerSettings, 'growthTypes'>,
): MemberMix[] {
  const members = [...new Set(rows.map((row) => row.holding.member))];
  return members
    .map((member) => ({
      member,
      mix: portfolioMix(
        rows.filter((row) => row.holding.member === member),
        settings,
      ),
    }))
    .filter((row) => row.mix.total > 0)
    .sort((a, b) => b.mix.total - a.mix.total);
}
