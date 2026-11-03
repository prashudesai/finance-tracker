import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import type { TrackerData } from './data/repository';
import { Commitments } from './features/cashflow/Commitments';
import { ExpenseForm, IncomeForm } from './features/cashflow/EntryForms';
import { HoldingForm } from './features/investments/HoldingForm';
import { RateInput } from './features/analytics/ProjectionParts';
import { ProjectionPage } from './features/analytics/ProjectionPage';
import {
  defaultSettings,
  incomeSchema,
  type Expense,
  type Holding,
  type RecurringRule,
} from './schema/records';
import { Shell, type Account, type FamilyAccess } from './Shell';
import { useTracker } from './store/tracker';
import { downloadText } from './ui/download';

vi.mock('./ui/download', () => ({ downloadText: vi.fn() }));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false, error: null });
  vi.clearAllMocks();
});

const settings = { ...defaultSettings(), familyMembers: ['Alex', 'Jamie'], onboardingDone: true };

/** Connects the store, for rendering one form without the whole app. */
function connect(seed: Partial<TrackerData>, canEdit = true) {
  useTracker.getState().connect(createMemoryRepository({ settings: [settings], ...seed }), canEdit);
}

const state = () => useTracker.getState().data;

const expense: Expense = {
  id: 'e1',
  date: '2026-10-05',
  category: 'Healthcare',
  subcategory: '',
  amount: 500,
  isAnnual: true,
  member: 'Alex',
};

function submit(button: string) {
  fireEvent.click(screen.getByRole('button', { name: button }));
}

const change = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

test('clearing an expense family member saves it as household', async () => {
  connect({ expenses: [expense] });
  render(<ExpenseForm initial={expense} />);
  change(/Family Member/, '');
  submit('Save expense');
  await waitFor(() => expect(state().expenses[0]?.member).toBeUndefined());
});

test('moving an EMI expense to another category drops its loan link', async () => {
  const payment = {
    ...expense,
    category: 'EMI Payment',
    loanId: 'l',
    repaymentType: 'emi' as const,
  };
  const loan = {
    id: 'l',
    type: 'Car',
    member: 'Alex',
    date: '2020-01-01',
    principal: 100_000,
    openingRate: 0,
    openingEmi: 1000,
    changes: [],
  };
  connect({ expenses: [payment], loans: [loan] });
  render(<ExpenseForm initial={payment} />);
  change('Category', 'Healthcare');
  submit('Save expense');
  await waitFor(() => expect(state().expenses[0]?.category).toBe('Healthcare'));
  expect(state().expenses[0]?.loanId).toBeUndefined();
  expect(state().expenses[0]?.repaymentType).toBeUndefined();
});

test('editing an expense keeps its annual flag and type, even in strict mode', () => {
  const insurance = { ...expense, category: 'Insurance', subcategory: 'Car insurance' };
  connect({ expenses: [insurance] });
  render(
    <StrictMode>
      <ExpenseForm initial={insurance} />
    </StrictMode>,
  );
  expect((screen.getByLabelText('Is Annual Expense?') as HTMLSelectElement).value).toBe('yes');
  expect((screen.getByLabelText('Expense type') as HTMLSelectElement).value).toBe('Car insurance');
});

const posted = {
  ...expense,
  id: 'rec_gym_202610',
  recurringRuleId: 'gym',
  recurringMonth: '2026-10',
};
const gym: RecurringRule = {
  id: 'gym',
  kind: 'expense',
  name: 'Gym',
  category: 'Healthcare',
  subcategory: '',
  isAnnual: false,
  amount: 500,
  day: 5,
  startMonth: '2026-10',
  paused: false,
  amountChanges: [],
};
const occurrence = {
  ruleId: 'gym',
  month: '2026-10',
  status: 'posted' as const,
  recordId: posted.id,
};

