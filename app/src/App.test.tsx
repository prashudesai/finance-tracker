import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import { Shell } from './Shell';
import { localDate } from './ui/format';

afterEach(cleanup);

const month = localDate().slice(0, 7);

function renderApp(path: string, seed: Parameters<typeof createMemoryRepository>[0]) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell repository={createMemoryRepository(seed)} />
    </MemoryRouter>,
  );
}

async function stat(label: string) {
  const month = await screen.findByRole('region', { name: 'This month' });
  return within(within(month).getByText(label).parentElement as HTMLElement);
}

test('the dashboard totals the month and derives loan balances', async () => {
  renderApp('/', {
    income: [{ id: 'i', date: `${month}-01`, member: 'A', source: 'Salary', amount: 100_000 }],
    expenses: [
      {
        id: 'e',
        date: `${month}-01`,
        category: 'Rent',
        subcategory: '',
        amount: 30_000,
        isAnnual: false,
      },
    ],
    loans: [
      {
        id: 'l',
        type: 'Car',
        member: 'A',
        date: '2020-01-01',
        principal: 500_000,
        openingRate: 0,
        openingEmi: 10_000,
        changes: [],
      },
    ],
  });
  expect((await stat('Income')).getByText('₹1,00,000')).toBeDefined();
  expect((await stat('Net')).getByText('₹70,000')).toBeDefined();
  expect((await stat('Loans outstanding')).getByText('₹5,00,000')).toBeDefined();
});

test('posting a recurring item adds the record and clears it from the list', async () => {
  renderApp('/', {
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
  expect((await stat('Expenses')).getByText('₹32,000')).toBeDefined();
});

test('adding income validates the form, then lists the record', async () => {
  renderApp('/income', {});
  const submit = await screen.findByRole('button', { name: 'Add income' });
  fireEvent.click(submit);
  expect((await screen.findAllByRole('alert')).map((alert) => alert.textContent)).toEqual([
    'This field is required.',
    'This field is required.',
    'Enter a number.',
  ]);

  fireEvent.change(screen.getByLabelText('Family member'), { target: { value: 'Sam' } });
  fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Bonus' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5000' } });
  fireEvent.click(submit);
  expect(await screen.findByText('Bonus')).toBeDefined();
  expect(screen.getByText('₹5,000')).toBeDefined();
});

test('invalid stored records are reported, not shown', async () => {
  renderApp('/income', {
    income: [{ id: 'bad', amount: -1 } as never],
  });
  expect(await screen.findByRole('status')).toHaveProperty(
    'textContent',
    '1 saved record(s) could not be read and are hidden.',
  );
});

test('recording the last EMI pays only what is still owed', async () => {
  renderApp('/loans', {
    loans: [
      {
        id: 'l',
        type: 'Car',
        member: 'A',
        date: '2020-01-01',
        principal: 7_000,
        openingRate: 0,
        openingEmi: 10_000,
        changes: [],
      },
    ],
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Record EMI for Car' }));
  expect(await screen.findByText('Outstanding ₹0')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Record EMI for Car' })).toBeNull();
});

test('a recurring item that cannot post explains why', async () => {
  renderApp('/', {
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
    loans: [
      {
        id: 'l',
        type: 'Car',
        member: 'A',
        date: '2020-01-01',
        principal: 500_000,
        openingRate: 0,
        openingEmi: 10_000,
        changes: [],
      },
    ],
  });
  const posts = await screen.findAllByRole('button', { name: 'Post' });
  fireEvent.click(posts[1] as HTMLElement);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Car EMI: review earlier missed payments first.',
  );
});
