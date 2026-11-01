import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import { previewData } from './data/previewData';
import { defaultSettings, type Holding, type Loan } from './schema/records';
import { Shell } from './Shell';
import { useTracker } from './store/tracker';
import { localDate } from './ui/format';

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false });
});

// jsdom has no native dialog behaviour.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};

const month = localDate().slice(0, 7);

function renderApp(path: string, seed: Parameters<typeof createMemoryRepository>[0] = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell repository={createMemoryRepository(seed)} />
    </MemoryRouter>,
  );
}

const loan: Loan = {
  id: 'l',
  type: 'Car',
  member: 'A',
  date: '2020-01-01',
  principal: 500_000,
  openingRate: 0,
  openingEmi: 10_000,
  changes: [],
};

const fund: Holding = {
  id: 'h',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Index fund',
  member: 'A',
  date: '2024-01-01',
  openingInvested: 100_000,
  openingValue: 150_000,
  monthly: 0,
  autoContribute: false,
};

test.each([
  ['/', 'Dashboard'],
  ['/cash-flow', 'Cash flow'],
  ['/investments', 'Investments'],
  ['/debts', 'Debt & EMI Tracker'],
  ['/analytics', 'Analytics'],
  ['/analytics/projection', 'Analytics'],
  ['/analytics/reports', 'Analytics'],
  ['/settings', 'Settings'],
])('%s renders with full sample data', async (path, title) => {
  renderApp(path, previewData());
  expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

test.each([
  '/',
  '/cash-flow',
  '/investments',
  '/debts',
  '/analytics',
  '/analytics/projection',
  '/analytics/reports',
  '/settings',
])('%s renders on an empty account', async (path) => {
  renderApp(path);
  expect(await screen.findByRole('heading', { level: 1 })).toBeDefined();
});

test('the navigation matches the old app', async () => {
  renderApp('/');
  const nav = await screen.findByRole('navigation', { name: 'Main' });
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/',
    '/cash-flow',
    '/investments',
    '/debts',
    '/analytics',
    '/settings',
  ]);
});

test('the dashboard shows net worth from holdings less loans', async () => {
  renderApp('/', { holdings: [fund], loans: [loan] });
  const card = await screen.findByRole('region', { name: 'Net worth' });
  expect(within(card).getByText('-₹3,50,000')).toBeDefined();
  expect(within(card).getByText('₹1,50,000')).toBeDefined();
});

test('the monthly overview reads this month', async () => {
  renderApp('/', {
    income: [{ id: 'i', date: `${month}-01`, member: 'A', source: 'Salary', amount: 100_000 }],
  });
  const region = await screen.findByRole('region', { name: 'This month' });
  expect(within(region).getAllByText('₹1,00,000').length).toBeGreaterThan(0);
});

test('posting a recurring item adds the record', async () => {
  renderApp('/cash-flow', {
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
        startMonth: month,
        paused: false,
        amountChanges: [],
      },
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Post' }));
  expect(await screen.findByText('Nothing is due.')).toBeDefined();
  const region = screen.getByRole('region', { name: 'Selected month' });
  expect(within(region).getByText('₹32,000')).toBeDefined();
});

test('a recurring item that cannot post explains why', async () => {
  renderApp('/cash-flow', {
    recurringRules: [
      {
        id: 'emi',
        kind: 'emi',
        name: 'Car EMI',
        loanId: 'l',
        day: 1,
        startMonth: '2020-02',
        paused: false,
      },
    ],
    loans: [loan],
  });
  const posts = await screen.findAllByRole('button', { name: 'Post' });
  fireEvent.click(posts[1] as HTMLElement);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Car EMI: review earlier missed payments first.',
  );
});

test('adding income validates, then lists the record', async () => {
  renderApp('/cash-flow');
  const submit = await screen.findByRole('button', { name: 'Add income' });
  fireEvent.click(submit);
  expect((await screen.findAllByRole('alert')).map((alert) => alert.textContent)).toEqual([
    'This field is required.',
    'Enter a number.',
  ]);
  fireEvent.change(screen.getByLabelText('Family member'), { target: { value: 'Sam' } });
  fireEvent.change(screen.getAllByLabelText('Amount (₹)')[0] as HTMLElement, {
    target: { value: '5000' },
  });
  fireEvent.click(submit);
  expect(await screen.findByRole('button', { name: 'Edit Salary' })).toBeDefined();
});

