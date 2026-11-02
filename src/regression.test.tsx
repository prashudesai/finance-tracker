import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import type { TrackerData } from './data/repository';
import { Commitments } from './features/cashflow/Commitments';
import { ExpenseForm, IncomeForm } from './features/cashflow/EntryForms';
import { HoldingForm } from './features/investments/HoldingForm';
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
  const payment = { ...expense, category: 'EMI Payment', loanId: 'l', repaymentType: 'emi' as const };
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

const VIEWER: Account = { name: 'V', email: 'v@example.test', role: 'viewer' };

async function openData(account: Account, seed: Partial<TrackerData> = {}) {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Shell account={account} repository={createMemoryRepository({ settings: [settings], ...seed })} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /^Data & backup/ }));
  return within(await screen.findByRole('dialog', { name: 'Data & backup' }));
}