test('a posted recurring record stays in its month, with a reason', async () => {
  connect({ expenses: [posted], recurringRules: [gym], recurringOccurrences: [occurrence] });
  render(<ExpenseForm initial={posted} />);
  change('Date', '2026-09-20');
  submit('Save expense');
  await screen.findByText(/stays in October 2026/);
  expect(state().expenses[0]?.date).toBe(posted.date);
  change('Date', '2026-10-20');
  submit('Save expense');
  await waitFor(() => expect(state().expenses[0]?.date).toBe('2026-10-20'));
});

test('recurring income stays in its month too', async () => {
  const income = {
    id: 'rec_pay_202610',
    date: '2026-10-05',
    member: 'Alex',
    source: 'Salary',
    amount: 100,
    recurringRuleId: 'pay',
    recurringMonth: '2026-10',
  };
  connect({ income: [income] });
  render(<IncomeForm initial={income} />);
  change('Date', '2026-09-20');
  submit('Save income');
  await screen.findByText(/stays in October 2026/);
  expect(state().income[0]?.date).toBe(income.date);
});

test('Post explains itself when recurring history is inconsistent', () => {
  // Saved by an earlier version, which let a posted record move to another month.
  const moved = { ...posted, date: '2026-09-20' };
  const due = { ...gym, id: 'rent', name: 'Rent', category: 'Rent' };
  connect({
    expenses: [moved],
    recurringRules: [gym, due],
    recurringOccurrences: [occurrence],
  });
  render(<Commitments open />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0] as HTMLElement);
  expect(useTracker.getState().error).toMatch(/recurring/i);
});

test('editing a recurring item saves its category, and its source and member', async () => {
  connect({ recurringRules: [gym] });
  render(<Commitments open />);
  fireEvent.click(screen.getByLabelText('Edit Gym'));
  change('Category', 'Education');
  submit('Save recurring item');
  await waitFor(() =>
    expect(state().recurringRules[0]).toMatchObject({ category: 'Education', amount: 500 }),
  );
  cleanup();

  const pay: RecurringRule = {
    ...gym,
    id: 'pay',
    kind: 'income',
    name: 'Pay',
    member: 'Alex',
    source: 'Salary',
  } as RecurringRule;
  connect({ recurringRules: [pay] });
  render(<Commitments open />);
  fireEvent.click(screen.getByLabelText('Edit Pay'));
  change('Family Member', 'Jamie');
  submit('Save recurring item');
  await waitFor(() => expect(state().recurringRules[0]).toMatchObject({ member: 'Jamie' }));
});

const fund: Holding = {
  id: 'h',
  kind: 'pf',
  type: 'PF',
  name: 'UAN 1',
  member: 'Alex',
  date: '2024-01-01',
  openingInvested: 100,
  openingValue: 100,
  monthly: 0,
  employee: 1000,
  employer: 1000,
  epsMonthly: 500,
  autoContribute: true,
  autoStart: '2024-02-01',
  notes: 'old note',
  uan: 'UAN 1',
};

test('clearing a holding note, or turning off its schedule, sticks', async () => {
  connect({ holdings: [fund] });
  render(<HoldingForm initial={fund} kind="pf" onDone={() => undefined} />);
  fireEvent.click(screen.getByLabelText(/Add contributions automatically/));
  fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
  await waitFor(() => expect(state().holdings[0]?.autoStart).toBeUndefined());
  cleanup();

  const investment = { ...fund, kind: 'investment' as const, type: 'Mutual Funds' };
  connect({ holdings: [investment] });
  render(<HoldingForm initial={investment} kind="investment" onDone={() => undefined} />);
  change('Notes', '');
  fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
  await waitFor(() => expect(state().holdings[0]?.notes).toBeUndefined());
});

test('notes that are too long say so in plain language', () => {
  const result = incomeSchema.safeParse({
    id: 'i',
    date: '2026-01-01',
    member: 'A',
    source: 'B',
    amount: 1,
    notes: 'x'.repeat(501),
  });
  expect(result.error?.issues[0]?.message).toBe('Use 500 characters or fewer.');
});

