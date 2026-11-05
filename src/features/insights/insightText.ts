import {
  CalendarClock,
  ChartPie,
  Flag,
  Goal as GoalIcon,
  Clock,
  HandCoins,
  PiggyBank,
  Receipt,
  Repeat,
  Sun,
  Trophy,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Insight } from '../../domain/insights';
import { formatDay, formatMoney, formatMonth, formatShortMonthYear } from '../../ui/format';

export interface InsightText {
  icon: LucideIcon;
  title: string;
  detail: string;
  /** The figures behind it, shown under "Why?". */
  why: [string, string][];
  /** The page that has the records. */
  path: string;
  /** A short caution, for estimates. */
  note?: string;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** "3 years and 4 months", for how long something takes. */
export function timeFrom(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const part = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (years === 0) return part(Math.max(rest, 1), 'month');
  return rest === 0 ? part(years, 'year') : `${part(years, 'year')} and ${part(rest, 'month')}`;
}
const monthName = (month: string) => formatMonth(month).split(' ')[0] ?? month;

/** Plain words for an insight. Amounts go through formatMoney, so hiding amounts hides them. */
export function describeInsight(insight: Insight): InsightText {
  switch (insight.kind) {
    case 'milestone':
      return {
        icon: Trophy,
        title: `Net worth crossed ${formatMoney(insight.milestone)}`,
        detail: `It's ${formatMoney(insight.netWorth)} now. Well done.`,
        why: [['Net worth today', formatMoney(insight.netWorth)]],
        path: '/analytics',
      };
    case 'quiet':
      return {
        icon: Clock,
        title: `Nothing recorded for ${insight.days} days`,
        detail: `The last entry was on ${formatDay(insight.lastDate)}. Add what's happened since, so this month adds up.`,
        why: [['Last income or expense', formatDay(insight.lastDate)]],
        path: '/cash-flow',
      };
    case 'dueSoon':
      return {
        icon: CalendarClock,
        title: `${insight.name}, ${formatMoney(insight.amount)}, is due ${formatDay(insight.date)}`,
        detail: "It's one of your recurring payments.",
        why: [
          ['Amount', formatMoney(insight.amount)],
          ['Due', formatDay(insight.date)],
        ],
        path: '/cash-flow',
      };
    case 'category': {
      const up = insight.amount > insight.usual;
      const change = Math.abs(insight.amount - insight.usual) / insight.usual;
      return {
        icon: up ? TrendingUp : TrendingDown,
        title: `${insight.category} was ${formatMoney(insight.amount)} in ${monthName(insight.month)}, ${percent(change)} ${up ? 'more' : 'less'} than usual`,
        detail: `You usually spend about ${formatMoney(insight.usual)} a month on it.`,
        why: [
          [monthName(insight.month), formatMoney(insight.amount)],
          ['Usual, from up to 3 months before', formatMoney(insight.usual)],
          ['Difference', formatMoney(Math.abs(insight.amount - insight.usual))],
        ],
        path: '/cash-flow',
      };
    }
    case 'savings': {
      const month = monthName(insight.month);
      const title =
        insight.rate < 0
          ? `You spent ${formatMoney(insight.expenses - insight.income)} more than you earned in ${month}`
          : insight.best
            ? `${month} was your best month this year: you kept ${percent(insight.rate)} of income`
            : `You kept ${percent(insight.rate)} of your income in ${month}`;
      return {
        icon: PiggyBank,
        title,
        detail: `Income ${formatMoney(insight.income)}, spending ${formatMoney(insight.expenses)}.`,
        why: [
          ['Income', formatMoney(insight.income)],
          ['Spending, including EMIs', formatMoney(insight.expenses)],
          ['Kept', percent(insight.rate)],
          ...(insight.averageRate === null
            ? []
            : ([['Average earlier this financial year', percent(insight.averageRate)]] as [
                string,
                string,
              ][])),
        ],
        path: '/cash-flow',
      };
    }
    case 'emiLoad':
      return {
        icon: HandCoins,
        title: `EMIs take ${percent(insight.share)} of your income`,
        detail:
          insight.tone === 'good'
            ? 'A comfortable level. Under 30% is generally seen as healthy.'
            : insight.tone === 'neutral'
              ? 'Manageable. Many advisers suggest staying under 40%.'
              : "That's high. Over 40% leaves little room for savings and surprises.",
        why: [
          ['EMIs a month', formatMoney(insight.emi)],
          ['Usual monthly income, last 3 months', formatMoney(insight.income)],
        ],
        path: '/debts',
      };
    case 'prepay':
      return {
        icon: Wallet,
        title: `Paying ${formatMoney(insight.extra)} extra on your ${insight.loan} saves about ${formatMoney(insight.interestSaved)} in interest`,
        detail: `And ${insight.emisSaved} fewer EMI${insight.emisSaved === 1 ? '' : 's'}, if you keep the same EMI.`,
        why: [
          ['Extra payment', formatMoney(insight.extra)],
          ['Interest rate', `${insight.rate}%`],
          ['Interest saved', formatMoney(insight.interestSaved)],
          ['EMIs saved', String(insight.emisSaved)],
        ],
        path: '/debts',
        note: 'An estimate at today’s rate. Your bank’s figure can differ slightly.',
      };
    case 'netWorthChange': {
      const up = insight.change > 0;
      return {
        icon: up ? TrendingUp : TrendingDown,
        title: `Net worth ${up ? 'grew' : 'fell'} ${formatMoney(Math.abs(insight.change))} in ${monthName(insight.month)}`,
        detail: `It was ${formatMoney(insight.netWorth)} at the end of the month.`,
        why: [
          ['Change', formatMoney(Math.abs(insight.change))],
          ['Month-end net worth', formatMoney(insight.netWorth)],
        ],
        path: '/analytics',
      };
    }
    case 'allocation':
      return {
        icon: ChartPie,
        title: `Market investments are ${percent(insight.share)} of your portfolio`,
        detail: `${insight.share > insight.earlier ? 'Up' : 'Down'} from ${percent(insight.earlier)} six months ago.`,
        why: [
          ['Now', percent(insight.share)],
          [`On ${formatDay(insight.since)}`, percent(insight.earlier)],
        ],
        path: '/investments',
      };
    case 'commitments':
      return {
        icon: Repeat,
        title: `${formatMoney(insight.total)} a month goes on ${insight.count} regular payments`,
        detail:
          insight.emis > 0
            ? `${insight.emis} EMI${insight.emis === 1 ? '' : 's'} and ${insight.count - insight.emis} other recurring payment${insight.count - insight.emis === 1 ? '' : 's'}.`
            : 'All from your recurring payments.',
        why: [
          ['Each month', formatMoney(insight.total)],
          ['Payments', String(insight.count)],
        ],
        path: '/cash-flow',
      };
    case 'weekend':
      return {
        icon: Sun,
        title: `${percent(insight.share)} of your everyday spending happens at weekends`,
        detail: `${formatMoney(insight.spent)} over the last ${insight.days} days, not counting EMIs and bills.`,
        why: [
          ['Weekend spending', formatMoney(insight.spent)],
          ['Share of everyday spending', percent(insight.share)],
        ],
        path: '/cash-flow',
      };
    case 'invested':
      return {
        icon: PiggyBank,
        title: `You've invested ${formatMoney(insight.amount)} so far in ${monthName(insight.month)}`,
        detail: 'Contributions you recorded this month, including scheduled ones.',
        why: [['Contributions this month', formatMoney(insight.amount)]],
        path: '/investments',
      };
    case 'principal':
      return {
        icon: HandCoins,
        title: `${formatMoney(insight.amount)} of loan principal repaid so far in ${monthName(insight.month)}`,
        detail: 'The part of your EMIs and part payments that reduced what you owe, not interest.',
        why: [['Principal repaid this month', formatMoney(insight.amount)]],
        path: '/debts',
      };
    case 'pmsGain': {
      const up = insight.change > 0;
      return {
        icon: up ? TrendingUp : TrendingDown,
        title: `PMS gain ${up ? 'rose' : 'fell'} ${formatMoney(Math.abs(insight.change))} in ${monthName(insight.month)}`,
        detail: 'From last month’s closing value to this month’s latest valuation.',
        why: [['Change in PMS gain', formatMoney(Math.abs(insight.change))]],
        path: '/investments',
      };
    }
    case 'goalBehind':
      return {
        icon: Flag,
        title: `Add ${formatMoney(insight.extra)} a month to get ${insight.name} back on track`,
        detail: `At the current pace it reaches ${formatMoney(insight.projected)} of the ${formatMoney(insight.needed)} needed by ${formatShortMonthYear(insight.date.slice(0, 7))}.`,
        why: [
          ['Needed, after inflation', formatMoney(insight.needed)],
          ['Expected at the current pace', formatMoney(insight.projected)],
          ['Extra each month', formatMoney(insight.extra)],
        ],
        path: '/investments?view=goals',
        note: 'Projections assume steady returns, which markets never give.',
      };
    case 'goalReached':
      return {
        icon: GoalIcon,
        title: `${insight.name} is fully funded`,
        detail: `You've set aside ${formatMoney(insight.saved)}, enough for the ${formatMoney(insight.needed)} it needs. Well done.`,
        why: [
          ['Set aside', formatMoney(insight.saved)],
          ['Needed, after inflation', formatMoney(insight.needed)],
        ],
        path: '/investments?view=goals',
      };
    case 'goalEta': {
      const what = insight.measure === 'netWorth' ? 'Net worth' : 'Your investments';
      const years = insight.months === null ? '' : timeFrom(insight.months);
      const why: [string, string][] = [
        [what + ' today', formatMoney(insight.current)],
        ['Target', formatMoney(insight.target)],
        [`Average income, last ${insight.basedOn} months`, formatMoney(insight.income)],
        ['Average spending', formatMoney(insight.expenses)],
        ['Saved each month', formatMoney(insight.saving)],
        ...(insight.principal > 0
          ? ([['Loan principal repaid each month', formatMoney(insight.principal)]] as [
              string,
              string,
            ][])
          : []),
        ['Assumed growth', `${insight.expectedReturn}% a year`],
      ];
      return insight.reachedBy
        ? {
            icon: TrendingUp,
            title: `${what} reaches ${formatMoney(insight.target)} by ${formatShortMonthYear(insight.reachedBy)}`,
            detail: `That's ${years} at your current pace: about ${formatMoney(insight.saving)} saved each month, with growth on what you have.`,
            why,
            path: '/investments?view=goals',
            note: 'Assumes your income, spending and returns stay as they’ve been.',
          }
        : {
            icon: TrendingDown,
            title: `At this pace, ${what.toLowerCase()} won't reach ${formatMoney(insight.target)}`,
            detail:
              insight.saving > 0
                ? `You save about ${formatMoney(insight.saving)} a month, which isn't enough within 50 years.`
                : 'Recent months spent as much as came in, so nothing is left to build it.',
            why,
            path: '/investments?view=goals',
          };
    }
    case 'biggest':
      return {
        icon: Receipt,
        title: `Biggest expense in ${monthName(insight.month)}: ${insight.category}, ${formatMoney(insight.amount)}`,
        detail: insight.note || `On ${formatDay(insight.date)}.`,
        why: [
          ['Amount', formatMoney(insight.amount)],
          ['Date', formatDay(insight.date)],
        ],
        path: '/cash-flow',
      };
  }
}
