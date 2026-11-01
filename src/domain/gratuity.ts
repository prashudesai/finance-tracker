import type { GratuityAccount } from '../schema/records';
import { addMonths, isValidDate } from './calendar';

const GRATUITY_CAP = 2_000_000;
const ELIGIBLE_AFTER_YEARS = 5;

export function gratuityService(account: GratuityAccount, asOf: string) {
  if (!isValidDate(account.date) || !isValidDate(asOf) || account.date > asOf) {
    return { completedYears: 0, countedYears: 0, eligible: false };
  }
  let completedYears = Number(asOf.slice(0, 4)) - Number(account.date.slice(0, 4));
  if (addMonths(account.date, completedYears * 12) > asOf) completedYears--;
  completedYears = Math.max(0, completedYears);
  // Six months or more of a partly served year counts as a full year.
  const sixMonthMark = addMonths(account.date, completedYears * 12 + 6);
  const countedYears = completedYears + (asOf > sixMonthMark ? 1 : 0);
  return { completedYears, countedYears, eligible: completedYears >= ELIGIBLE_AFTER_YEARS };
}

export function estimateGratuity(account: GratuityAccount, asOf: string) {
  const service = gratuityService(account, asOf);
  const amount = service.eligible
    ? Math.min(GRATUITY_CAP, ((account.basicSalary * 15) / 26) * service.countedYears)
    : 0;
  return { ...service, amount };
}

export const totalGratuity = (accounts: GratuityAccount[], asOf: string) =>
  accounts.reduce((sum, account) => sum + estimateGratuity(account, asOf).amount, 0);
