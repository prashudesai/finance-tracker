import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import { previewData } from './data/previewData';
import { defaultSettings, TRACKER_SETTINGS_ID, type Holding, type Loan } from './schema/records';
import { TrendChart } from './features/dashboard/TrendChart';
import { App } from './App';
import { SignIn } from './features/auth/SignIn';
import { Shell, type Account } from './Shell';
import { useTracker } from './store/tracker';
import { formatMonth, localDate } from './ui/format';
import { isMonthEnd } from './domain/analytics';
import { searchRecords } from './domain/search';
import { previousMonth } from './domain/calendar';

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false, toast: null });
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
  ['/', /^Good (morning|afternoon|evening)/],
  ['/cash-flow', 'Cash flow'],
  ['/investments', 'Investments'],
  ['/debts', 'Debt & EMI Tracker'],
  ['/analytics', 'Analytics'],
  ['/analytics/income', 'Income'],
  ['/analytics/projection', 'Growth Projection'],
  ['/analytics/goals', 'Goal planning'],
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
  '/analytics/income',
  '/analytics/projection',
  '/analytics/goals',
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
  expect(await screen.findByRole('button', { name: /^Open\s+Salary/ })).toBeDefined();
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
  fireEvent.click(await screen.findByRole('button', { name: /^Open\s+Salary/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: true }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/Viewer access/);
  expect(screen.getByRole('button', { name: /^Open\s+Salary/ })).toBeDefined();
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
  expect(await screen.findByRole('button', { name: /^Open\s+Bonus/ })).toBeDefined();
  expect(screen.queryByRole('button', { name: /^Open\s+Salary/ })).toBeNull();
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
  fireEvent.click(await screen.findByRole('button', { name: /^Open\s+Salary/ }));
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
  expect(await screen.findByText('Step 2 of 7')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Skip setup' }));
  expect(await screen.findByRole('region', { name: 'Net worth' })).toBeDefined();
  expect(screen.queryByText('Step 2 of 7')).toBeNull();
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
  fireEvent.click(await screen.findByRole('button', { name: /^Open\s+Salary/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete', hidden: true }));
  expect(await screen.findByText('No income this month.')).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  fireEvent.click(await screen.findByRole('button', { name: /Data & backup/ }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Undo Deleted income · Salary', hidden: true }),
  );
  expect(
    await screen.findByRole('button', { name: 'Undo Deleted income · Salary', hidden: true }),
  ).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
  fireEvent.click(screen.getByRole('link', { name: /Income & Expense/ }));
  expect(await screen.findByRole('button', { name: /^Open\s+Salary/ })).toBeDefined();
});

test('owners can manage family members', async () => {
  const family = {
    list: async () => [{ email: 'a@example.test', role: 'viewer' as const, accepted: true }],
    invite: async () => undefined,
    setRole: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    watchRequests: vi.fn(() => () => undefined),
    approve: vi.fn(async () => undefined),
    deny: vi.fn(async () => undefined),
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

describe('the tour follows quick setup', () => {
  test('after finishing every step', async () => {
    renderApp('/', { settings: [{ ...defaultSettings(), familyMembers: ['A'] }] });
    const setup = await screen.findByRole('region', { name: 'Set up your finances' });
    expect(screen.queryByRole('region', { name: 'App tour' })).toBeNull();
    fireEvent.click(within(setup).getByRole('button', { name: 'Continue' }));
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(within(setup).getByRole('button', { name: 'Skip step' }));
    }
    fireEvent.click(await within(setup).findByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('region', { name: 'App tour' })).toBeDefined();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Set up your finances' })).toBeNull(),
    );
  });

  test('a step opens its form, and saving moves on to the next step', async () => {
    renderApp('/', { settings: [{ ...defaultSettings(), familyMembers: ['A'] }] });
    const setup = await screen.findByRole('region', { name: 'Set up your finances' });
    expect(within(setup).getByRole('group', { name: 'Color themes' })).toBeDefined();
    fireEvent.click(within(setup).getByRole('button', { name: 'Continue' }));
    fireEvent.click(within(setup).getByRole('button', { name: 'Skip step' }));
    expect(await within(setup).findByText('Add your income')).toBeDefined();
    fireEvent.click(within(setup).getByRole('button', { name: 'Add income' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add income', hidden: true });
    fireEvent.change(within(dialog).getByLabelText('Amount (₹)'), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add income', hidden: true }));
    expect(await within(setup).findByText('Add an expense')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Add income', hidden: true })).toBeNull();
    expect(screen.getByText('Step 5 of 7')).toBeDefined();
  });

  test('after skipping setup', async () => {
    renderApp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Skip setup' }));
    expect(await screen.findByRole('region', { name: 'App tour' })).toBeDefined();
  });
});

test('a running month shows no review until its last day', async () => {
  const today = localDate();
  const month = today.slice(0, 7);
  renderApp('/cash-flow', { monthlyBalances: [{ month, startBalance: 100 }] });
  await screen.findByRole('heading', { level: 1, name: 'Cash flow' });
  const monthEnd = isMonthEnd(today);
  expect(screen.queryAllByRole('button', { name: 'Review this month' })).toHaveLength(
    monthEnd ? 1 : 0,
  );
  expect(document.getElementById('month-review') !== null).toBe(monthEnd);
});

test('a past month that needs review still offers it', async () => {
  const past = previousMonth(localDate().slice(0, 7));
  renderApp('/cash-flow', { monthlyBalances: [{ month: past, startBalance: 100 }] });
  fireEvent.change(await screen.findByLabelText('Month'), { target: { value: past } });
  expect(await screen.findByRole('button', { name: 'Review this month' })).toBeDefined();
  expect(document.getElementById('month-review')).not.toBeNull();
});

test('a closing balance opens the next month, and completes the review', async () => {
  const current = localDate().slice(0, 7);
  const past = previousMonth(previousMonth(current));
  const next = previousMonth(current);
  renderApp('/', {
    settings: [{ ...defaultSettings(), onboardingDone: true }],
    monthlyBalances: [{ month: past, startBalance: 1000 }],
  });
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(await screen.findByRole('link', { name: /balance review/, hidden: true }));
  const review = await waitFor(() => {
    const found = document.getElementById('month-review') as HTMLDetailsElement;
    expect(found.open).toBe(true);
    return found;
  });
  expect(within(review).getByText('Closing balance')).toBeDefined();
  expect(within(review).queryByText('Next month opening')).toBeNull();
  fireEvent.click(within(review).getByRole('button', { name: /closing balance$/ }));
  fireEvent.change(await screen.findByLabelText(/Bank balance at the end of/), {
    target: { value: '2500' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save closing balance', hidden: true }));
  await waitFor(() =>
    expect(useTracker.getState().data.monthlyBalances).toContainEqual({
      month: next,
      startBalance: 2500,
    }),
  );
});

test('every page sets its own title, and offers a skip link', async () => {
  renderApp('/debts');
  await screen.findByRole('heading', { level: 1 });
  expect(screen.getByRole('link', { name: 'Skip to content' })).toBeDefined();
  await waitFor(() => expect(document.title).toContain('Finance Tracker'));
  await waitFor(() => expect(document.title).not.toBe('Finance Tracker'));
});

test('a save confirms itself, and Undo takes it back', async () => {
  renderApp('/cash-flow', { settings: [{ ...defaultSettings(), familyMembers: ['A', 'B'] }] });
  const form = (await screen.findByRole('button', { name: 'Add income' })).closest('form');
  if (!form) throw new Error('Income form not found');
  fireEvent.change(within(form).getByLabelText('Family Member'), { target: { value: 'A' } });
  fireEvent.change(within(form).getByLabelText('Amount (₹)'), { target: { value: '500' } });
  fireEvent.submit(form);
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(useTracker.getState().data.income).toEqual([]));
  expect(await screen.findByText('Undone')).toBeDefined();
});

test('a new tracker explains what to do next', async () => {
  renderApp('/investments');
  expect(await screen.findByRole('button', { name: 'Add your first investment' })).toBeDefined();
  cleanup();
  renderApp('/debts');
  expect(await screen.findByRole('button', { name: 'Add your first loan' })).toBeDefined();
});

describe('deleting asks first', () => {
  afterEach(() => vi.restoreAllMocks());

  test('a loan stays if the answer is no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/debts', { loans: [loan] });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Car' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(useTracker.getState().data.loans).toHaveLength(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Car' }));
    await waitFor(() => expect(useTracker.getState().data.loans).toEqual([]));
  });
});

test('search opens the exact income record, in its own month', async () => {
  const past = previousMonth(localDate().slice(0, 7));
  const income = { id: 'found', date: `${past}-03`, member: 'A', source: 'Bonus', amount: 4321 };
  renderApp('/', {
    income: [income],
    settings: [{ ...defaultSettings(), onboardingDone: true }],
  });
  const results = await waitFor(() => {
    expect(useTracker.getState().data.income).toHaveLength(1);
    return searchRecords(useTracker.getState().data, 'Bonus', 'all', localDate()).results;
  });
  expect(results[0]?.state).toEqual({ found: { kind: 'income', id: 'found', month: past } });
});

test('viewers see the month review but cannot act on it', async () => {
  const past = previousMonth(localDate().slice(0, 7));
  render(
    <MemoryRouter initialEntries={['/cash-flow']}>
      <Shell
        account={{ name: 'V', email: 'v@example.test', role: 'viewer' }}
        repository={createMemoryRepository({
          monthlyBalances: [
            { month: past, startBalance: 100 },
            { month: localDate().slice(0, 7), startBalance: 100 },
          ],
        })}
      />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText('Month'), { target: { value: past } });
  await waitFor(() => expect(document.getElementById('month-review')).not.toBeNull());
  expect(screen.queryByRole('button', { name: 'Mark month reviewed', hidden: true })).toBeNull();
});

test('icon buttons name themselves when pointed at or focused', async () => {
  renderApp('/debts', { loans: [loan] });
  const edit = await screen.findByRole('button', { name: 'Edit Car' });
  expect(edit.getAttribute('data-tip')).toBe('Edit');
  expect(edit.hasAttribute('title')).toBe(false);
  fireEvent.mouseOver(edit);
  expect(await screen.findByText('Edit')).toBeDefined();
  fireEvent.pointerDown(document.body);
  await waitFor(() => expect(screen.queryByText('Edit')).toBeNull());
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

test('feedback is sent from App info as a feature or a problem, and a failure says so', async () => {
  const sent: [string, string][] = [];
  let fail = true;
  const sendFeedback = (kind: string, text: string) => {
    if (fail) return Promise.reject(new Error('offline'));
    sent.push([kind, text]);
    return Promise.resolve();
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', sendFeedback }}
        repository={createMemoryRepository()}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /App info/ }));
  const info = within(await screen.findByRole('dialog', { name: 'App info', hidden: true }));
  fireEvent.click(info.getByRole('button', { name: 'Send feedback', hidden: true }));
  expect(screen.getByLabelText('What would you like the app to do?')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Report a problem', hidden: true }));
  const send = screen.getByRole('button', { name: 'Send', hidden: true });
  expect(send).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('What went wrong, and on which screen?'), {
    target: { value: '  Loan tenure did not change  ' },
  });
  fireEvent.click(send);
  expect((await screen.findByRole('alert', { hidden: true })).textContent).toMatch(
    /couldn’t be sent/,
  );
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Send', hidden: true }));
  expect(
    await screen.findByText('Thanks, your report was sent.', undefined, { timeout: 2000 }),
  ).toBeDefined();
  expect(sent).toEqual([['problem', 'Loan tenure did not change']]);
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

  test('loans are tiles with the main figures, and the rest opens on tap', async () => {
    renderApp('/debts', { loans: [loan] });
    const tile = await screen.findByRole('button', { name: /Open\s*Car/ });
    expect(within(tile).getByText('Remaining')).toBeDefined();
    expect(within(tile).getByText('Interest rate')).toBeDefined();
    expect(within(tile).getByText('EMIs left (est.)')).toBeDefined();
    expect(within(tile).queryByText('Total borrowed')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(tile);
    expect(await screen.findByText('Total borrowed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'History', hidden: true }));
    expect(await screen.findByRole('dialog', { name: /Car/, hidden: true })).toBeDefined();
  });

  test('each history tab offers only its own add button', async () => {
    renderApp('/cash-flow');
    expect(await screen.findByRole('heading', { name: 'Income history' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Expense history' })).toBeNull();
    expect(screen.queryByLabelText('Amount (₹)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add income' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expenses' }));
    expect(await screen.findByRole('heading', { name: 'Expense history' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add income' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByRole('dialog', { name: 'Add Expense', hidden: true })).toBeDefined();
  });

  test('investments and retirement are separate tabs', async () => {
    renderApp('/investments', { holdings: [fund] });
    expect(await screen.findByRole('heading', { name: 'Investment portfolio' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Retirement accounts' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Retirement' }));
    expect(await screen.findByRole('heading', { name: 'Retirement accounts' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Investment portfolio' })).toBeNull();
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
  await screen.findByRole('button', { name: 'Add record' });
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

test('+ Add under Investment portfolio lists the types and opens the chosen one', async () => {
  renderApp('/investments', {
    settings: [{ ...defaultSettings(), investmentTypes: ['Gold'] }],
  });
  const heading = await screen.findByRole('heading', { name: 'Investment portfolio' });
  const section = heading.closest('section');
  if (!section) throw new Error('Portfolio section not found');
  for (const name of ['Mutual Funds', 'Bonds', 'Fixed Deposits', 'Stallion PMS', 'Gold']) {
    expect(within(section).getByRole('button', { name, hidden: true })).toBeDefined();
  }
  expect(within(section).queryByRole('button', { name: 'Investment', hidden: true })).toBeNull();
  fireEvent.click(within(section).getByRole('button', { name: 'Bonds', hidden: true }));
  const dialog = await screen.findByRole('dialog', { name: 'Add Bonds', hidden: true });
  expect((within(dialog).getByLabelText('Investment Type') as HTMLSelectElement).value).toBe(
    'Bonds',
  );
});

test('+ Add new in the investment menu saves the type and opens it', async () => {
  renderApp('/investments');
  const heading = await screen.findByRole('heading', { name: 'Investment portfolio' });
  const section = heading.closest('section');
  if (!section) throw new Error('Portfolio section not found');
  fireEvent.click(within(section).getByRole('button', { name: '+ Add new…', hidden: true }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Add investment type',
    hidden: true,
  });
  fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Gold' } });
  fireEvent.change(within(dialog).getByLabelText('Growth calculation'), {
    target: { value: 'market' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save and select', hidden: true }));
  const form = await screen.findByRole('dialog', { name: 'Add Gold', hidden: true });
  expect((within(form).getByLabelText('Investment Type') as HTMLSelectElement).value).toBe('Gold');
});

describe('needs attention', () => {
  const openReview = async (name: RegExp) => {
    fireEvent.click(await screen.findByRole('link', { name, hidden: true }));
    await screen.findByRole('heading', { level: 1 });
  };
  const seen = { settings: [{ ...defaultSettings(), onboardingDone: true }] };

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  test('a balance review opens that month with a way to set the balance', async () => {
    const past = previousMonth(previousMonth(localDate().slice(0, 7)));
    renderApp('/', { ...seen, monthlyBalances: [{ month: past, startBalance: 100 }] });
    await openReview(/balance review/);
    expect(((await screen.findByLabelText('Month')) as HTMLSelectElement).value).toBe(past);
    const review = document.getElementById('month-review') as HTMLDetailsElement;
    await waitFor(() => expect(review.open).toBe(true));
    const set = within(review).getByRole('button', { name: /closing balance$/ });
    fireEvent.click(set);
    expect(
      await screen.findByRole('dialog', { name: /closing balance$/, hidden: true }),
    ).toBeDefined();
  });

  test('a valuation opens the confirmation list', async () => {
    renderApp('/', { ...seen, holdings: [fund] });
    await openReview(/valuation/);
    const list = await waitFor(() => {
      const found = document.getElementById('record-freshness') as HTMLDetailsElement | null;
      expect(found?.open).toBe(true);
      return found;
    });
    expect(list).not.toBeNull();
  });

  test('a confirmed value leaves the list', async () => {
    renderApp('/investments', { holdings: [fund] });
    const confirm = await screen.findByRole('button', { name: /^Confirm value of/, hidden: true });
    fireEvent.click(confirm);
    expect(await screen.findByText('All values are confirmed.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Confirm value of/, hidden: true })).toBeNull();
    expect(screen.getByRole('button', { name: /^Update value of/, hidden: true })).toBeDefined();
  });

  test('marking a month reviewed moves on to the next month', async () => {
    const newer = previousMonth(localDate().slice(0, 7));
    const older = previousMonth(newer);
    const oldest = previousMonth(older);
    const current = localDate().slice(0, 7);
    renderApp('/', {
      ...seen,
      monthlyBalances: [oldest, older, newer, current].map((month) => ({
        month,
        startBalance: 100,
      })),
    });
    await openReview(/balance review/);
    await waitFor(() =>
      expect((screen.getByLabelText('Month') as HTMLSelectElement).value).toBe(newer),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Mark month reviewed' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Month') as HTMLSelectElement).value).toBe(older),
    );
    expect(await screen.findByText(`Month review · ${formatMonth(older)}`)).toBeDefined();
  });

  test('reviewing a month saves its unrecorded house expense as an expense', async () => {
    const current = localDate().slice(0, 7);
    const newer = previousMonth(current);
    renderApp('/', {
      ...seen,
      monthlyBalances: [
        { month: newer, startBalance: 1000 },
        { month: current, startBalance: 600 },
      ],
    });
    await openReview(/balance review/);
    expect(
      await screen.findByText(/saves its ₹400 of unrecorded house expense as an expense/),
    ).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark month reviewed' }));
    await waitFor(() =>
      expect(useTracker.getState().data.expenses).toContainEqual(
        expect.objectContaining({
          id: `unrecorded-${newer}`,
          category: 'Unrecorded house expense',
          amount: 400,
        }),
      ),
    );
  });

  test('an EMI due today can be marked as paid, or hidden for the month', async () => {
    const today = localDate();
    // Days 29 to 31 don't exist in every month, so the made-up loan needs an earlier day.
    if (Number(today.slice(8)) > 28) return;
    localStorage.removeItem('emiRemindersHidden');
    const firstEmi = `${previousMonth(previousMonth(today.slice(0, 7)))}-${today.slice(8)}`;
    const emiLoan = {
      id: 'home',
      type: 'Home Loan',
      member: '',
      date: `${firstEmi.slice(0, 7)}-01`,
      principal: 10_00_000,
      openingRate: 9,
      openingEmi: 20_000,
      firstEmiDate: firstEmi,
      changes: [],
    };
    const paidBefore = [previousMonth(today.slice(0, 7)), firstEmi.slice(0, 7)].map(
      (month, index) => ({
        id: `paid${index}`,
        date: `${month}-${today.slice(8)}`,
        category: 'EMI Payment',
        subcategory: '',
        isAnnual: false,
        amount: 20_000,
        loanId: 'home',
        repaymentType: 'emi' as const,
      }),
    );
    renderApp('/', { ...seen, loans: [emiLoan], expenses: paidBefore });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Mark as paid: Home Loan EMI due today',
        hidden: true,
      }),
    );
    await waitFor(() =>
      expect(useTracker.getState().data.expenses).toContainEqual(
        expect.objectContaining({ loanId: 'home', date: today, repaymentType: 'emi' }),
      ),
    );
    expect(screen.queryByText('Home Loan EMI due today')).toBeNull();
    cleanup();
    renderApp('/', { ...seen, loans: [emiLoan], expenses: paidBefore });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Hide this month: Home Loan EMI due today',
        hidden: true,
      }),
    );
    expect(screen.queryByText('Home Loan EMI due today')).toBeNull();
    expect(useTracker.getState().data.expenses).toHaveLength(2);
  });

  test('a backup reminder opens Data & backup', async () => {
    renderApp('/', { ...seen, holdings: [fund] });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(useTracker.getState().loaded).toBe(true));
    useTracker.setState({ syncedAt: null });
    await openReview(/backup/);
    expect(
      await screen.findByRole('dialog', { name: 'Data & backup', hidden: true }),
    ).toBeDefined();
  });
});

test('desktop projection follows the chosen scenario and edits assumptions', async () => {
  renderApp('/analytics/projection', { holdings: [fund] });
  expect(await screen.findByRole('heading', { level: 1, name: 'Growth Projection' })).toBeDefined();
  expect(await screen.findByText('Base · 5-year projection')).toBeDefined();
  expect(screen.getByRole('columnheader', { name: /Base growth/ })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /^Stress/ }));
  expect(await screen.findByText('Stress · 5-year projection')).toBeDefined();
  expect(screen.getByRole('columnheader', { name: /Stress closing value/ })).toBeDefined();
  expect(screen.getByLabelText('Mutual Funds annual step-up', { exact: false })).toBeDefined();
  expect(screen.getByRole('switch', { name: 'Include monthly contributions' })).toBeDefined();
});

test('projection years can be typed past the end of the slider', async () => {
  renderApp('/analytics/projection', { holdings: [fund] });
  const box = await screen.findByLabelText('Number of years');
  fireEvent.change(box, { target: { value: '15' } });
  fireEvent.blur(box);
  await waitFor(() => expect(useTracker.getState().data.settings[0]?.projectionYears).toBe(15));
  expect(await screen.findByText('Base · 15-year projection')).toBeDefined();
  expect(screen.getByLabelText('Projection years')).toHaveProperty('max', '15');
  fireEvent.change(box, { target: { value: '99' } });
  fireEvent.blur(box);
  await waitFor(() => expect(useTracker.getState().data.settings[0]?.projectionYears).toBe(40));
});

test('phone projection opens assumptions by group and keeps goals last', async () => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(max-width: 700px)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  renderApp('/analytics/projection', { holdings: [fund] });
  expect(await screen.findByRole('heading', { level: 1, name: 'Growth Projection' })).toBeDefined();
  expect(screen.queryByLabelText(/Mutual Funds annual step-up/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Market linked/ }));
  expect(await screen.findByLabelText(/Mutual Funds annual step-up/)).toBeDefined();
  const headings = screen.getByText('Current values and assumptions');
  const planned = screen.getByText('Planned one-time changes');
  // The link to its own page, not the tab of the same name.
  const goal = screen.getByRole('link', { name: /^Goal planning Your goals/ });
  expect(headings.compareDocumentPosition(planned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(planned.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  Reflect.deleteProperty(window, 'matchMedia');
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
  const table = (await screen.findByRole('button', { name: /^Open\s+Bonus/ })).closest('table');
  const sources = () =>
    within(table as HTMLElement)
      .getAllByRole('button', { name: /^Open / })
      .map((button) => button.textContent?.split(',')[0]);
  fireEvent.click(within(table as HTMLElement).getByRole('button', { name: 'Amount' }));
  expect(sources()).toEqual(['Open Bonus', 'Open Salary']);
  fireEvent.click(within(table as HTMLElement).getByRole('button', { name: 'Amount' }));
  expect(sources()).toEqual(['Open Salary', 'Open Bonus']);
  expect(screen.queryByLabelText('Filter Income history')).toBeNull();
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

test('the install card shows after setup, and Not now sets it aside', async () => {
  localStorage.removeItem('installDismissed');
  renderApp('/', { settings: [{ ...defaultSettings(), onboardingDone: true }] });
  const card = await screen.findByRole('region', { name: 'Install the app' });
  fireEvent.click(within(card).getByRole('button', { name: 'Show me how' }));
  expect(await screen.findByRole('dialog', { name: 'How to install', hidden: true })).toBeDefined();
  fireEvent.click(within(card).getByRole('button', { name: 'Not now', hidden: true }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Install the app' })).toBeNull());
  localStorage.removeItem('installDismissed');
});

test('the eye button hides every amount, and shows them again', async () => {
  localStorage.removeItem('hideAmounts');
  renderApp('/', { holdings: [fund], settings: [{ ...defaultSettings(), onboardingDone: true }] });
  expect((await screen.findAllByText('₹1,50,000')).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  await waitFor(() => expect(screen.queryAllByText('₹1,50,000')).toHaveLength(0));
  expect(screen.getAllByText('₹ ••••').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect((await screen.findAllByText('₹1,50,000')).length).toBeGreaterThan(0);
  localStorage.removeItem('hideAmounts');
});

test('the Add expense shortcut opens the expense form', async () => {
  renderApp('/cash-flow?add=expense');
  expect(await screen.findByRole('dialog', { name: 'Add Expense', hidden: true })).toBeDefined();
});

test('App info offers Share the app', async () => {
  renderApp('/settings');
  fireEvent.click(await screen.findByRole('button', { name: /App info/ }));
  const info = within(await screen.findByRole('dialog', { name: 'App info', hidden: true }));
  expect(info.getByRole('button', { name: /Share the app/, hidden: true })).toBeDefined();
});

test('a dashboard portfolio row opens that category', async () => {
  renderApp('/', { holdings: [fund], settings: [{ ...defaultSettings(), onboardingDone: true }] });
  fireEvent.click(await screen.findByRole('link', { name: /Mutual Funds/ }));
  expect(await screen.findByRole('dialog', { name: 'Mutual Funds', hidden: true })).toBeDefined();
});

test('a withdrawal books profit, and deleting it puts the holding back', async () => {
  // Worth 1,50,000 with 1,00,000 invested.
  renderApp('/', { holdings: [fund], settings: [{ ...defaultSettings(), onboardingDone: true }] });
  fireEvent.click(await screen.findByRole('link', { name: /Mutual Funds/ }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Withdraw from Index fund', hidden: true }),
  );
  fireEvent.change(await screen.findByLabelText('Amount withdrawn (₹)'), {
    target: { value: '50000' },
  });
  expect(
    (screen.getByLabelText('Value left after (₹, from your statement)') as HTMLInputElement).value,
  ).toBe('100000');
  // A third of the value, so a third of the cost: 33,333 out and 16,667 booked.
  expect(await screen.findByText('₹33,333')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Save withdrawal', hidden: true }));
  expect((await screen.findAllByText('+₹16,667')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('₹66,667').length).toBeGreaterThan(0);

  fireEvent.click(
    screen.getByRole('button', { name: 'Contribution history of Index fund', hidden: true }),
  );
  fireEvent.change(await screen.findByLabelText('History type'), {
    target: { value: 'withdrawals' },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: /^Remove withdrawal of/, hidden: true }),
  );
  expect(await screen.findByText('No withdrawals recorded yet.')).toBeDefined();
  expect(screen.queryAllByText('+₹16,667')).toHaveLength(0);
  expect(screen.getAllByText('₹1,50,000').length).toBeGreaterThan(0);
});

test('analytics offers the family split and details', async () => {
  renderApp('/analytics', { holdings: [fund, { ...fund, id: 'b', member: 'B', name: 'Other' }] });
  fireEvent.change(await screen.findByLabelText('Returns view'), { target: { value: 'family' } });
  expect((await screen.findAllByText('B')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('View details').length).toBeGreaterThan(2);
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

const memberAccount = (role: 'editor' | 'viewer', deleteAccount?: Account['deleteAccount']) => ({
  name: 'M',
  email: 'm@example.test',
  role,
  ...(deleteAccount ? { deleteAccount } : {}),
});

test("deleting a member's account removes their photo and leaves the records", async () => {
  const deleteAccount = vi.fn(async (clear: () => Promise<void>) => clear());
  const settings = {
    ...defaultSettings(),
    id: TRACKER_SETTINGS_ID,
    photos: { 'm@example.test': 'data:image/jpeg;base64,AA', 'o@example.test': 'kept' },
  };
  const repository = createMemoryRepository({ holdings: [fund], settings: [settings] });
  const commit = vi.spyOn(repository, 'commit');
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell account={memberAccount('editor', deleteAccount)} repository={repository} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  fireEvent.change(await screen.findByLabelText('Type DELETE MY ACCOUNT to confirm'), {
    target: { value: 'DELETE MY ACCOUNT' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete account', hidden: true }));
  await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
  const writes = commit.mock.calls[0]?.[0] ?? [];
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ collection: 'settings' });
  expect(writes[0]).toHaveProperty('value.photos', { 'o@example.test': 'kept' });
});

test('viewers are told why they cannot change their photo', async () => {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell account={memberAccount('viewer')} repository={createMemoryRepository({})} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  expect(await screen.findByText(/Ask the owner for edit access/)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Change photo', hidden: true })).toBeNull();
});

test('delete account says what to type, accepts lowercase, and shows a failure', async () => {
  const deleteAccount = vi.fn(async () => {
    throw new Error('Google sign-in was cancelled.');
  });
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', deleteAccount }}
        repository={createMemoryRepository()}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  const box = await screen.findByLabelText('Type DELETE MY ACCOUNT to confirm');
  expect(box.closest('label')?.textContent).toContain('DELETE MY ACCOUNT');
  fireEvent.change(box, { target: { value: ' delete my account ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete account', hidden: true }));
  expect(deleteAccount).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole('alert', { hidden: true })).toHaveProperty(
    'textContent',
    'Google sign-in was cancelled.',
  );
});

test('Face ID is turned on with the passphrase, and says when a device lacks it', async () => {
  const passkey = {
    available: vi.fn(async () => true),
    enabled: vi.fn(() => false),
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
  };
  const security = {
    changePassphrase: vi.fn(async () => undefined),
    newRecoveryCode: vi.fn(async () => 'CODE'),
    watchDevices: () => () => undefined,
    approveDevice: vi.fn(async () => undefined),
    denyDevice: vi.fn(async () => undefined),
    passkey,
  };
  const account = { name: 'O', email: 'o@example.test', role: 'owner' as const, security };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell account={account} repository={createMemoryRepository()} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  const toggle = await screen.findByRole('switch', {
    name: 'Face ID or fingerprint',
    hidden: true,
  });
  await waitFor(() => expect(toggle).toHaveProperty('disabled', false));
  fireEvent.click(toggle);
  fireEvent.change(await screen.findByLabelText('Enter your passphrase to turn this on'), {
    target: { value: 'my passphrase here' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue', hidden: true }));
  await waitFor(() => expect(passkey.enable).toHaveBeenCalledWith('my passphrase here'));
  await waitFor(() => expect(toggle).toHaveProperty('checked', true));
  expect(screen.queryByLabelText('Enter your passphrase to turn this on')).toBeNull();
  await waitFor(() => expect(toggle).toHaveProperty('disabled', false));
  fireEvent.click(toggle);
  await waitFor(() => expect(passkey.disable).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(toggle).toHaveProperty('checked', false));
  cleanup();
  passkey.available.mockResolvedValue(false);
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell account={account} repository={createMemoryRepository()} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  expect(await screen.findByText(/doesn't support it yet/)).toBeDefined();
});

test('passphrase settings stay compact until one is chosen', async () => {
  const security = {
    changePassphrase: vi.fn(async () => undefined),
    newRecoveryCode: vi.fn(async () => 'NEW-CODE'),
    watchDevices: () => () => undefined,
    approveDevice: vi.fn(async () => undefined),
    denyDevice: vi.fn(async () => undefined),
    passkey: {
      available: vi.fn(async () => false),
      enabled: vi.fn(() => false),
      enable: vi.fn(async () => undefined),
      disable: vi.fn(async () => undefined),
    },
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', security }}
        repository={createMemoryRepository()}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Account/ }));
  const change = await screen.findByRole('button', { name: 'Change passphrase', hidden: true });
  expect(screen.queryByLabelText('Current passphrase')).toBeNull();
  fireEvent.click(change);
  fireEvent.change(screen.getByLabelText('Current passphrase'), { target: { value: 'old' } });
  const value = { target: { value: 'a long new passphrase' } };
  fireEvent.change(screen.getByLabelText('New passphrase'), value);
  fireEvent.change(screen.getByLabelText('Repeat new passphrase'), value);
  fireEvent.click(screen.getByRole('button', { name: 'Save passphrase', hidden: true }));
  await waitFor(() =>
    expect(security.changePassphrase).toHaveBeenCalledWith('old', 'a long new passphrase'),
  );
  expect(await screen.findByText('Passphrase changed.')).toBeDefined();
  expect(screen.queryByLabelText('Current passphrase')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'New recovery code', hidden: true }));
  expect(screen.queryByLabelText('New passphrase')).toBeNull();
  fireEvent.change(screen.getByLabelText('Current passphrase'), { target: { value: 'old' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create code', hidden: true }));
  expect(await screen.findByText('NEW-CODE')).toBeDefined();
});

describe('a family member asking for access', () => {
  const request = { uid: 'n', email: 'new@example.test', code: '1234 5678 9012' };
  const setUp = (path: string) => {
    const family = {
      list: vi.fn(async () => []),
      invite: vi.fn(async () => undefined),
      setRole: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      watchRequests: vi.fn((onChange: (rows: (typeof request)[]) => void) => {
        onChange([request]);
        return () => undefined;
      }),
      approve: vi.fn(async () => undefined),
      deny: vi.fn(async () => undefined),
    };
    render(
      <MemoryRouter initialEntries={[path]}>
        <Shell
          account={{ name: 'O', email: 'o@example.test', role: 'owner', family }}
          repository={createMemoryRepository({
            settings: [{ ...defaultSettings(), onboardingDone: true }],
          })}
        />
      </MemoryRouter>,
    );
    return family;
  };

  test('a pop-up asks on any screen, and Later leaves the alert', async () => {
    const family = setUp('/debts');
    expect(
      await screen.findByRole('dialog', { name: 'Family access request', hidden: true }),
    ).toBeDefined();
    expect(screen.getByText('1234 5678 9012')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Later', hidden: true }));
    await waitFor(() => expect(screen.queryByText('1234 5678 9012')).toBeNull());
    expect(family.approve).not.toHaveBeenCalled();
    expect(useTracker.getState().accessRequests).toEqual([request]);
  });

  test('the pop-up can approve', async () => {
    const family = setUp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Approve', hidden: true }));
    await waitFor(() => expect(family.approve).toHaveBeenCalledWith(request));
  });

  test('the pop-up can deny, after confirming', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const family = setUp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Deny', hidden: true }));
    await waitFor(() => expect(family.deny).toHaveBeenCalledWith(request));
    confirm.mockRestore();
  });

  test('the owner is alerted, and the alert opens the approval', async () => {
    setUp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Later', hidden: true }));
    const link = await screen.findByRole('link', {
      name: 'Review: new@example.test wants access',
      hidden: true,
    });
    fireEvent.click(link);
    expect(await screen.findByText('Code 1234 5678 9012')).toBeDefined();
  });

  test('the owner can approve', async () => {
    const family = setUp('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Later', hidden: true }));
    fireEvent.click(await screen.findByRole('button', { name: /Family access/, hidden: true }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve new@example.test', hidden: true }),
    );
    await waitFor(() => expect(family.approve).toHaveBeenCalledWith(request));
  });

  test('the owner can deny, after confirming', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const family = setUp('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Later', hidden: true }));
    fireEvent.click(await screen.findByRole('button', { name: /Family access/, hidden: true }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Deny new@example.test', hidden: true }),
    );
    await waitFor(() => expect(family.deny).toHaveBeenCalledWith(request));
    confirm.mockRestore();
  });
});

test('a backup needs a strong passphrase before it can be exported', async () => {
  renderApp('/settings', { holdings: [fund] });
  fireEvent.click(await screen.findByRole('button', { name: /Data & backup/ }));
  const button = await screen.findByRole('button', { name: 'Export backup', hidden: true });
  expect(button).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Backup passphrase'), { target: { value: 'too short' } });
  expect(button).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Backup passphrase'), {
    target: { value: 'long enough passphrase' },
  });
  expect(button).toHaveProperty('disabled', false);
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
  // In the Member column, and again under the source for phones.
  expect((await screen.findAllByText('Sam')).length).toBe(2);
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

test('a part payment asks whether to keep or reduce the EMI, and saves the choice', async () => {
  renderApp('/cash-flow', { loans: [loan] });
  const form = (await screen.findByRole('button', { name: 'Add expense' })).closest('form');
  if (!form) throw new Error('Expense form not found');
  fireEvent.change(await screen.findByLabelText('Category'), { target: { value: 'EMI Payment' } });
  fireEvent.change(await screen.findByLabelText('Select Loan/Debt'), { target: { value: 'l' } });
  expect(screen.queryByLabelText('After this payment')).toBeNull();
  fireEvent.change(screen.getByLabelText('Payment type'), { target: { value: 'part-payment' } });
  fireEvent.change(within(form).getByLabelText('Amount (₹)'), { target: { value: '50000' } });
  expect(await screen.findByText(/^EMI stays ₹10,000/)).toBeDefined();
  fireEvent.change(await screen.findByLabelText('After this payment'), {
    target: { value: 'reduce' },
  });
  expect(await screen.findByText(/^New EMI ₹/)).toBeDefined();
  fireEvent.submit(form);
  await waitFor(() => expect(useTracker.getState().data.expenses).toHaveLength(1));
  expect(useTracker.getState().data.expenses[0]).toMatchObject({
    repaymentType: 'part-payment',
    partPaymentAction: 'reduce',
  });
});

test('Cash flow shows what was invested from income and the balance after it', async () => {
  const month = localDate().slice(0, 7);
  renderApp('/cash-flow', {
    holdings: [fund],
    income: [{ id: 'i', date: `${month}-01`, member: 'Alex', source: 'Salary', amount: 1_00_000 }],
    expenses: [
      {
        id: 'e',
        date: `${month}-01`,
        category: 'Food',
        subcategory: '',
        isAnnual: false,
        amount: 30_000,
      },
    ],
    contributions: [
      { id: 'c', holdingId: fund.id, date: `${month}-01`, amount: 20_000, automatic: false },
    ],
  });
  const summary = within(await screen.findByRole('region', { name: 'Selected month' }));
  expect(summary.getByText('Invested from income')).toBeDefined();
  expect(summary.getByText('₹20,000')).toBeDefined();
  // ₹1,00,000 less ₹30,000 spent and ₹20,000 invested.
  expect(summary.getByText('Balance')).toBeDefined();
  expect(summary.getByText('₹50,000')).toBeDefined();
});

test('a gratuity estimate opens to edit its basic salary, or delete it', async () => {
  const account = { id: 'g', member: 'Alex Morgan', date: '2015-04-01', basicSalary: 50_000 };
  renderApp('/investments', { gratuityAccounts: [account] });
  fireEvent.click(await screen.findByRole('button', { name: 'Gratuity: open to edit or delete' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Gratuity', hidden: true }));
  expect(dialog.getByText(/Basic ₹50,000 a month/)).toBeDefined();
  fireEvent.click(
    dialog.getByRole('button', { name: 'Edit gratuity for Alex Morgan', hidden: true }),
  );
  const edit = within(
    await screen.findByRole('dialog', { name: 'Edit gratuity for Alex Morgan', hidden: true }),
  );
  fireEvent.change(edit.getByLabelText('Monthly basic salary (₹)'), { target: { value: '65000' } });
  fireEvent.click(edit.getByRole('button', { name: 'Save changes', hidden: true }));
  await waitFor(() =>
    expect(useTracker.getState().data.gratuityAccounts).toEqual([
      { ...account, basicSalary: 65_000 },
    ]),
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(await screen.findByRole('button', { name: 'Gratuity: open to edit or delete' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Delete gratuity for Alex Morgan', hidden: true }),
  );
  await waitFor(() => expect(useTracker.getState().data.gratuityAccounts).toEqual([]));
  confirm.mockRestore();
});

test('investing stacks on spending, and is left out when nothing was invested', () => {
  const { container, unmount } = render(
    <TrendChart
      months={[
        { month: '2026-10', income: 100, expenses: 60, invested: 30 },
        { month: '2026-11', income: 100, expenses: 50, invested: 0 },
      ]}
    />,
  );
  const months = container.querySelectorAll('[class*="month"]');
  expect(months[0]?.querySelectorAll('[class*="barInvested"]')).toHaveLength(1);
  expect(months[1]?.querySelectorAll('[class*="barInvested"]')).toHaveLength(0);
  expect(screen.getAllByText('Invested from income ₹30').length).toBeGreaterThan(0);
  unmount();
  render(<TrendChart months={[{ month: '2026-10', income: 100, expenses: 60 }]} />);
  expect(screen.queryByText(/Invested from income/)).toBeNull();
});

describe('monthly balances', () => {
  const month = localDate().slice(0, 7);
  const past = previousMonth(month);

  test('asks before replacing a balance, and refuses a negative one', async () => {
    renderApp('/cash-flow', { monthlyBalances: [{ month, startBalance: 500 }] });
    fireEvent.click(await screen.findByRole('button', { name: '+ Set bank balance' }));
    const amount = await screen.findByLabelText(/Bank balance at start/);
    const save = screen.getByRole('button', { name: 'Save opening balance', hidden: true });
    fireEvent.change(amount, { target: { value: '-1' } });
    expect(save).toHaveProperty('disabled', true);
    fireEvent.change(amount, { target: { value: '700' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(save);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(useTracker.getState().data.monthlyBalances[0]?.startBalance).toBe(500);
    confirm.mockReturnValue(true);
    fireEvent.click(save);
    await waitFor(() =>
      expect(useTracker.getState().data.monthlyBalances[0]?.startBalance).toBe(700),
    );
    confirm.mockRestore();
  });

  test('history shows the breakdown of completed months and confirms deleting', async () => {
    renderApp('/cash-flow', {
      monthlyBalances: [
        { month: past, startBalance: 900 },
        { month, startBalance: 500 },
      ],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'View balance history' }));
    const button = await screen.findByRole('button', {
      name: `Delete opening balance for ${formatMonth(past)}`,
      hidden: true,
    });
    expect(
      screen.queryByRole('button', {
        name: `Delete opening balance for ${formatMonth(month)}`,
        hidden: true,
      }),
    ).toBeNull();
    expect(screen.getByText('₹400')).toBeDefined();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(button);
    expect(useTracker.getState().data.monthlyBalances).toHaveLength(2);
    confirm.mockReturnValue(true);
    fireEvent.click(button);
    await waitFor(() => expect(useTracker.getState().data.monthlyBalances).toHaveLength(1));
    confirm.mockRestore();
  });
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

test('the header shows the Google photo when there is one', async () => {
  const { container } = render(
    <MemoryRouter>
      <Shell
        account={{
          name: 'O',
          email: 'o@example.test',
          role: 'owner',
          photo: 'https://lh3.googleusercontent.com/a/photo',
        }}
        repository={createMemoryRepository()}
      />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
  expect(container.querySelector('header img')?.getAttribute('src')).toContain('googleusercontent');
});

test('pull to refresh waits for a long enough pull', async () => {
  renderApp('/');
  await screen.findByRole('heading', { level: 1 });
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  const touch = (type: string, clientY: number) =>
    fireEvent(window, Object.assign(new Event(type), { touches: [{ clientY }] }));
  touch('touchstart', 100);
  touch('touchmove', 160);
  expect(await screen.findByText('Pull to refresh')).toBeDefined();
  touch('touchend', 160);
  expect(reload).not.toHaveBeenCalled();
  touch('touchstart', 100);
  touch('touchmove', 300);
  expect(await screen.findByText('Release to refresh')).toBeDefined();
  touch('touchend', 300);
  expect(reload).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});

test('settings tiles match the old app, with family sections inside', async () => {
  renderApp('/settings');
  await screen.findByRole('button', { name: /App info/ });
  const tiles = screen
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) =>
      /^(App info|Account|Family access|Appearance|Data & backup|App & updates)/.test(text),
    )
    .map(
      (text) =>
        text.match(/^(App info|Account|Family access|Appearance|Data & backup|App & updates)/)?.[0],
    );
  expect(tiles).toEqual([
    'App info',
    'Account',
    'Family access',
    'Appearance',
    'Data & backup',
    'App & updates',
  ]);
  fireEvent.click(screen.getByRole('button', { name: /Family access/ }));
  expect(
    await screen.findByRole('heading', { name: 'Family members', hidden: true }),
  ).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Access', hidden: true })).toBeDefined();
});

test('data & backup has no clear data option', async () => {
  renderApp('/settings', { holdings: [fund] });
  fireEvent.click(await screen.findByRole('button', { name: /Data & backup/ }));
  await screen.findByRole('button', { name: 'Export backup', hidden: true });
  expect(screen.queryByRole('button', { name: 'Clear all data', hidden: true })).toBeNull();
});

describe('a saved device asked about a new one', () => {
  const request = { id: 'r1', device: 'iPhone · Safari', code: '1111 2222 3333' };
  const setUp = (faceId: boolean) => {
    const security = {
      changePassphrase: vi.fn(async () => undefined),
      newRecoveryCode: vi.fn(async () => 'CODE'),
      watchDevices: (onChange: (rows: (typeof request)[]) => void) => {
        onChange([request]);
        return () => undefined;
      },
      approveDevice: vi.fn(async () => undefined),
      denyDevice: vi.fn(async () => undefined),
      passkey: {
        available: vi.fn(async () => true),
        enabled: () => faceId,
        enable: vi.fn(async () => undefined),
        disable: vi.fn(async () => undefined),
      },
    };
    render(
      <MemoryRouter initialEntries={['/debts']}>
        <Shell
          account={{ name: 'O', email: 'o@example.test', role: 'owner', security }}
          repository={createMemoryRepository()}
        />
      </MemoryRouter>,
    );
    return security;
  };

  test('asks on any screen, and approving needs the passphrase', async () => {
    const security = setUp(false);
    expect(await screen.findByText('iPhone · Safari')).toBeDefined();
    const approve = screen.getByRole('button', { name: 'Approve', hidden: true });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your passphrase'), { target: { value: 'my words' } });
    fireEvent.click(approve);
    await waitFor(() => expect(security.approveDevice).toHaveBeenCalledWith(request, 'my words'));
  });

  test('uses Face ID when it is on, and offers the passphrase if that fails', async () => {
    const security = setUp(true);
    security.approveDevice.mockRejectedValueOnce(new Error('Face ID was cancelled.'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Approve with Face ID', hidden: true }),
    );
    await waitFor(() => expect(security.approveDevice).toHaveBeenCalledWith(request, undefined));
    expect(await screen.findByLabelText('Your passphrase')).toBeDefined();
  });

  test('can deny', async () => {
    const security = setUp(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Deny', hidden: true }));
    await waitFor(() => expect(security.denyDevice).toHaveBeenCalledWith(request));
  });
});

test('the features page opens without signing in', async () => {
  window.history.pushState({}, '', '/features');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Finance Tracker' })).toBeDefined();
  expect(screen.getByRole('link', { name: 'Open the app' }).getAttribute('href')).toBe('/');
  window.history.pushState({}, '', '/');
});

describe('privacy page', () => {
  afterEach(() => window.history.pushState({}, '', '/'));

  test('opens without signing in', async () => {
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Your privacy' })).toBeDefined();
    expect(screen.getByText(/cannot be reset for you/)).toBeDefined();
  });

  test('is linked from the sign-in screen', () => {
    render(
      <MemoryRouter>
        <SignIn onSignIn={() => undefined} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Read how your data is handled.' });
    expect(link.getAttribute('href')).toBe('/privacy');
  });
});

test('the sign-in screen says what the app is, for people arriving from a shared link', () => {
  render(
    <MemoryRouter>
      <SignIn onSignIn={() => undefined} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Welcome' })).toBeDefined();
  expect(screen.getByText('All your money in one place')).toBeDefined();
  expect(screen.getByText('Made for families')).toBeDefined();
  expect(screen.getByText('Free and private')).toBeDefined();
  expect(screen.getByRole('link', { name: /See what it does/ }).getAttribute('href')).toBe(
    '/features',
  );
});
