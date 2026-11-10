import {
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  Flame,
  Gauge,
  Landmark,
  Scale,
  Shield,
  Sunset,
  Users,
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
import { tipText } from '../mix/tipText';
import {
  formatAmount,
  formatDay,
  formatMoney,
  formatMonth,
  formatShortMonthYear,
} from '../../ui/format';

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
        title: `Add ${formatAmount(insight.extra)} a month to get ${insight.name} back on track`,
        detail: `At the current pace it reaches ${formatAmount(insight.projected)} of the ${formatAmount(insight.needed)} needed by ${formatShortMonthYear(insight.date.slice(0, 7))}.`,
        why: [
          ['Needed, after inflation', formatAmount(insight.needed)],
          ['Expected at the current pace', formatAmount(insight.projected)],
          ['Extra each month', formatAmount(insight.extra)],
        ],
        path: '/analytics/goals',
        note: 'Projections assume steady returns, which markets never give.',
      };
    case 'goalReached':
      return {
        icon: GoalIcon,
        title: `${insight.name} is fully funded`,
        detail: `You've set aside ${formatAmount(insight.saved)}, enough for the ${formatAmount(insight.needed)} it needs. Well done.`,
        why: [
          ['Set aside', formatAmount(insight.saved)],
          ['Needed, after inflation', formatAmount(insight.needed)],
        ],
        path: '/analytics/goals',
      };
    case 'goalEta': {
      const what = insight.measure === 'netWorth' ? 'Net worth' : 'Your investments';
      const years = insight.months === null ? '' : timeFrom(insight.months);
      const sooner =
        insight.fasterBy && insight.reachedBy && insight.fasterBy < insight.reachedBy
          ? ` Investing the ${formatAmount(insight.leftover)} left over each month too would get there by ${formatShortMonthYear(insight.fasterBy)}.`
          : '';
      const why: [string, string][] = [
        [`${what} today`, formatAmount(insight.current)],
        ['Target', formatAmount(insight.target)],
        [
          `Savings contributions a month, this year since ${formatShortMonthYear(insight.since)}`,
          formatAmount(insight.invested),
        ],
        [`Average income, last ${insight.basedOn} months`, formatAmount(insight.income)],
        ['Average spending', formatAmount(insight.expenses)],
        ['Left over, not invested', formatAmount(insight.leftover)],
        ...(insight.principal > 0
          ? ([['Loan principal repaid each month', formatAmount(insight.principal)]] as [
              string,
              string,
            ][])
          : []),
        ['Assumed growth', `${insight.expectedReturn}% a year`],
      ];
      return insight.reachedBy
        ? {
            icon: TrendingUp,
            title: `${what} reaches ${formatAmount(insight.target)} by ${formatShortMonthYear(insight.reachedBy)}`,
            detail: `That's ${years}, with savings contributions of about ${formatAmount(insight.invested)} a month as you have been, plus growth on what you have.${sooner}`,
            why,
            path: '/analytics/goals',
            note: 'Assumes your investing and returns stay as they’ve been. Money left in the bank isn’t counted.',
          }
        : {
            icon: TrendingDown,
            title: `At this pace, ${what.toLowerCase()} won't reach ${formatAmount(insight.target)}`,
            detail:
              insight.leftover > 0
                ? `Your savings contributions are about ${formatAmount(insight.invested)} a month. Investing more of the ${formatAmount(insight.leftover)} left over would help.`
                : 'There are few savings contributions this year, so there’s little to build it with.',
            why,
            path: '/analytics/goals',
          };
    }
    case 'incomeMix':
      return {
        icon: Wallet,
        title: `Salary is ${percent(insight.salaryShare)} of your income`,
        detail: `About ${formatAmount(insight.salary)} a month from salary and ${formatAmount(insight.other)} from other sources${insight.topOther ? `, mostly ${insight.topOther}` : ''}.`,
        why: [
          ['Salary, a month', formatAmount(insight.salary)],
          ['Other income, a month', formatAmount(insight.other)],
          ['Months counted this year', String(insight.months)],
        ],
        path: '/analytics/income',
      };
    case 'salaryRaise':
      return {
        icon: TrendingUp,
        title: `Your salary rose ${percent(insight.change)} in ${formatShortMonthYear(insight.month)}`,
        detail: `From ${formatAmount(insight.from)} to ${formatAmount(insight.to)} a month. A good time to raise your savings contributions too.`,
        why: [
          ['Before', formatAmount(insight.from)],
          ['After', formatAmount(insight.to)],
          ['Rise', percent(insight.change)],
        ],
        path: '/analytics/income',
      };
    case 'incomeYoY': {
      const up = insight.change > 0;
      return {
        icon: up ? TrendingUp : TrendingDown,
        title: `Income is ${up ? 'up' : 'down'} ${percent(Math.abs(insight.change))} on last year`,
        detail: `${formatAmount(insight.thisYear)} from ${formatShortMonthYear(insight.from)} to ${formatShortMonthYear(insight.to)}, against ${formatAmount(insight.lastYear)} in the same months a year before.`,
        why: [
          ['This year', formatAmount(insight.thisYear)],
          ['Same months last year', formatAmount(insight.lastYear)],
        ],
        path: '/analytics/income',
      };
    }
    case 'topEarner':
      return {
        icon: HandCoins,
        title: `${insight.member.split(' ')[0]} brings in ${percent(insight.share)} of household income`,
        detail: `${formatAmount(insight.total)} this year, across ${insight.members} earners.`,
        why: [
          [insight.member, formatAmount(insight.total)],
          ['Share', percent(insight.share)],
        ],
        path: '/analytics/income',
      };
    case 'incomeSteadiness':
      return {
        icon: insight.verdict === 'varies a lot' ? TrendingDown : Wallet,
        title:
          insight.verdict === 'varies a lot'
            ? 'Your income varies a lot from month to month'
            : `Your income has been ${insight.verdict}`,
        detail:
          insight.verdict === 'varies a lot'
            ? `It ranged from ${formatAmount(insight.worst)} to ${formatAmount(insight.best)}. A bigger emergency fund helps with the lean months.`
            : `Usually within ${percent(insight.spread)} of its average over the last ${insight.months} months.`,
        why: [
          ['Best month', formatAmount(insight.best)],
          [`Lowest, ${formatShortMonthYear(insight.worstMonth)}`, formatAmount(insight.worst)],
          ['Typical swing', percent(insight.spread)],
        ],
        path: '/analytics/income',
      };
    case 'per100':
      return {
        icon: PiggyBank,
        title: `Of every ₹100 you earn, ₹${Math.round(insight.left)} is left in the bank`,
        detail: `₹${Math.round(insight.spending)} goes on spending, ₹${Math.round(insight.emis)} on EMIs and ₹${Math.round(insight.invested)} into savings contributions.${insight.left > 25 ? ' Investing some of what’s left would grow it.' : ''}`,
        why: [
          ['Earned this year', formatAmount(insight.income)],
          ['Spending', `₹${Math.round(insight.spending)} of ₹100`],
          ['EMIs', `₹${Math.round(insight.emis)} of ₹100`],
          ['Savings contributions', `₹${Math.round(insight.invested)} of ₹100`],
          ['Left in the bank', `₹${Math.round(insight.left)} of ₹100`],
        ],
        path: '/analytics/income',
      };
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
    case 'mixTip': {
      const text = tipText(insight.tip);
      const [step] = text.steps;
      return {
        icon: Scale,
        title: text.title,
        detail: step ? `${text.why} ${step}` : text.why,
        why: [
          ['In the market', percent(insight.equity)],
          ['Common guide', percent(insight.guide)],
          ['Bonds, deposits and cash', percent(insight.steady)],
          ['Gold', percent(insight.gold)],
        ],
        path: '/analytics/mix',
        note: 'A general rule of thumb, not advice from a SEBI-registered adviser.',
      };
    }
    case 'cushion': {
      const months = insight.months;
      const covers =
        months < 1
          ? `about ${Math.max(1, Math.round(months * 30))} days`
          : months >= 12
            ? `over ${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}`
            : `about ${months.toFixed(1)} months`;
      return {
        icon: Shield,
        title: `Your bank balance covers ${covers} of spending`,
        detail:
          months < 1
            ? 'Less than a month in hand. An emergency fund of 3 to 6 months gives breathing room.'
            : months > 12
              ? 'More than a year sits in the bank. Some of it could be earning more, invested.'
              : months < 3
                ? 'A little thin. 3 to 6 months of spending is a common cushion.'
                : 'A healthy cushion for surprises.',
        why: [
          [`Balance, ${monthName(insight.asOf)} 1`, formatMoney(insight.balance)],
          ['Usual spending a month', formatMoney(insight.monthly)],
        ],
        path: '/cash-flow',
      };
    }
    case 'subscriptions':
      return {
        icon: Repeat,
        title: `${insight.count} regular payments add up to ${formatMoney(insight.yearly)} a year`,
        detail: `The biggest is ${insight.biggest}, ${formatMoney(insight.biggestYearly)} a year. Worth checking each still earns its place.`,
        why: [
          ['Each month', formatMoney(insight.monthly)],
          ['Over a year', formatMoney(insight.yearly)],
          [insight.biggest, `${formatMoney(insight.biggestYearly)} a year`],
        ],
        path: '/cash-flow',
      };
    case 'staleValues':
      return {
        icon: Clock,
        title:
          insight.count === 1
            ? `${insight.names[0] ?? 'An investment'} hasn't had a value update since ${formatDay(insight.oldest)}`
            : `${insight.count} investments haven't had a value update in over 6 weeks`,
        detail: 'Net worth and returns use the last value entered, so they may be out of date.',
        why: [
          ['Oldest update', formatDay(insight.oldest)],
          ...insight.names.map((name): [string, string] => ['Needs a value', name]),
        ],
        path: '/investments',
      };
    case 'savingsRange':
      return {
        icon: ChartColumn,
        title: `Best saving month this year: ${monthName(insight.best.month)}, ${percent(insight.best.rate)} kept`,
        detail: `The lowest was ${monthName(insight.worst.month)}, at ${percent(insight.worst.rate)}.`,
        why: [
          [`Kept in ${formatMonth(insight.best.month)}`, percent(insight.best.rate)],
          [`Kept in ${formatMonth(insight.worst.month)}`, percent(insight.worst.rate)],
          ['Months compared', String(insight.months)],
        ],
        path: '/analytics/income',
      };
    case 'memberSpend': {
      const top = insight.rows[0];
      return {
        icon: Users,
        title: `${top?.member ?? 'One person'} spent the most in ${monthName(insight.month)}, ${formatMoney(top?.amount ?? 0)}`,
        detail: `Out of ${formatMoney(insight.total)} spent that month, by who it was for.`,
        why: insight.rows.map((row): [string, string] => [row.member, formatMoney(row.amount)]),
        path: '/cash-flow',
      };
    }
    case 'ppfRoom':
      return {
        icon: Landmark,
        title: `${formatMoney(insight.room)} of PPF room left this financial year`,
        detail:
          insight.monthsLeft <= 3
            ? `Only ${timeFrom(insight.monthsLeft)} to March. About ${formatMoney(insight.perMonth)} a month would use it, tax-free.`
            : `About ${formatMoney(insight.perMonth)} a month until March would use it, tax-free.`,
        why: [
          ['Paid in this year', formatMoney(insight.contributed)],
          ['Limit', `${formatMoney(150_000)} an account × ${insight.accounts}`],
          ['Months to March', String(insight.monthsLeft)],
        ],
        path: '/investments',
      };
    case 'streak':
      return {
        icon: Flame,
        title: `${insight.months} months in a row keeping over ${percent(insight.threshold)} of income`,
        detail: `Since ${formatMonth(insight.since)}. Last month you kept ${percent(insight.latest)}.`,
        why: [
          ['Months in a row', String(insight.months)],
          ['Last month', percent(insight.latest)],
        ],
        path: '/analytics/income',
      };
    case 'debtFree':
      return {
        icon: BadgeCheck,
        title: `Debt-free by ${formatShortMonthYear(insight.date.slice(0, 7))} at today's EMIs`,
        detail: `${timeFrom(insight.months)} to clear ${formatMoney(insight.remaining)} across ${insight.loans} loan${insight.loans === 1 ? '' : 's'}. Part payments bring it closer.`,
        why: [
          ['Still owed', formatMoney(insight.remaining)],
          ['Loans', String(insight.loans)],
          ['Months to go', String(insight.months)],
        ],
        path: '/debts',
      };
    case 'dailyPace':
      return {
        icon: Gauge,
        title: `Everyday spending is ${formatMoney(insight.perDay)} a day, ${insight.change > 0 ? 'up' : 'down'} ${percent(Math.abs(insight.change))}`,
        detail: `Over the last ${insight.days} days, against ${formatMoney(insight.before)} a day the ${insight.days} before. Bills, EMIs and yearly costs aren't counted.`,
        why: [
          [`Last ${insight.days} days`, `${formatMoney(insight.perDay)} a day`],
          [`${insight.days} days before`, `${formatMoney(insight.before)} a day`],
        ],
        path: '/cash-flow',
      };
    case 'noSpendDays':
      return {
        icon: CalendarCheck,
        title: `${insight.days} no-spend days in ${monthName(insight.month)}`,
        detail: `Days with no everyday spending, out of ${insight.ofDays}.`,
        why: [
          ['No-spend days', String(insight.days)],
          ['Days in the month', String(insight.ofDays)],
        ],
        path: '/cash-flow',
      };
    case 'leftoverToRetirement':
      return {
        icon: Sunset,
        title: `Investing the ${formatMoney(insight.perMonth)} a month left in your bank could add ${formatAmount(insight.value)} by retirement`,
        detail: `At ${insight.growth}% a year until ${formatShortMonthYear(insight.retireDate.slice(0, 7))}. That money doesn't grow sitting in the bank.`,
        why: [
          ['Left in the bank a month', formatMoney(insight.perMonth)],
          ['Months to retirement', String(insight.months)],
          ['Growth assumed', `${insight.growth}% a year`],
        ],
        path: '/analytics/goals',
      };
  }
}
