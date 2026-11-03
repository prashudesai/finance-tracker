import { isValidDate, toDayNumber } from './calendar';

export interface Cashflow {
  date: string;
  amount: number;
}

/** Annualised return of dated cash flows, by bisection. Null when no rate exists. */
export function calculateXirr(cashflows: Cashflow[]): number | null {
  const flows = cashflows.filter(
    (flow) => isValidDate(flow.date) && Number.isFinite(flow.amount) && flow.amount !== 0,
  );
  if (!flows.some((flow) => flow.amount < 0) || !flows.some((flow) => flow.amount > 0)) return null;
  const origin = Math.min(...flows.map((flow) => toDayNumber(flow.date)));
  const dated = flows.map((flow) => ({
    amount: flow.amount,
    years: (toDayNumber(flow.date) - origin) / 365,
  }));
  const npv = (rate: number) =>
    dated.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, flow.years), 0);

  let low = -0.9999;
  let high = 0.1;
  let lowValue = npv(low);
  let highValue = npv(high);
  while (lowValue > 0 === highValue > 0 && high < 1_000_000) {
    high = high * 2 + 0.1;
    highValue = npv(high);
  }
  if (!Number.isFinite(lowValue) || Number.isNaN(highValue) || lowValue > 0 === highValue > 0) {
    return null;
  }
  for (let step = 0; step < 240; step++) {
    const middle = (low + high) / 2;
    const value = npv(middle);
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) < 0.000001) return middle;
    if (value > 0 === lowValue > 0) {
      low = middle;
      lowValue = value;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

export function absoluteReturn(invested: number, current: number) {
  if (!Number.isFinite(invested) || invested <= 0 || !Number.isFinite(current)) return null;
  return (current - invested) / invested;
}

export function cagr(invested: number, current: number, startDate: string, asOf: string) {
  if (!isValidDate(startDate) || !isValidDate(asOf) || startDate >= asOf) return null;
  if (!Number.isFinite(invested) || invested <= 0 || !Number.isFinite(current) || current < 0) {
    return null;
  }
  if (current === 0) return -1;
  return Math.pow(current / invested, 365 / (toDayNumber(asOf) - toDayNumber(startDate))) - 1;
}