test('recording the last EMI pays only what is still owed', async () => {
  renderApp('/debts', { loans: [{ ...loan, principal: 7_000 }] });
  fireEvent.click(await screen.findByRole('button', { name: 'History of Car' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save emi payment', hidden: true }));
  expect(await screen.findByText('Paid off')).toBeDefined();
});

test('scheduled contributions post after loading, not while rendering', async () => {
  renderApp('/investments', {
    holdings: [{ ...fund, monthly: 1000, autoContribute: true, autoStart: `${month}-01` }],
  });
  await screen.findByRole('heading', { level: 1, name: 'Investments' });
  expect((await screen.findAllByText('₹1,51,000')).length).toBeGreaterThan(0);
});

test('a viewer cannot change records', async () => {
  render(
    <MemoryRouter initialEntries={['/cash-flow']}>
      <Shell
        account={{ name: 'V', email: 'v@example.test', role: 'viewer' }}
        repository={createMemoryRepository({
          income: [{ id: 'i', date: `${month}-01`, member: 'A', source: 'Salary', amount: 5 }],
        })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Salary' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/Viewer access/);
  expect(screen.getByRole('button', { name: 'Delete Salary' })).toBeDefined();
});

test('the family profile filters personal records but not expenses', async () => {
  renderApp('/cash-flow', {
    settings: [{ ...defaultSettings(), familyMembers: ['A', 'B'] }],
    income: [
      { id: 'a', date: `${month}-01`, member: 'A', source: 'Salary', amount: 100 },
      { id: 'b', date: `${month}-01`, member: 'B', source: 'Bonus', amount: 200 },
    ],
  });
  fireEvent.change(await screen.findByLabelText('Family profile'), { target: { value: 'B' } });
  expect(await screen.findByRole('button', { name: 'Edit Bonus' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Edit Salary' })).toBeNull();
});

test('invalid stored records are reported, not shown', async () => {
  renderApp('/cash-flow', { income: [{ id: 'bad', amount: -1 } as never] });
  expect((await screen.findByRole('status')).textContent).toBe(
    '1 saved record(s) could not be read and are hidden.',
  );
});

test('search finds a record and opens its page', async () => {
  renderApp('/', {
    income: [{ id: 'i', date: `${month}-01`, member: 'A', source: 'Salary', amount: 25_000 }],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Search records' }));
  fireEvent.change(await screen.findByLabelText(/Search by name/), { target: { value: '25,000' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Cash flow' })).toBeDefined();
});

test('a new account is walked through setup, and can skip it', async () => {
  renderApp('/');
  fireEvent.change(await screen.findByLabelText('First name'), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByText('Step 2 of 6')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Skip setup' }));
  expect(await screen.findByRole('region', { name: 'Net worth' })).toBeDefined();
  expect(screen.queryByText('Step 2 of 6')).toBeNull();
});

test('an archived holding leaves current totals and can be restored', async () => {
  renderApp('/investments', { holdings: [{ ...fund, archived: true }] });
  expect(await screen.findByText('No investments recorded yet.')).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  fireEvent.click(await screen.findByRole('button', { name: /Archived accounts/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore Index fund', hidden: true }));
  expect(await screen.findByText('No archived accounts.')).toBeDefined();
});

test('editing a recurring amount keeps earlier months', async () => {
  renderApp('/cash-flow', {
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
        startMonth: '2020-01',
        paused: true,
        amountChanges: [],
      },
      {
        id: 'gym',
        kind: 'expense',
        name: 'Gym',
        category: 'Health',
        subcategory: '',
        isAnnual: false,
        amount: 2000,
        day: 28,
        startMonth: month,
        paused: false,
        amountChanges: [],
      },
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Gym' }));
  fireEvent.change(await screen.findByLabelText('Monthly amount (₹)'), {
    target: { value: '2500' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save recurring item', hidden: true }));
  expect(await screen.findByText('₹2,500 · monthly')).toBeDefined();
});

test('the change log lists a deletion and can undo it', async () => {
  const income = { id: 'i', date: `${month}-01`, member: 'A', source: 'Salary', amount: 5000 };
  renderApp('/cash-flow', { income: [income] });
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Salary' }));
  expect(await screen.findByText('No income this month.')).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  fireEvent.click(await screen.findByRole('button', { name: /Change log/ }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Undo Deleted income · Salary', hidden: true }),
  );
  expect(
    await screen.findByRole('button', { name: 'Undo Deleted income · Salary', hidden: true }),
  ).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
  fireEvent.click(screen.getByRole('link', { name: /Income & Expense/ }));
  expect(await screen.findByRole('button', { name: 'Edit Salary' })).toBeDefined();
});

test('owners can manage family members', async () => {
  const family = {
    list: async () => [{ email: 'a@example.test', role: 'viewer' as const, accepted: true }],
    invite: async () => undefined,
    setRole: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', family }}
        repository={createMemoryRepository()}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Family access/ }));
  fireEvent.change(
    await screen.findByRole('combobox', { name: 'Access for a@example.test', hidden: true }),
    { target: { value: 'editor' } },
  );
  expect(family.setRole).toHaveBeenCalledWith('a@example.test', 'editor');
  window.confirm = () => true;
  fireEvent.click(screen.getByRole('button', { name: 'Remove a@example.test', hidden: true }));
  expect(family.remove).toHaveBeenCalledWith('a@example.test');
});

test('the app tour walks the pages and changes nothing', async () => {
  renderApp('/settings');
  fireEvent.click(await screen.findByRole('button', { name: /App info/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Start app tour', hidden: true }));
  const tour = await screen.findByRole('region', { name: 'App tour' });
  fireEvent.click(within(tour).getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Cash flow' })).toBeDefined();
  fireEvent.click(within(tour).getByRole('button', { name: 'Skip' }));
  expect(screen.queryByRole('region', { name: 'App tour' })).toBeNull();
});

test('a colour theme applies from Settings and the header agrees on mode', async () => {
  renderApp('/settings');
  fireEvent.click(await screen.findByRole('button', { name: /Appearance/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Obsidian Black/, hidden: true }));
  expect(document.documentElement.style.getPropertyValue('--bg')).toMatch(/#000000|#ededed/);
  fireEvent.click(await screen.findByRole('button', { name: /Modern/, hidden: true }));
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
  const before = document.documentElement.dataset.theme;
  fireEvent.click(
    screen.getAllByRole('button', {
      name: /^Switch to (light|dark) mode$/,
      hidden: true,
    })[0] as HTMLElement,
  );
  expect(document.documentElement.dataset.theme).not.toBe(before);
});

describe('on a phone', () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(max-width: 700px)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia');
  });

  test('each history tab offers only its own add button', async () => {
    renderApp('/cash-flow');
    expect(await screen.findByRole('heading', { name: 'Income History' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Expense History' })).toBeNull();
    expect(screen.queryByLabelText('Amount (₹)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Income' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add Expense' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expenses' }));
    expect(await screen.findByRole('heading', { name: 'Expense History' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add Income' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(await screen.findByRole('dialog', { name: 'Add Expense', hidden: true })).toBeDefined();
  });

  test('investments and retirement are separate tabs', async () => {
    renderApp('/investments', { holdings: [fund] });
    expect(await screen.findByRole('heading', { name: 'Investment Portfolio' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Retirement Accounts' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Retirement' }));
    expect(await screen.findByRole('heading', { name: 'Retirement Accounts' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Investment Portfolio' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Investments' }));
  });
});

test('checking for updates reports back in the app preview', async () => {
  renderApp('/settings');
  fireEvent.click(await screen.findByRole('button', { name: /App & updates/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Check for updates', hidden: true }));
  expect((await screen.findByRole('status', { hidden: true })).textContent).toMatch(
    /Updates are only/,
  );
});
