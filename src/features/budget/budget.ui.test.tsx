import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { createMemoryRepository } from '../../data/memoryRepository';
import { financialYearStart } from '../../domain/calendar';
import { defaultSettings } from '../../schema/records';
import { Shell } from '../../Shell';
import { useTracker } from '../../store/tracker';
import { localDate } from '../../ui/format';

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
Element.prototype.scrollIntoView = () => {};

const fy = financialYearStart(localDate());
const saved = () => useTracker.getState().data.budgets;

const show = () => {
  const repository = createMemoryRepository({
    settings: [{ ...defaultSettings(), onboardingDone: true }],
  });
  render(
    <MemoryRouter initialEntries={['/analytics/budget']}>
      <Shell repository={repository} />
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false, toast: null });
});

describe('Yearly budget', () => {
  test('rent entered for the year is saved by the month, and kids add school fees', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Yearly budget' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Future' }).getAttribute('aria-current')).toBe('page');
    expect(saved()).toHaveLength(0);

    fireEvent.click(await screen.findByRole('button', { name: /^Rent/ }));
    const form = within(await screen.findByRole('dialog', { name: 'Edit Rent', hidden: true }));
    fireEvent.click(form.getByRole('radio', { name: 'For the year', hidden: true }));
    fireEvent.change(form.getByLabelText('Amount for the year'), { target: { value: '360000' } });
    fireEvent.click(form.getByRole('button', { name: 'Save', hidden: true }));
    await waitFor(() => expect(saved()).toHaveLength(1));
    const plan = saved()[0];
    expect(plan?.fy).toBe(fy);
    expect(plan?.lines.find((line) => line.name === 'Rent')?.amount).toBe(30_000);

    const kids = within(screen.getByRole('radiogroup', { name: 'Kids in school' }));
    fireEvent.click(kids.getByRole('radio', { name: '2' }));
    await waitFor(() => expect(saved()[0]?.kids).toBe(2));
    expect(await screen.findByRole('button', { name: /^Kid 2 · school fees/ })).toBeDefined();

    // Set aside a twelfth of the year: rent alone is ₹30,000 a month.
    expect(screen.getByText(/a month to cover it/).textContent).toContain('₹30,000');
  });

  test('a new line needs a name, and copying makes next year with prices up', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Add$/ }));
    const form = within(
      await screen.findByRole('dialog', { name: 'Add to the plan', hidden: true }),
    );
    fireEvent.click(form.getByRole('button', { name: 'Save', hidden: true }));
    expect(form.getByRole('alert', { hidden: true }).textContent).toBe('Give it a name.');
    fireEvent.change(form.getByLabelText('Name'), { target: { value: 'Swimming' } });
    fireEvent.click(form.getByRole('radio', { name: 'Yearly', hidden: true }));
    // A line can count spending in more than one category.
    fireEvent.click(form.getByRole('button', { name: 'Entertainment', hidden: true }));
    fireEvent.click(form.getByRole('button', { name: 'Healthcare', hidden: true }));
    expect(form.queryByRole('button', { name: 'EMI Payment', hidden: true })).toBeNull();
    fireEvent.change(form.getByLabelText('Amount'), { target: { value: '10000' } });
    fireEvent.click(form.getByRole('button', { name: 'Save', hidden: true }));
    await waitFor(() =>
      expect(saved()[0]?.lines.some((line) => line.name === 'Swimming')).toBe(true),
    );
    expect(saved()[0]?.lines.find((line) => line.name === 'Swimming')?.categories).toEqual([
      // In the list's order, whatever order they were picked in.
      'Healthcare',
      'Entertainment',
    ]);

    fireEvent.click(await screen.findByRole('button', { name: /^Create FY/ }));
    await waitFor(() => expect(saved()).toHaveLength(2));
    const next = saved().find((row) => row.fy === fy + 1);
    expect(next?.lines.find((line) => line.name === 'Swimming')?.amount).toBe(10_600);
  });

  test('income is asked for, never taken from records, and saved for the year', async () => {
    show();
    const card = within(await screen.findByRole('region', { name: 'Income vs budget' }));
    expect(card.queryByText('Expected income')).toBeNull();
    fireEvent.click(card.getByRole('button', { name: /Add expected income/ }));
    const form = within(
      await screen.findByRole('dialog', { name: 'Expected income', hidden: true }),
    );
    fireEvent.change(form.getByLabelText('Income a month'), { target: { value: '150000' } });
    fireEvent.click(form.getByRole('button', { name: 'Save', hidden: true }));
    await waitFor(() => expect(saved()[0]?.income).toBe(18_00_000));
    expect(card.getByText('Expected income')).toBeDefined();
    // An empty plan and no loans leave all of it.
    expect(card.getByRole('img', { name: /left 100%$/ })).toBeDefined();
    fireEvent.click(card.getByRole('button', { name: 'Budget only' }));
    await waitFor(() => expect(saved()[0]?.income).toBe(0));
    expect(card.getByText('Optional')).toBeDefined();
  });

  test('Budget vs actual asks for a plan first, then compares it with spending', async () => {
    const repository = createMemoryRepository({
      settings: [{ ...defaultSettings(), onboardingDone: true }],
      budgets: [
        {
          id: `fy-${fy}`,
          fy,
          kids: 0,
          income: 0,
          lines: [
            {
              id: 'food',
              name: 'Groceries',
              group: 'home',
              amount: 1_000,
              every: 'month',
              months: [],
              categories: ['Groceries'],
            },
          ],
        },
      ],
      expenses: [
        {
          id: 'e1',
          date: localDate(),
          category: 'Groceries',
          subcategory: '',
          isAnnual: false,
          amount: 50_000,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/analytics/budget-actual']}>
        <Shell repository={repository} />
      </MemoryRouter>,
    );
    const categories = within(await screen.findByRole('region', { name: 'By category' }));
    expect(categories.getByText('Groceries')).toBeDefined();
    expect(categories.getByText(/over$/).textContent).toMatch(/^₹\d/);
    expect(screen.getByRole('link', { name: 'Insights' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
