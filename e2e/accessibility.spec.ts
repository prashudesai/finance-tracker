import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Every page passes the WCAG 2.1 AA checks axe can make, with its folds open, in both themes. */

test.beforeEach(async ({ page }) => {
  const request = page.getByRole('dialog', { name: 'Family access request' });
  await page.addLocatorHandler(request, async () => {
    await request.getByRole('button', { name: 'Later' }).click();
  });
});

const ROUTES = [
  '/',
  '/cash-flow',
  '/investments',
  '/debts',
  '/analytics',
  '/analytics/income',
  '/analytics/projection',
  '/analytics/goals',
  '/analytics/budget',
  '/analytics/budget-actual',
  '/analytics/reports',
  '/settings',
  '/signin',
  '/features',
  '/privacy',
];

for (const scheme of ['dark', 'light'] as const) {
  test(`every page passes the accessibility checks, ${scheme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    const failures: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.evaluate(() =>
        document.querySelectorAll('details').forEach((fold) => fold.setAttribute('open', '')),
      );
      // Text isn't checked halfway through fading in.
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== 'running' ||
              animation.effect?.getTiming().iterations === Infinity,
          ),
      );
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      for (const issue of violations) {
        failures.push(`${route}: ${issue.id} (${issue.nodes.length}) ${issue.help}`);
      }
    }
    expect(failures).toEqual([]);
  });
}
