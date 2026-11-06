import { expect, test, type Page } from '@playwright/test';

// The preview asks to approve a sample family member. It's set aside whenever it appears.
test.beforeEach(async ({ page }) => {
  const request = page.getByRole('dialog', { name: 'Family access request' });
  await page.addLocatorHandler(request, async () => {
    await request.getByRole('button', { name: 'Later' }).click();
  });
});

const open = (page: Page, path: string) => page.goto(path);

const fitsTheScreen = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('every page', () => {
  for (const path of [
    '/',
    '/cash-flow',
    '/investments',
    '/debts',
    '/analytics',
    '/analytics/income',
    '/analytics/goals',
    '/analytics/budget',
    '/analytics/budget-actual',
    '/settings',
  ]) {
    test(`${path} opens and fits the screen`, async ({ page }) => {
      await open(page, path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await fitsTheScreen(page)).toBe(true);
    });
  }

  for (const path of ['/features', '/privacy']) {
    test(`public ${path} opens and fits the screen`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await fitsTheScreen(page)).toBe(true);
    });
  }
});

test('an income is added and shows in the history', async ({ page, isMobile }) => {
  await open(page, '/cash-flow');
  const form = isMobile
    ? (await page.getByRole('button', { name: 'Add income' }).click(),
      page.getByRole('dialog', { name: 'Add Income' }))
    : page.locator('form').filter({ has: page.getByRole('button', { name: 'Add income' }) });
  await form.getByLabel('Amount (₹)').fill('4321');
  await form.getByRole('button', { name: 'Add income' }).click();
  await expect(page.getByText('₹4,321').first()).toBeVisible();
});

test('a retirement payout can be a fixed amount each quarter, and the settings stay open while typing', async ({
  page,
}) => {
  await open(page, '/analytics/goals');
  const planner = page.getByRole('region', { name: 'Retirement planner' });
  await planner.getByText('Your assumptions').click();
  await planner.getByRole('radio', { name: /Set each investment/ }).click();
  const list = planner.getByRole('list', { name: 'Each investment after retiring' });
  const first = list.getByRole('listitem').first();
  await first.getByRole('radio', { name: 'Income' }).click();
  await first.getByRole('radio', { name: '₹ amount' }).click();
  await first.getByRole('radio', { name: 'Quarterly' }).click();
  // A blank amount shows an error; typing one clears it without closing the settings.
  await first.getByLabel('Pays (₹)').fill('75000');
  await expect(list).toBeVisible();
  await expect(
    first.getByText(/₹75,000 a quarter from when you retire, about ₹25,000 a month/),
  ).toBeVisible();
  await expect(planner.getByText(/Payouts cover ₹/)).toBeVisible();
});

test('a withdrawal shows its working, then books the profit', async ({ page }) => {
  await open(page, '/investments');
  await page.getByRole('button', { name: /^Mutual Funds/ }).click();
  await page
    .getByRole('button', { name: /^Withdraw from/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: /^Withdraw from/ });
  await dialog.getByLabel('Amount withdrawn (₹)').fill('100000');
  await expect(dialog.getByText('Booked profit', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save withdrawal' }).click();
  await expect(page.getByText('Booked profit').first()).toBeVisible();
});

test('quick setup opens a form and moves on once it is saved', async ({ page }) => {
  await open(page, '/?setup');
  const setup = page.getByRole('region', { name: 'Set up your finances' });
  await expect(setup.getByText('Choose how it looks')).toBeVisible();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await setup.getByRole('button', { name: 'Set bank balance' }).click();
  // The sample data already has this month's balance, so the app asks before replacing it.
  page.once('dialog', (question) => void question.accept());
  await page
    .getByRole('dialog', { name: 'Set bank balance' })
    .getByRole('button', {
      name: /Save opening balance/,
    })
    .click();
  await expect(setup.getByText('Add your income')).toBeVisible();
});

test('the privacy animation plays through to the family step', async ({ page }) => {
  await page.goto('/privacy');
  const current = page.locator('[aria-current="step"] strong');
  await expect(current).toHaveText('You type it');
  await expect(current).toHaveText('Only family can open it', { timeout: 12_000 });
});

test('first login answers who can read the records, with real encryption', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: "We know what you're thinking." })).toBeVisible();
  const scrambled = page.getByText(/^Scrambled:/).locator('..');
  await page.getByLabel('Type something private').fill('Rent 18000');
  await expect(scrambled).not.toContainText('Rent');
  const before = await scrambled.textContent();
  await page.getByLabel('Type something private').fill('Rent 18001');
  await expect(scrambled).not.toHaveText(before ?? '');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Agree and continue' })).toBeVisible();
  expect(await fitsTheScreen(page)).toBe(true);
});

test('Settings shows how to install, and the guide plays', async ({ page }) => {
  await open(page, '/settings');
  await page.getByRole('button', { name: /App & updates/ }).click();
  await page.getByRole('button', { name: 'How to install' }).click();
  const guide = page.getByRole('dialog', { name: 'How to install' });
  const current = guide.locator('[aria-current="step"] strong');
  await expect(current).not.toHaveText(/^$/);
  const first = await current.textContent();
  await expect(current).not.toHaveText(first ?? '', { timeout: 5000 });
  expect(await fitsTheScreen(page)).toBe(true);
});
