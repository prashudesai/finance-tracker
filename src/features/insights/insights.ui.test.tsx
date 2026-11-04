import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryRepository } from '../../data/memoryRepository';
import { previousMonth } from '../../domain/calendar';
import { defaultSettings, type Expense, type Income } from '../../schema/records';
import { Shell } from '../../Shell';
import { useTracker } from '../../store/tracker';
import { formatMonth, localDate } from '../../ui/format';

// jsdom has no ResizeObserver or native dialogs.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
};

let next = 0;
const income = (month: string, amount: number): Income => ({
  id: `i${++next}`,
  date: `${month}-01`,
  member: 'A',
  source: 'Salary',
  amount,
});
const dining = (month: string, amount: number): Expense => ({
  id: `e${++next}`,
  date: `${month}-12`,
  category: 'Dining',
  subcategory: '',
  amount,
  isAnnual: false,
});

/** Four months back: three ordinary months of dining, then a dearer one last month. */
function seed() {
  const last = previousMonth(localDate().slice(0, 7));
  const earlier = [previousMonth(last), previousMonth(previousMonth(last))];
  const third = previousMonth(earlier[1] ?? last);
  const months = [third, ...earlier];
  return {
    last,
    data: {
      settings: [{ ...defaultSettings(), onboardingDone: true }],
      income: [...months, last].map((month) => income(month, 1_00_000)),
      expenses: [...months.map((month) => dining(month, 3_000)), dining(last, 4_500)],
    },
  };
}

const show = (data: Parameters<typeof createMemoryRepository>[0]) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Shell repository={createMemoryRepository(data)} />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false, toast: null });
  localStorage.removeItem('hideAmounts');
  localStorage.removeItem('recapSeen');
  vi.useRealTimers();
});

describe('Insights on the dashboard', () => {
  test('shows the most useful few, with the numbers behind each', async () => {
    show(seed().data);
    const card = within(await screen.findByRole('region', { name: 'Insights' }));
    const dining = await card.findByText(/Dining was ₹4,500/);
    expect(dining.textContent).toMatch(/50% more than usual/);
    expect(card.getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    const row = within(dining.closest('li') as HTMLElement);
    fireEvent.click(row.getByRole('button', { name: 'Why?' }));
    expect(row.getByText('Difference')).toBeDefined();
    expect(row.getByText('₹1,500')).toBeDefined();
  });

  test('hiding amounts hides them in insights too', async () => {
    show(seed().data);
    await screen.findByText(/Dining was ₹4,500/);
    fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
    expect(await screen.findByText(/Dining was ₹ ••••/)).toBeDefined();
  });

  test('the monthly recap opens on the latest month, and steps back', async () => {
    const { last } = seed();
    show(seed().data);
    const card = within(await screen.findByRole('region', { name: 'Insights' }));
    fireEvent.click(card.getByRole('button', { name: 'Monthly recap' }));
    const recap = within(
      await screen.findByRole('dialog', { name: 'Monthly recap', hidden: true }),
    );
    // The last finished month, not the one still running.
    expect(recap.getByText(formatMonth(last))).toBeDefined();
    expect(recap.getByText('You kept')).toBeDefined();
    expect(recap.getByText('Where it went')).toBeDefined();
    fireEvent.click(recap.getByRole('button', { name: 'Earlier month', hidden: true }));
    await waitFor(() => expect(recap.queryByText(new RegExp(last.slice(0, 4)))).not.toBeNull());
  });

  test('early in a month, last month’s recap is offered until set aside', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${localDate().slice(0, 7)}-05T10:00:00`));
    const { data } = seed();
    show(data);
    const offer = await screen.findByRole('region', { name: /in numbers$/ });
    expect(within(offer).getByText(/You kept ₹/)).toBeDefined();
    fireEvent.click(within(offer).getByRole('button', { name: 'Dismiss recap' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /in numbers$/ })).toBeNull());
    expect(localStorage.getItem('recapSeen')).toBe(previousMonth(localDate().slice(0, 7)));
  });
});
