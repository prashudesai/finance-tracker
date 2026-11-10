import { expect, test } from '@playwright/test';

// The preview asks to approve a sample family member. It's set aside whenever it appears.
test.beforeEach(async ({ page }) => {
  const request = page.getByRole('dialog', { name: 'Family access request' });
  await page.addLocatorHandler(request, async () => {
    await request.getByRole('button', { name: 'Later' }).click();
  });
});

test('a history row slides left to show Edit and Delete', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Phones list history as rows');
  await page.goto('/cash-flow');
  const history = page.locator('#history');
  const row = history.locator('li').first().getByRole('button').last();
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  if (!box) throw new Error('No row');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++)
    await page.mouse.move(box.x + box.width - 20 - step * 22, y);
  await page.mouse.up();
  const remove = history
    .locator('li')
    .first()
    .getByRole('button', { name: /^Delete / });
  await expect(remove).toBeVisible();
  const before = await history.locator('li').count();
  await remove.click();
  await expect(history.locator('li')).toHaveCount(before - 1);
});

test('Home can hide a section, and remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Debt summary' })).toBeVisible();
  await page.getByRole('button', { name: 'Arrange Home' }).click();
  const sheet = page.getByRole('dialog', { name: 'Arrange Home' });
  await sheet.getByRole('checkbox', { name: 'Debt summary' }).uncheck();
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Debt summary' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Investment portfolio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Debt summary' })).toHaveCount(0);
});

test('a phone sheet snaps to full height from its handle', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Sheets are a phone layout');
  await page.goto('/');
  await page.getByRole('button', { name: 'Arrange Home' }).click();
  const sheet = page.getByRole('dialog', { name: 'Arrange Home' });
  await sheet.getByRole('button', { name: 'Expand' }).click();
  await expect(sheet).toHaveAttribute('data-expanded', 'true');
  await sheet.getByRole('button', { name: 'Shrink' }).click();
  await expect(sheet).not.toHaveAttribute('data-expanded', 'true');
});

test('pointing along the net worth line reads that month', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Hovering is for a mouse');
  await page.goto('/');
  const chart = page.getByRole('link', { name: 'Open net worth history' });
  const box = await chart.boundingBox();
  if (!box) throw new Error('No chart');
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await expect(page.getByText(/^End of /)).toBeVisible();
});
