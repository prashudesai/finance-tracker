import type { Tip } from '../../domain/portfolioMix';
import { formatAmount, formatMoney } from '../../ui/format';
import type { OptionId } from './options';

export interface TipText {
  title: string;
  why: string;
  /** What could be done, with amounts. */
  steps: string[];
  options: OptionId[];
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Plain wording for each tip. Figures go through the formatters, so hidden amounts stay hidden. */
export function tipText(tip: Tip): TipText {
  switch (tip.kind) {
    case 'equityHigh':
      return {
        title: `${pct(tip.share)} is in the market`,
        why: `A common guide is about ${pct(tip.guide)}. A 30% fall in shares would take about ${pct(tip.share * 0.3)} off everything you hold.`,
        steps: [
          `Point new investing at steadier things until the mix comes back: about ${formatAmount(tip.toAdd)} in all, with no selling.`,
          `Or move about ${formatAmount(tip.toMove)} out of equity, ideally gains held over a year, where tax is lower.`,
          'Spread the steady part: some bonds for income, some gold, some deposits for safety.',
        ],
        options: ['listedBonds', 'govtBonds', 'debtFunds', 'goldEtf', 'reits', 'deposits'],
      };
    case 'equityLow':
      return {
        title: `Only ${pct(tip.share)} is in the market`,
        why: `A common guide is about ${pct(tip.guide)}. Deposits and PF are safe, but after tax and inflation they grow slowly over the long run.`,
        steps: [
          tip.toMove > 0
            ? `For goals seven or more years away, consider moving up to ${formatAmount(tip.toMove)} from deposits and bonds into equity, a little each month over a year or two.`
            : 'Most of the steady money is in PF, PPF or NPS, so point new investing at equity instead.',
          ...(tip.toMove < tip.gap
            ? [
                `Closing the whole gap to the guide would take about ${formatAmount(tip.gap)}, so new monthly investing can do the rest.`,
              ]
            : []),
          'Low-cost index funds are the simplest place to start.',
        ],
        options: ['indexFunds'],
      };
    case 'goldNone':
      return {
        title: 'No gold in the mix',
        why: 'Gold often holds up when shares fall or the rupee weakens, so a little of it steadies the whole.',
        steps: [
          tip.toAdd > 0
            ? `About ${formatAmount(tip.toAdd)} would bring gold to 10%. A monthly amount spreads the price.`
            : 'About 5–10% of the mix is a common amount.',
          'Paper gold avoids making charges, purity checks and locker fees.',
        ],
        options: ['goldEtf', 'sgb'],
      };
    case 'goldHigh':
      return {
        title: `${pct(tip.share)} is in gold`,
        why: 'Gold earns no income and can go years without gaining. Above about 15–20%, it can hold the mix back.',
        steps: ['Let new investing go elsewhere until gold settles at about 10–15%.'],
        options: [],
      };
    case 'concentration':
      return {
        title: `${tip.name} is ${pct(tip.share)} of everything`,
        why: 'A lot rides on one holding: one bad year for it, or one fund manager, moves the whole portfolio.',
        steps: [
          'Add new money elsewhere instead of to this holding.',
          'Spread equity across an index fund and one or two others with different styles.',
        ],
        options: ['indexFunds', 'debtFunds'],
      };
    case 'highYield':
      return {
        title: `${pct(tip.share)} is in bonds paying 10% or more`,
        why: `${tip.names.join(', ')} pay well because the borrowers are riskier. One default can cost far more than the extra interest earned.`,
        steps: [
          'Keep each issuer to a small slice, and spread across five or more.',
          'Balance them with government bonds, deposits or a debt fund.',
        ],
        options: ['govtBonds', 'deposits', 'debtFunds'],
      };
    case 'emergency':
      return {
        title: 'The emergency fund is short',
        why: `Six months of spending is about ${formatMoney(tip.target)}. The bank, cash and deposits hold ${formatMoney(tip.liquid)}.`,
        steps: [
          `Build up another ${formatMoney(tip.short)} before adding risk, so a job loss or hospital bill doesn't force a sale.`,
          'Keep it where it earns a little but is there the next day.',
        ],
        options: ['liquidFunds', 'deposits'],
      };
    case 'income':
      return {
        title:
          tip.years === null
            ? 'Little steady income from investments'
            : `${tip.years} year${tip.years === 1 ? '' : 's'} to retirement, little steady income`,
        why: `Investments pay about ${formatMoney(tip.monthlyPayouts)} a month in fixed payouts, against spending of about ${formatMoney(tip.monthlySpend)}.`,
        steps: [
          'Build a ladder that pays each month: bonds and deposits that pay on different months.',
          'Government-backed schemes first, then bonds and REITs for more.',
          'Keep high-yield alternatives to a small slice.',
        ],
        options: ['pomis', 'scss', 'listedBonds', 'reits', 'debtFunds', 'invoice', 'aif'],
      };
    case 'locked':
      return {
        title: `${pct(tip.share)} is locked until retirement`,
        why: 'PF, PPF and NPS are good for retirement, but are hard to reach for anything before it.',
        steps: [
          'Build up money you can reach for goals before retiring, such as a house or education.',
        ],
        options: ['debtFunds', 'indexFunds', 'liquidFunds'],
      };
    case 'balanced':
      return {
        title: 'The mix looks balanced',
        why: `${pct(tip.equity)} in the market, close to the ${pct(tip.guide)} guide.`,
        steps: ['Check it once or twice a year, as markets move it away from where you set it.'],
        options: [],
      };
  }
}