test('an empty projection draws its chart without key errors', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  connect({});
  render(
    <MemoryRouter>
      <ProjectionPage />
    </MemoryRouter>,
  );
  await screen.findAllByText(/Projection/);
  expect(errors.mock.calls.filter(([text]) => String(text).includes('same key'))).toEqual([]);
  errors.mockRestore();
});

const VIEWER: Account = { name: 'V', email: 'v@example.test', role: 'viewer' };

async function openData(account: Account, seed: Partial<TrackerData> = {}) {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={account}
        repository={createMemoryRepository({ settings: [settings], ...seed })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Data & backup/ }));
  return within(await screen.findByRole('dialog', { name: 'Data & backup' }));
}

test('a viewer can export a backup with no error', async () => {
  const box = await openData(VIEWER);
  fireEvent.change(box.getByLabelText('Backup passphrase'), {
    target: { value: 'correct horse battery' },
  });
  fireEvent.click(box.getByRole('button', { name: 'Export backup' }));
  await waitFor(() => expect(downloadText).toHaveBeenCalled());
  expect(useTracker.getState().error).toBeNull();
});

test('a viewer is told a restore is not available, not that it worked', async () => {
  const box = await openData(VIEWER);
  const file = new File(['{"format":"finance-tracker","version":2,"data":{}}'], 'b.json');
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve('{"format":"finance-tracker","version":2,"data":{}}'),
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.change(box.getByLabelText('Backup file'), { target: { files: [file] } });
  await box.findByText(/Viewer access/);
  expect(box.queryByText(/^Restored/)).toBeNull();
});

test('a failed invite keeps the typed address', async () => {
  const family: FamilyAccess = {
    watchRequests: () => () => undefined,
    deny: () => Promise.resolve(),
    approve: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    invite: () => Promise.reject(new Error('That invite did not work.')),
    setRole: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'O', email: 'o@example.test', role: 'owner', family }}
        repository={createMemoryRepository({ settings: [settings] })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Family access/ }));
  const box = within(await screen.findByRole('dialog', { name: 'Family access' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Priya' } });
  fireEvent.change(box.getByLabelText('Google email (optional)'), {
    target: { value: 'new@example.test' },
  });
  fireEvent.click(box.getByRole('button', { name: 'Add and invite' }));
  await box.findByText('That invite did not work.');
  expect(screen.queryByRole('option', { name: 'Priya', hidden: true })).toBeNull();
  expect((box.getByLabelText('Google email (optional)') as HTMLInputElement).value).toBe(
    'new@example.test',
  );
});

test('a tracker with no debts does not say debts are 100%', async () => {
  render(
    <MemoryRouter>
      <Shell repository={createMemoryRepository({ settings: [settings] })} />
    </MemoryRouter>,
  );
  const worth = within(await screen.findByRole('region', { name: 'Net worth' }));
  expect(worth.queryByText(/Debts 100/)).toBeNull();
});

test('deleting a holding also removes its interest credits and EPS corrections', async () => {
  const pf = { ...fund, autoContribute: false, autoStart: undefined };
  render(
    <MemoryRouter initialEntries={['/investments']}>
      <Shell
        repository={createMemoryRepository({
          settings: [settings],
          holdings: [pf] as Holding[],
          interestCredits: [
            {
              id: 'interest_h_2024',
              holdingId: 'h',
              financialYearStartYear: 2024,
              creditedDate: '2025-03-31',
              amount: 10,
            },
          ],
          epsUpdates: [{ id: 'eps1', holdingId: 'h', date: '2025-01-01', amount: 5 }],
        })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^PF Accounts/ }));
  fireEvent.click(await screen.findByLabelText('Delete UAN 1'));
  await waitFor(() => expect(state().holdings).toEqual([]));
  expect(state().interestCredits).toEqual([]);
  expect(state().epsUpdates).toEqual([]);
});

