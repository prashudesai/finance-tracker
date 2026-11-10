import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

// The preview asks to approve a sample family member. It's set aside whenever it appears.
test.beforeEach(async ({ page }) => {
  const request = page.getByRole('dialog', { name: 'Family access request' });
  await page.addLocatorHandler(request, async () => {
    await request.getByRole('button', { name: 'Later' }).click();
  });
});

const fixture = (name: string) => path.join(import.meta.dirname, 'fixtures', name);

async function choose(page: Page, file: string) {
  await page.goto('/cash-flow');
  await page.getByRole('button', { name: /Import a bank statement/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Import bank statement' });
  await dialog.locator('input[type=file]').setInputFiles(fixture(file));
  return dialog;
}

test('a CSV statement is checked, sorted and added', async ({ page }) => {
  const dialog = await choose(page, 'statement.csv');
  await expect(dialog.getByText('statement.csv')).toBeVisible();
  await expect(dialog.getByText('1 row couldn’t be read')).toBeVisible();
  await expect(
    dialog.getByText(/Every amount agrees with the statement’s running balance/),
  ).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'To add · 5' })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Left out · 5' })).toBeVisible();

  // Choosing a category for one Swiggy order sets the other.
  const categories = dialog.getByRole('combobox', { name: 'Expense category' });
  await categories.nth(0).selectOption('Entertainment');
  await expect(dialog.getByText('Entertainment set for 1 more from SWIGGY.')).toBeVisible();
  await expect(categories.nth(1)).toHaveValue('Entertainment');

  await dialog.getByRole('tab', { name: /Left out/ }).click();
  await expect(dialog.getByText(/Credit card bill: record the purchases instead/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Add 5' }).click();
  await expect(dialog.getByText('Added 5 entries')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Importing the same file again finds them all recorded.
  await page.getByRole('button', { name: /Import a bank statement/ }).click();
  await page
    .getByRole('dialog', { name: 'Import bank statement' })
    .locator('input[type=file]')
    .setInputFiles(fixture('statement.csv'));
  await expect(page.getByRole('tab', { name: 'To add · 0' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Recorded · 5' })).toBeVisible();
});

test('a PDF statement is read into the same columns', async ({ page }) => {
  const dialog = await choose(page, 'statement.pdf');
  await expect(dialog.getByText(/5 transactions/)).toBeVisible();
  await expect(
    dialog.getByText(/Every amount agrees with the statement’s running balance/),
  ).toBeVisible();
  await expect(dialog.getByText('APOLLO PHARMACY KORAMANGALA in Koramangala branch')).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'To add · 4' })).toBeVisible();
});

test('a locked PDF asks for its password', async ({ page }) => {
  const dialog = await choose(page, 'statement-locked.pdf');
  const field = dialog.getByLabel('Statement password');
  await field.fill('wrong');
  await dialog.getByRole('button', { name: 'Open' }).click();
  await expect(dialog.getByText(/That password didn’t open it/)).toBeVisible();
  await field.fill('ABCD1234');
  await dialog.getByRole('button', { name: 'Open' }).click();
  await expect(dialog.getByText(/5 transactions/)).toBeVisible();
});

test('a file that isn’t a statement says so', async ({ page }) => {
  const dialog = await choose(page, '../app.spec.ts');
  await expect(dialog.getByRole('alert')).toBeVisible();
});
