import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

// jsdom has no ResizeObserver.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
    'Enter a number.',
  ]);
  fireEvent.change(screen.getAllByLabelText('Amount (₹)')[0] as HTMLElement, {
    target: { value: '5000' },
  });
  fireEvent.click(submit);
  expect(await screen.findByRole('button', { name: 'Open Salary' })).toBeDefined();
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
  fireEvent.click(await screen.findByRole('button', { name: 'Open Salary' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: true }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/Viewer access/);
  expect(screen.getByRole('button', { name: 'Open Salary' })).toBeDefined();
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
  expect(await screen.findByRole('button', { name: 'Open Bonus' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Open Salary' })).toBeNull();
});

test('a history row opens its details with edit and delete inside', async () => {
  renderApp('/cash-flow', {
    income: [
      {
        id: 'i',
        date: `${month}-01`,
        member: 'A',
        source: 'Salary',
        amount: 5000,
        notes: 'Bonus month',
      },
    ],
  });
  expect(screen.queryByText('Actions')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: 'Open Salary' }));
  const dialog = await screen.findByRole('dialog', { name: 'Salary', hidden: true });
  expect(within(dialog).getByText('Bonus month')).toBeDefined();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Edit', hidden: true }));
  expect(await screen.findByRole('dialog', { name: 'Edit income', hidden: true })).toBeDefined();
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
  fireEvent.click(await screen.findByRole('button', { name: 'Open Salary' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: true }));
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
  expect(await screen.findByRole('button', { name: 'Open Salary' })).toBeDefined();
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
    expect(screen.getByRole('button', { name: 'Add income' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expenses' }));
    expect(await screen.findByRole('heading', { name: 'Expense History' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add income' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
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

test('the dashboard + opens the add menu and goes to the right entry', async () => {
  renderApp('/', { settings: [{ ...defaultSettings(), onboardingDone: true }] });
  fireEvent.click(await screen.findByRole('button', { name: 'Add record' }));
  for (const name of [
    'Expense or loan payment',
    'Investment',
    'PMS contribution',
    'Loan or debt',
  ]) {
    expect(await screen.findByRole('button', { name, hidden: true })).toBeDefined();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Income', hidden: true }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Cash flow' })).toBeDefined();
  expect(await screen.findByRole('dialog', { name: 'Add Income', hidden: true })).toBeDefined();
});

test('the + stays on the dashboard', async () => {
  renderApp('/debts');
  await screen.findByRole('heading', { level: 1 });
  expect(screen.queryByRole('button', { name: 'Add record' })).toBeNull();
});

test('history tables sort by a column, with no filter box', async () => {
  const row = (id: string, source: string, amount: number) => ({
    id,
    date: `${month}-01`,
    member: 'A',
    source,
    amount,
  });
  renderApp('/cash-flow', { income: [row('a', 'Bonus', 100), row('b', 'Salary', 900)] });
  const table = (await screen.findByRole('button', { name: 'Open Bonus' })).closest('table');
  const sources = () =>
    within(table as HTMLElement)
      .getAllByRole('button', { name: /^Open / })
      .map((button) => button.getAttribute('aria-label'));
  fireEvent.click(within(table as HTMLElement).getByRole('button', { name: 'Amount' }));
  expect(sources()).toEqual(['Open Bonus', 'Open Salary']);
  fireEvent.click(within(table as HTMLElement).getByRole('button', { name: 'Amount' }));
  expect(sources()).toEqual(['Open Salary', 'Open Bonus']);
  expect(screen.queryByLabelText('Filter Income History')).toBeNull();
});

test('a statement corrects one EMI split and balances follow', async () => {
  const loanRow = { ...loan, openingRate: 12, principal: 100_000 };
  const payment = {
    id: 'p',
    date: '2020-02-01',
    category: 'EMI Payment',
    subcategory: '',
    isAnnual: false,
    loanId: 'l',
    repaymentType: 'emi' as const,
    amount: 10_000,
  };
  renderApp('/debts', { loans: [loanRow], expenses: [payment] });
  expect((await screen.findAllByText('₹91,000')).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'History of Car' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Correct interest of 2020-02-01', hidden: true }),
  );
  fireEvent.change(await screen.findByLabelText('Interest on statement (₹)'), {
    target: { value: '2000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save correction', hidden: true }));
  expect((await screen.findAllByText('₹92,000')).length).toBeGreaterThan(0);
});

test('a dashboard portfolio row opens that category', async () => {
  renderApp('/', { holdings: [fund], settings: [{ ...defaultSettings(), onboardingDone: true }] });
  fireEvent.click(await screen.findByRole('link', { name: /Mutual Funds/ }));
  expect(await screen.findByRole('dialog', { name: 'Mutual Funds', hidden: true })).toBeDefined();
});

test('analytics offers the family split and details', async () => {
  renderApp('/analytics', { holdings: [fund, { ...fund, id: 'b', member: 'B', name: 'Other' }] });
  fireEvent.change(await screen.findByLabelText('Returns view'), { target: { value: 'family' } });
  expect((await screen.findAllByText('B')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('View Details').length).toBeGreaterThan(2);
});

test('deleting an account needs the exact phrase, then clears records first', async () => {
  const deleteAccount = vi.fn(async (clear: () => Promise<void>) => clear());
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', deleteAccount }}
        repository={createMemoryRepository({ holdings: [fund] })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  const button = await screen.findByRole('button', { name: 'Delete account', hidden: true });
  expect(button).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Type DELETE MY ACCOUNT to confirm'), {
    target: { value: 'DELETE MY ACCOUNT' },
  });
  fireEvent.click(button);
  expect(deleteAccount).toHaveBeenCalledTimes(1);
});

test('+ Add new saves a value and selects it, and the old custom values tile is gone', async () => {
  renderApp('/cash-flow');
  const source = await screen.findByLabelText('Source');
  fireEvent.change(source, { target: { value: '__add_new__' } });
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Freelance' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and select', hidden: true }));
  await waitFor(() => expect((source as HTMLSelectElement).value).toBe('Freelance'));
  fireEvent.click(screen.getAllByRole('link', { name: /Settings/ })[0] as HTMLElement);
  await screen.findByRole('button', { name: /App info/ });
  expect(screen.queryByRole('button', { name: /Custom values/ })).toBeNull();
});

test('+ Add new refuses a duplicate', async () => {
  renderApp('/cash-flow');
  fireEvent.change(await screen.findByLabelText('Source'), { target: { value: '__add_new__' } });
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'salary' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and select', hidden: true }));
  expect((await screen.findByRole('alert', { hidden: true })).textContent).toBe(
    'That value already exists.',
  );
});

test('a single family member needs no dropdown, and records use them', async () => {
  renderApp('/cash-flow', { settings: [{ ...defaultSettings(), familyMembers: ['Sam'] }] });
  await screen.findByRole('heading', { level: 1, name: 'Cash flow' });
  expect(screen.queryByLabelText('Family profile')).toBeNull();
  expect(screen.queryByLabelText('Family Member')).toBeNull();
  fireEvent.change(screen.getAllByLabelText('Amount (₹)')[0] as HTMLElement, {
    target: { value: '5000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add income' }));
  expect(await screen.findByText('Sam')).toBeDefined();
});

test('two family members bring the dropdowns back', async () => {
  renderApp('/cash-flow', { settings: [{ ...defaultSettings(), familyMembers: ['A', 'B'] }] });
  expect(await screen.findByLabelText('Family profile')).toBeDefined();
  expect(screen.getByLabelText('Family Member')).toBeDefined();
});

test('EMI Payment asks for the loan and suggests the amount', async () => {
  renderApp('/cash-flow', { loans: [loan] });
  fireEvent.change(await screen.findByLabelText('Category'), { target: { value: 'EMI Payment' } });
  fireEvent.change(await screen.findByLabelText('Select Loan/Debt'), { target: { value: 'l' } });
  await waitFor(() =>
    expect((screen.getAllByLabelText('Amount (₹)')[1] as HTMLInputElement).value).toBe('10000'),
  );
  expect(screen.getByLabelText('Payment type')).toBeDefined();
});

test('insurance offers its expense types and defaults to annual', async () => {
  renderApp('/cash-flow');
  fireEvent.change(await screen.findByLabelText('Category'), { target: { value: 'Insurance' } });
  expect(await screen.findByLabelText('Expense type')).toBeDefined();
  await waitFor(() =>
    expect((screen.getByLabelText('Is Annual Expense?') as HTMLSelectElement).value).toBe('yes'),
  );
});

test('the loan form fills the EMI from the tenure until it is typed over', async () => {
  renderApp('/debts');
  fireEvent.click(await screen.findByRole('button', { name: 'Add Loan' }));
  const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
  await screen.findByLabelText('Tenure (Months)');
  fireEvent.change(field('Principal Amount (₹)'), { target: { value: '1200000' } });
  fireEvent.change(field('Interest Rate (% p.a.)'), { target: { value: '0' } });
  fireEvent.change(field('Tenure (Months)'), { target: { value: '120' } });
  await waitFor(() => expect(field('EMI (₹)').value).toBe('10000'));
  fireEvent.change(field('EMI (₹)'), { target: { value: '12000' } });
  fireEvent.change(field('Tenure (Months)'), { target: { value: '60' } });
  await waitFor(() => expect(field('EMI (₹)').value).toBe('12000'));
});