test('a cleared rate keeps its saved value, and a typed zero is still saved', () => {
  const save = vi.fn();
  render(<RateInput label="Rate" onChange={save} value={7} />);
  const rate = screen.getByLabelText<HTMLInputElement>('Rate');
  fireEvent.change(rate, { target: { value: '' } });
  fireEvent.blur(rate);
  expect(save).not.toHaveBeenCalled();
  expect(rate.value).toBe('7');
  fireEvent.change(rate, { target: { value: '0' } });
  fireEvent.blur(rate);
  expect(save).toHaveBeenCalledWith(0);
});

test('inviting someone puts their name in the profile list and record forms', async () => {
  const family = {
    list: async () => [],
    invite: vi.fn(async () => undefined),
    setRole: async () => undefined,
    remove: async () => undefined,
    watchRequests: () => () => undefined,
    approve: async () => undefined,
    deny: async () => undefined,
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'Asha Rao', email: 'o@example.test', role: 'owner', family }}
        repository={createMemoryRepository({
          settings: [{ ...settings, onboardingDone: true, familyMembers: [] }],
        })}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByLabelText('Family profile')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: /^Family access/ }));
  const box = within(await screen.findByRole('dialog', { name: 'Family access' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Priya' } });
  fireEvent.change(box.getByLabelText('Google email (optional)'), {
    target: { value: 'new@example.test' },
  });
  fireEvent.click(box.getByRole('button', { name: 'Add and invite' }));
  const profile = await screen.findByLabelText('Family profile', { selector: 'select' });
  expect(within(profile).getByRole('option', { name: 'Asha', hidden: true })).toBeDefined();
  expect(within(profile).getByRole('option', { name: 'Priya', hidden: true })).toBeDefined();
});

test('a name without an email adds only the name, with no invite', async () => {
  const family = {
    list: async () => [],
    invite: vi.fn(async () => undefined),
    setRole: async () => undefined,
    remove: async () => undefined,
    watchRequests: () => () => undefined,
    approve: async () => undefined,
    deny: async () => undefined,
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'Asha Rao', email: 'o@example.test', role: 'owner', family }}
        repository={createMemoryRepository({
          settings: [{ ...settings, onboardingDone: true, familyMembers: ['Asha'] }],
        })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Family access/ }));
  const box = within(await screen.findByRole('dialog', { name: 'Family access' }));
  expect(box.queryByLabelText('Access')).toBeNull();
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Kiran' } });
  fireEvent.click(box.getByRole('button', { name: '+ Add' }));
  await box.findByText('Kiran');
  expect(family.invite).not.toHaveBeenCalled();
});

test('an email shows the access choice and invites a name already listed', async () => {
  const family = {
    list: async () => [],
    invite: vi.fn(async () => undefined),
    setRole: async () => undefined,
    remove: async () => undefined,
    watchRequests: () => () => undefined,
    approve: async () => undefined,
    deny: async () => undefined,
  };
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell
        account={{ name: 'Asha Rao', email: 'o@example.test', role: 'owner', family }}
        repository={createMemoryRepository({
          settings: [{ ...settings, onboardingDone: true, familyMembers: ['Asha', 'Priya'] }],
        })}
      />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Family access/ }));
  const box = within(await screen.findByRole('dialog', { name: 'Family access' }));
  fireEvent.change(box.getByLabelText('Name'), { target: { value: 'Priya' } });
  expect((box.getByRole('button', { name: '+ Add' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(box.getByLabelText('Google email (optional)'), {
    target: { value: 'p@example.test' },
  });
  fireEvent.change(box.getByLabelText('Access'), { target: { value: 'editor' } });
  fireEvent.click(box.getByRole('button', { name: 'Add and invite' }));
  await box.findByText('Priya is invited.');
  expect(box.getByRole('button', { name: /Share invite/ })).toBeDefined();
  expect(family.invite).toHaveBeenCalledWith('p@example.test', 'editor');
});
