import { addMonths, previousMonth } from '../domain/calendar';
import {
  EMI_CATEGORY,
  defaultSettings,
  type Contribution,
  type Expense,
  type Holding,
  type Income,
  type Loan,
  type Valuation,
} from '../schema/records';
import { localDate } from '../ui/format';
import type { TrackerData } from './repository';

const PREVIEW_MONTHS = 20;
const MEMBERS = ['Alex Morgan', 'Jamie Morgan'];

const SPENDING: [category: string, amount: number][] = [
  ['Groceries', 18_400],
  ['Utilities', 6_200],
  ['Dining out', 7_800],
  ['Transport', 5_100],
  ['Healthcare', 3_400],
  ['Education', 12_000],
];

const loans: Loan[] = [
  {
    id: 'home',
    type: 'Home Loan',
    member: MEMBERS[0] ?? '',
    date: '2024-11-01',
    principal: 1_850_000,
    openingRate: 8.65,
    openingEmi: 23_500,
    changes: [],
  },
  {
    id: 'car',
    type: 'Vehicle Loan',
    member: MEMBERS[1] ?? '',
    date: '2025-02-05',
    principal: 485_000,
    openingRate: 9.1,
    openingEmi: 11_200,
    changes: [],
  },
];

const holding = (
  id: string,
  kind: Holding['kind'],
  type: string,
  name: string,
  member: number,
  date: string,
  openingInvested: number,
  openingValue: number,
  extra: Partial<Holding> = {},
): Holding => ({
  id,
  kind,
  type,
  name,
  member: MEMBERS[member] ?? '',
  date,
  openingInvested,
  openingValue,
  monthly: 0,
  autoContribute: false,
  ...extra,
});

const scheduled = (today: string): Partial<Holding> => ({
  autoContribute: true,
  autoStart: `${addMonths(today, 1).slice(0, 7)}-05`,
});

const holdings = (today: string): Holding[] => [
  holding('pms', 'investment', 'Stallion PMS', 'Long-term PMS', 0, '2024-11-05', 800_000, 800_000, {
    monthly: 25_000,
    ...scheduled(today),
  }),
  holding(
    'fund',
    'investment',
    'Mutual Funds',
    'Balanced Index Fund',
    0,
    '2023-04-10',
    400_000,
    420_000,
  ),
  holding(
    'bond',
    'investment',
    'Bonds',
    'Government Bond 2030',
    1,
    '2024-05-01',
    320_000,
    359_000,
    {
      rate: 7.4,
    },
  ),
  holding('fd', 'investment', 'Fixed Deposits', 'Bank FD 2027', 0, '2024-07-01', 400_000, 443_000, {
    rate: 7.25,
  }),
  holding('etf', 'investment', 'Index ETFs', 'Nifty 50 ETF', 1, '2024-01-15', 183_000, 192_000),
  holding(
    'cash',
    'investment',
    'Cash Reserve',
    'Emergency fund',
    0,
    '2024-02-01',
    125_000,
    125_000,
  ),
  holding('pf', 'pf', 'PF', 'Employer PF', 0, '2023-04-01', 500_000, 620_000, {
    rate: 8.25,
    employee: 7000,
    employer: 3000,
    epsMonthly: 1250,
    epsOpening: 45_000,
    ...scheduled(today),
  }),
  holding('ppf', 'ppf', 'PPF', 'PPF Account', 1, '2023-04-01', 255_000, 300_000, {
    rate: 7.1,
    monthly: 5000,
    ...scheduled(today),
  }),
  holding('nps', 'nps', 'NPS', 'Tier I', 0, '2023-04-01', 340_000, 416_000, {
    monthly: 8000,
    ...scheduled(today),
  }),
];

function expense(id: string, date: string, category: string, amount: number): Expense {
  return { id, date, category, subcategory: '', amount, isAnnual: false };
}

function emiPayments(loan: Loan, today: string) {
  const rows: Expense[] = [];
  const day = Number(loan.date.slice(-2));
  for (let step = 1; ; step++) {
    const date = addMonths(loan.date, step, day);
    if (date > today) return rows;
    rows.push({
      ...expense(`emi-${loan.id}-${date.slice(0, 7)}`, date, EMI_CATEGORY, loan.openingEmi),
      loanId: loan.id,
      repaymentType: 'emi',
    });
  }
}

