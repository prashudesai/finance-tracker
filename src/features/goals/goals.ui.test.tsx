import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMemoryRepository } from '../../data/memoryRepository';
import { addMonths } from '../../domain/calendar';
import { defaultSettings, type Goal, type Holding } from '../../schema/records';
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

const saved = () => useTracker.getState().data;

const today = localDate();
const fund: Holding = {
  id: 'fund',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Index fund',
  member: 'A',
  date: '2024-01-01',
  openingInvested: 4_00_000,
  openingValue: 4_00_000,
  monthly: 10_000,
  autoContribute: false,
};
const college: Goal = {
  id: 'college',
  kind: 'education',
  name: 'College',
  target: 25_00_000,
  targetDate: addMonths(today, 120),
  member: '',
  inflation: 10,
  funding: [{ holdingId: 'fund', share: 0.5 }],
};

const pfAccount = (id: string, name: string): Holding => ({
  ...fund,
  id,
  kind: 'pf',
  type: 'PF',
  name,
  openingInvested: 1_00_000,
  openingValue: 1_00_000,
});

const show = (path: string, goals: Goal[] = [], extra: Holding[] = []) => {
  const repository = createMemoryRepository({
    holdings: [fund, ...extra],
    goals,
    settings: [{ ...defaultSettings(), onboardingDone: true }],
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell repository={repository} />
    </MemoryRouter>,
  );
};

afterEach(() => {
  cleanup();
  useTracker.setState({ profile: null, tourOpen: false, toast: null });
  localStorage.removeItem('goalsNudgeDismissed');
  vi.restoreAllMocks();
});

describe('Goals', () => {
  test('a goal is added from a share of an investment, and shows how far along it is', async () => {
    show('/analytics/goals');
    const section = within(await screen.findByRole('region', { name: 'Goals' }));
    fireEvent.click(section.getByRole('button', { name: /Add goal/ }));
    const form = within(await screen.findByRole('dialog', { name: 'Add a goal', hidden: true }));
    fireEvent.click(form.getByRole('radio', { name: 'Car', hidden: true }));
    expect((form.getByLabelText('Name') as HTMLInputElement).value).toBe('Car');
    fireEvent.change(form.getByLabelText("Cost in today's rupees (₹)"), {
      target: { value: '800000' },
    });
    fireEvent.change(form.getByLabelText('Share of Index fund (%)'), { target: { value: '150' } });
    expect(form.getByRole('alert', { hidden: true }).textContent).toMatch(
      /Only 100% of Index fund/,
    );
    fireEvent.change(form.getByLabelText('Share of Index fund (%)'), { target: { value: '25' } });
    fireEvent.click(form.getByRole('button', { name: 'Add goal', hidden: true }));
    const card = await section.findByRole('button', { name: /^Car: \d+% saved/ });
    // A quarter of ₹4,00,000.
    expect(card.textContent).toContain('₹1L of');
  });

  test('PF accounts are one row, named PF, and a share covers each account', async () => {
    show(
      '/analytics/goals',
      [],
      [pfAccount('pf1', '100281757735'), pfAccount('pf2', '100896586946')],
    );
    const section = within(await screen.findByRole('region', { name: 'Goals' }));
    fireEvent.click(section.getByRole('button', { name: /Add goal/ }));
    const form = within(await screen.findByRole('dialog', { name: 'Add a goal', hidden: true }));
    expect(form.queryByText('100281757735')).toBeNull();
    expect(form.getByText(/₹2L · 2 accounts · 100% free/)).toBeDefined();
    fireEvent.change(form.getByLabelText("Cost in today's rupees (₹)"), {
      target: { value: '500000' },
    });
    fireEvent.change(form.getByLabelText('Share of PF (%)'), { target: { value: '50' } });
    fireEvent.click(form.getByRole('button', { name: 'Add goal', hidden: true }));
    await waitFor(() =>
      expect(saved().goals[0]?.funding).toEqual([
        { holdingId: 'pf1', share: 0.5 },
        { holdingId: 'pf2', share: 0.5 },
      ]),
    );
  });

  test('the detail says what to do, and what-if changes nothing saved', async () => {
    show('/analytics/goals', [college]);
    fireEvent.click(await screen.findByRole('button', { name: /^College:/ }));
    const detail = within(await screen.findByRole('dialog', { name: 'College', hidden: true }));
    expect(detail.getByText(/Add ₹[\d.,]+L? more a month to reach it on time/)).toBeDefined();
    expect(detail.getByText('Behind')).toBeDefined();
    const monthly = detail.getByRole('slider', { name: /Each month/, hidden: true });
    fireEvent.change(monthly, { target: { value: '50000' } });
    expect(detail.getByText(/Heading for ₹[\d.,]+(L| Cr)? of ₹[\d.,]+(L| Cr)?\./)).toBeDefined();
    expect(saved().goals).toEqual([college]);
  });

  test('deleting a goal leaves the investments alone', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    show('/analytics/goals', [college]);
    fireEvent.click(await screen.findByRole('button', { name: /^College:/ }));
    const detail = within(await screen.findByRole('dialog', { name: 'College', hidden: true }));
    fireEvent.click(detail.getByRole('button', { name: 'Delete', hidden: true }));
    await waitFor(() => expect(saved().goals).toEqual([]));
    expect(saved().holdings).toHaveLength(1);
  });

  test('a portfolio target says when net worth gets there, from income less spending', async () => {
    show('/analytics/goals', [
      {
        id: 'worth',
        kind: 'portfolio',
        name: 'Net worth ₹50 lakh',
        target: 50_00_000,
        member: '',
        inflation: 0,
        funding: [],
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /^Net worth ₹50 lakh:/ }));
    const detail = within(
      await screen.findByRole('dialog', { name: 'Net worth ₹50 lakh', hidden: true }),
    );
    expect(detail.getByText(/Net worth today/)).toBeDefined();
    // No income or spending recorded, so growth alone gets there.
    expect(detail.getByText(/At your current pace you'll get there by/)).toBeDefined();
    expect(detail.queryByRole('slider', { name: /Needed by/, hidden: true })).toBeNull();
  });

  test('a retirement date left at the 60th birthday moves with the birth date', async () => {
    show('/analytics/goals');
    const planner = within(await screen.findByRole('region', { name: 'Retirement planner' }));
    fireEvent.click(planner.getByText('Your assumptions'));
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -480) },
    });
    expect(planner.getByText("You'll be 60")).toBeDefined();
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -600) },
    });
    expect(planner.getByText("You're 50")).toBeDefined();
    expect(planner.getByText("You'll be 60")).toBeDefined();
  });

  test('the retirement planner follows the fund to retirement and says how long it lasts', async () => {
    show('/analytics/goals');
    const planner = within(await screen.findByRole('region', { name: 'Retirement planner' }));
    fireEvent.click(planner.getByText('Your assumptions'));
    fireEvent.change(planner.getByLabelText('Monthly spending today (₹)'), {
      target: { value: '50000' },
    });
    expect(planner.getByRole('alert').textContent).toMatch(/Enter your date of birth/);
    // Forty years ago, so retirement at 60 is twenty years away.
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -480) },
    });
    expect(planner.getByText("You're 40")).toBeDefined();
    expect(planner.getByText("You'll be 60")).toBeDefined();
    // ₹4 lakh today, with no contributions recorded, can't pay ₹50,000 a month for long.
    expect(planner.getByText(/Your money runs out in \w+ \d{4}, at \d+/)).toBeDefined();
    expect(planner.getByText(/more a month until you retire/)).toBeDefined();
    expect(planner.getByText('To make it last until 85')).toBeDefined();
    // The table starts this month, by financial year, with a mark where retirement starts.
    fireEvent.click(planner.getByText('Year by year'));
    const rows = planner.getAllByText(/^FY \d{4}-\d{2}( · .*)? · age \d+$/);
    // This month to March, then whole financial years.
    expect(rows[0]?.textContent).toMatch(/· \w+ \d{4}( – Mar \d{4})? · age 40$/);
    // A whole financial year shows the year alone.
    expect(rows.some((row) => /^FY \d{4}-\d{2} · age \d+$/.test(row.textContent ?? ''))).toBe(true);
    expect(planner.getAllByText(/^Retire in \w+ \d{4} at 60, with ₹/).length).toBe(1);
    const need = within(planner.getByRole('region', { name: "What you'll need" }));
    expect(need.getByText('Needed at 60')).toBeDefined();
    expect(need.getByText(/short$/)).toBeDefined();
    expect(need.getByText(/Invest about ₹[\d.,]+(L| Cr)? a month from now/)).toBeDefined();
    fireEvent.change(planner.getByLabelText('Monthly spending today (₹)'), {
      target: { value: '2000' },
    });
    expect(planner.getByText(/Your money lasts past 85, with ₹[\d.,]+(L| Cr)? left/)).toBeDefined();
    fireEvent.change(planner.getByLabelText(/^Retire on/), {
      target: { value: addMonths(today, 216) },
    });
    expect(planner.getByText("You'll be 58")).toBeDefined();
    // A chosen date stays put when the birth date changes.
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -492) },
    });
    expect(planner.getByText("You'll be 59")).toBeDefined();
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -480) },
    });
    fireEvent.click(planner.getByRole('button', { name: 'Save and close' }));
    await waitFor(() =>
      expect(saved().settings[0]?.retirement).toMatchObject({
        birthDate: addMonths(today, -480),
        retireDate: addMonths(today, 216),
        monthlyExpense: 2000,
      }),
    );
  });

  test('each investment can grow, pay income or both after retiring', async () => {
    show('/analytics/goals');
    const planner = within(await screen.findByRole('region', { name: 'Retirement planner' }));
    fireEvent.click(planner.getByText('Your assumptions'));
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -480) },
    });
    fireEvent.change(planner.getByLabelText('Monthly spending today (₹)'), {
      target: { value: '50000' },
    });
    expect(planner.getByLabelText('Growth after retiring (%)')).toBeDefined();
    fireEvent.click(planner.getByRole('radio', { name: /Set each investment/ }));
    expect(planner.queryByLabelText('Growth after retiring (%)')).toBeNull();
    const rows = within(planner.getByRole('list', { name: 'Each investment after retiring' }));
    const first = within(rows.getAllByRole('listitem')[0] as HTMLElement);
    fireEvent.click(first.getByRole('radio', { name: 'Income' }));
    expect(first.getByText(/a month when you retire, on ₹.*, which stays the same/)).toBeDefined();
    expect(planner.getByText(/Payouts cover ₹/)).toBeDefined();
    // A rate left blank asks for one, rather than counting as 0%.
    fireEvent.change(first.getByLabelText('Pays a year (%)'), { target: { value: '' } });
    expect(planner.getByRole('alert').textContent).toMatch(/^Enter how much .+ pays a year/);
    fireEvent.change(first.getByLabelText('Pays a year (%)'), { target: { value: '7' } });
    // A payout can be a fixed amount instead, paid monthly, quarterly or yearly.
    fireEvent.click(first.getByRole('radio', { name: '₹ amount' }));
    expect(planner.getByRole('alert').textContent).toMatch(/pays each month, in rupees/);
    fireEvent.change(first.getByLabelText('Pays (₹)'), { target: { value: '25000' } });
    expect(planner.queryByRole('alert')).toBeNull();
    expect(first.getByText(/₹25,000 a month from when you retire/)).toBeDefined();
    fireEvent.click(first.getByRole('radio', { name: 'Quarterly' }));
    fireEvent.change(first.getByLabelText('Pays (₹)'), { target: { value: '75000' } });
    expect(
      first.getByText(/₹75,000 a quarter from when you retire, about ₹25,000 a month/),
    ).toBeDefined();
    fireEvent.click(first.getByRole('radio', { name: '% a year' }));
    fireEvent.click(planner.getByRole('button', { name: 'Save and close' }));
    await waitFor(() =>
      expect(saved().settings[0]?.retirement).toMatchObject({
        afterMode: 'each',
        after: expect.objectContaining({}),
      }),
    );
    const after = Object.values(saved().settings[0]?.retirement?.after ?? {});
    expect(after.some((row) => row.behaviour === 'income' && row.payout === 7)).toBe(true);
  });

  test('Save and close at the end of the assumptions saves them', async () => {
    show('/analytics/goals');
    const planner = within(await screen.findByRole('region', { name: 'Retirement planner' }));
    fireEvent.click(planner.getByText('Your assumptions'));
    // Nothing to save until the plan can be worked out.
    expect(
      (planner.getByRole('button', { name: 'Save and close' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(planner.getByLabelText(/^Date of birth/), {
      target: { value: addMonths(today, -480) },
    });
    fireEvent.change(planner.getByLabelText('Monthly spending today (₹)'), {
      target: { value: '50000' },
    });
    fireEvent.click(planner.getByRole('radio', { name: /Set each investment/ }));
    fireEvent.click(planner.getByRole('button', { name: 'Save and close' }));
    await waitFor(() =>
      expect(saved().settings[0]?.retirement).toMatchObject({
        afterMode: 'each',
        monthlyExpense: 50000,
      }),
    );
    // Once saved there's nothing left to save, so it only closes.
    expect(await planner.findByRole('button', { name: 'Close' })).toBeDefined();
  });

  test('the dashboard shows goals at a glance, or offers to set the first', async () => {
    show('/', [college]);
    const tile = within(await screen.findByRole('region', { name: 'Goals' }));
    expect(tile.getByText('Goals · 1')).toBeDefined();
    expect(tile.getByRole('link', { name: /College, \d+% saved, Behind/ })).toBeDefined();
    cleanup();
    show('/');
    const offer = await screen.findByRole('region', { name: 'Set a goal' });
    fireEvent.click(within(offer).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Set a goal' })).toBeNull());
  });
});
