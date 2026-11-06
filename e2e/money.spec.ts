import { expect, test, type Page } from '@playwright/test';

/**
 * The money rules end to end on the sample family: a closed month's unrecorded house expense
 * is counted once, before and after the month is reviewed, and a forgotten expense added
 * afterwards takes it down rather than adding to it.
 */

test.beforeEach(async ({ page }) => {
  const request = page.getByRole('dialog', { name: 'Family access request' });
  await page.addLocatorHandler(request, async () => {
    await request.getByRole('button', { name: 'Later' }).click();
  });
});

/** Last month, which the sample family has closed with both bank balances. */
function lastMonth() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const rupees = (text: string) => Number(text.replace(/[₹,]/g, ''));

async function pickMonth(page: Page, isMobile: boolean, month: string) {
  const picker = page.getByLabel('Month', { exact: true });
  if (isMobile) await picker.fill(month);
  else await picker.selectOption(month);
}

/** Recorded spending, unrecorded spending and the balance from the month's summary. */
async function figures(page: Page) {
  const text = await page.getByRole('region', { name: 'Selected month' }).innerText();
  const after = (label: RegExp) => rupees(text.match(label)?.[1] ?? 'NaN');
  return {
    recorded: after(/(?:Expenses recorded|Spent)[^₹]*(₹[\d,]+)/),
    unrecorded: after(/Unrecorded spending[^₹]*(₹[\d,]+)/),
    balance: after(/Balance[^₹]*(₹-?[\d,]+)/),
  };
}

test('unrecorded spending is counted once, through review and a forgotten expense', async ({
  page,
  isMobile,
}) => {
  const month = lastMonth();
  await page.goto('/cash-flow');
  await pickMonth(page, isMobile, month);
  const before = await figures(page);
  expect(before.unrecorded).toBeGreaterThan(5_000);

  // Reviewing saves the unrecorded spending as an entry, and changes none of the figures.
  const review = page.locator('#month-review');
  if (!(await review.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await review.locator('summary').click();
  }
  await review.getByRole('button', { name: 'Mark month reviewed' }).click();
  await pickMonth(page, isMobile, month);
  expect(await figures(page)).toEqual(before);

  // A ₹5,000 bill turns up for that month: recorded goes up, unrecorded comes down by as much.
  if (isMobile) {
    await page
      .getByRole('group', { name: 'History' })
      .getByRole('button', { name: 'Expenses' })
      .click();
    await page.getByRole('button', { name: 'Add expense' }).click();
  }
  const form = isMobile
    ? page.getByRole('dialog', { name: 'Add Expense' })
    : page.locator('form').filter({ has: page.getByRole('button', { name: 'Add expense' }) });
  await form.getByLabel('Category').selectOption({ index: 1 });
  await form.getByLabel('Amount (₹)').fill('5000');
  await form.getByLabel('Date').fill(`${month}-15`);
  await form.getByRole('button', { name: 'Add expense' }).click();
  await pickMonth(page, isMobile, month);
  const later = await figures(page);
  expect(later.recorded).toBe(before.recorded + 5_000);
  expect(later.unrecorded).toBe(before.unrecorded - 5_000);
  expect(later.balance).toBe(before.balance);
});