/** Sample records for the local preview. Amounts vary so charts read naturally. */
export function previewData(): Partial<TrackerData> {
  const today = localDate();
  const current = today.slice(0, 7);
  const income: Income[] = [];
  const expenses: Expense[] = loans.flatMap((loan) => emiPayments(loan, today));
  const contributions: Contribution[] = [];
  const valuations: Valuation[] = [
    { id: 'pms-1', holdingId: 'pms', date: addMonths(today, -5), value: 1_120_000 },
    { id: 'pms-2', holdingId: 'pms', date: addMonths(today, -3), value: 1_260_000 },
    { id: 'pms-3', holdingId: 'pms', date: addMonths(today, -1), value: 1_420_000 },
  ];
  const monthlyBalances = [];

  let month = current;
  for (let index = 0; index < PREVIEW_MONTHS; index++, month = previousMonth(month)) {
    const swing = 1 + ((index * 37) % 23) / 100;
    income.push(
      {
        id: `salary-${month}`,
        date: `${month}-01`,
        member: MEMBERS[0] ?? '',
        source: 'Salary',
        amount: 145_000,
      },
      {
        id: `consulting-${month}`,
        date: [`${month}-02`, today].sort()[0] ?? today,
        member: MEMBERS[1] ?? '',
        source: 'Consulting',
        amount: 62_000 + (index % 4) * 3_000,
      },
    );
    SPENDING.forEach(([category, amount], position) => {
      expenses.push(
        expense(
          `${category.toLowerCase().replace(' ', '-')}-${month}`,
          [`${month}-0${position + 1}`, today].sort()[0] ?? today,
          category,
          Math.round((amount * swing) / 100) * 100 + position * 100,
        ),
      );
    });
    monthlyBalances.push({ month, startBalance: 1_800_000 + (PREVIEW_MONTHS - index) * 14_000 });
    if (index > 0) {
      for (const [holdingId, amount] of [
        ['pms', 25_000],
        ['ppf', 5000],
        ['nps', 8000],
      ] as const) {
        contributions.push({
          id: `preview-${holdingId}-${month}`,
          holdingId,
          date: `${month}-05`,
          amount,
          automatic: false,
        });
      }
    }
  }

  return {
    income,
    expenses,
    loans,
    holdings: holdings(today),
    contributions,
    valuations,
    monthlyBalances,
    interestCredits: [
      {
        id: 'interest_pf_2025',
        holdingId: 'pf',
        financialYearStartYear: 2025,
        creditedDate: '2026-03-31',
        amount: 42_500,
      },
    ],
    gratuityAccounts: [
      { id: 'grat', member: MEMBERS[0] ?? '', date: '2018-06-15', basicSalary: 68_000 },
    ],
    projectionAdjustments: [],
    goals: [
      {
        id: 'goal-college',
        kind: 'education',
        name: "Riya's college",
        target: 25_00_000,
        targetDate: addMonths(today, 120),
        member: '',
        inflation: 10,
        funding: [
          { holdingId: 'fund', share: 1 },
          { holdingId: 'etf', share: 1 },
          { holdingId: 'pms', share: 0.3 },
        ],
      },
      {
        id: 'goal-house',
        kind: 'house',
        name: 'House down payment',
        target: 15_00_000,
        targetDate: addMonths(today, 48),
        member: '',
        inflation: 7,
        funding: [
          { holdingId: 'fd', share: 1 },
          { holdingId: 'bond', share: 1 },
          { holdingId: 'pms', share: 0.5 },
        ],
      },
      {
        id: 'goal-retire',
        kind: 'retirement',
        name: 'Retirement',
        target: 1_50_00_000,
        targetDate: addMonths(today, 240),
        member: '',
        inflation: 6,
        funding: [
          { holdingId: 'pf', share: 1 },
          { holdingId: 'ppf', share: 1 },
          { holdingId: 'nps', share: 1 },
          { holdingId: 'pms', share: 0.2 },
        ],
      },
      {
        id: 'goal-emergency',
        kind: 'emergency',
        name: 'Emergency fund',
        target: 1_10_000,
        targetDate: addMonths(today, 12),
        member: '',
        inflation: 6,
        funding: [{ holdingId: 'cash', share: 1 }],
      },
    ],
    settings: [
      {
        ...defaultSettings(),
        familyMembers: MEMBERS,
        // Add ?setup to the address to see quick setup.
        onboardingDone: typeof window === 'undefined' || !window.location.search.includes('setup'),
        investmentTypes: ['Index ETFs', 'Cash Reserve'],
        expenseCategories: ['Groceries', 'Utilities', 'Dining out', 'Transport'],
        growthTypes: { 'Index ETFs': 'market', 'Cash Reserve': 'no-return' },
      },
    ],
    recurringRules: [
      {
        id: 'rent',
        kind: 'expense',
        name: 'Rent',
        category: 'House Rent',
        subcategory: '',
        isAnnual: false,
        amount: 32_000,
        day: 1,
        startMonth: current,
        paused: false,
        amountChanges: [],
      },
    ],
  };
}
