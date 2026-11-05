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

const show = (path: string, goals: Goal[] = []) => {
  const repository = createMemoryRepository({
    holdings: [fund],
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
    expect(card.textContent).toContain('₹1,00,000 of');
  });

  test('the detail says what to do, and what-if changes nothing saved', async () => {
    show('/analytics/goals', [college]);
    fireEvent.click(await screen.findByRole('button', { name: /^College:/ }));
    const detail = within(await screen.findByRole('dialog', { name: 'College', hidden: true }));
    expect(detail.getByText(/Add ₹[\d,]+ more a month to reach it on time/)).toBeDefined();
    expect(detail.getByText('Behind')).toBeDefined();
    const monthly = detail.getByRole('slider', { name: /Each month/, hidden: true });
    fireEvent.change(monthly, { target: { value: '50000' } });
    expect(detail.getByText(/Heading for ₹[\d,]+ of ₹[\d,]+\./)).toBeDefined();
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
