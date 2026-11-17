import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const routes = [
  '/',
  '/method',
  '/savings-sprint',
  '/implementation',
  '/verification',
  '/security',
  '/pricing',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/checkout-policies',
  '/start',
];
test('all required public pages render and navigation is complete', async ({ page }) => {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('h1'), route).toHaveCount(1);
    await expect(page.locator('main'), route).toBeVisible();
  }
  await page.goto('/faq');
  await page.getByText('What does the £5,000 Savings Sprint include?', { exact: true }).click();
  await expect(page.getByText('You receive a savings ledger,', { exact: false })).toBeVisible();
});
test('public pages meet critical and serious accessibility checks', async ({ page }) => {
  for (const route of ['/', '/pricing', '/security', '/start', '/contact']) {
    await page.goto(route);
    await page.locator('h1').waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      result.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      route,
    ).toEqual([]);
  }
});
test('responsive layouts and mobile navigation', async ({ page }) => {
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/pricing', '/security', '/start']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${width} ${route} overflow`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Security', exact: true })
    .click();
  await expect(page).toHaveURL(/\/security$/);
});
test('contact form persists a real enquiry and acknowledgement', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Your name').fill('Browser acceptance');
  await page.getByLabel('Work email').fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel('Company', { exact: true }).fill('Browser fixture company');
  await page
    .getByLabel('What would you like to discuss?')
    .fill('Local acceptance: discuss a read-only discovery engagement.');
  await page.getByRole('button', { name: 'Send your enquiry' }).click();
  await expect(
    page.getByRole('heading', { name: 'Thank you. We have your enquiry.' }),
  ).toBeVisible();
});
test('test checkout reaches verified order confirmation through the browser', async ({ page }) => {
  await page.goto('/start');
  await expect(page.locator('.order-review .status')).toBeVisible();
  await page.getByLabel('Full name', { exact: true }).fill('Browser purchaser');
  await page.getByLabel('Work email', { exact: false }).fill(`buyer-${Date.now()}@example.test`);
  await page.getByLabel('Company name').fill('Browser purchase fixture');
  await page.getByLabel('Billing address', { exact: true }).fill('1 Test Street');
  await page.getByLabel('Town or city').fill('London');
  await page.getByLabel('Postcode').fill('SE1 1AA');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to local test checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Test the payment journey.' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulate confirmed test payment' }).click();
  await expect(page.getByRole('heading', { name: 'Your engagement is confirmed.' })).toBeVisible();
  await expect(page.getByText('TEST ORDER', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activate your engagement' })).toBeVisible();
});
test('test checkout failure never activates an engagement', async ({ page }) => {
  await page.goto('/start');
  await page.getByLabel('Full name', { exact: true }).fill('Failure purchaser');
  await page.getByLabel('Work email', { exact: false }).fill(`failure-${Date.now()}@example.test`);
  await page.getByLabel('Company name').fill('Failure fixture');
  await page.getByLabel('Billing address', { exact: true }).fill('1 Test Street');
  await page.getByLabel('Town or city').fill('London');
  await page.getByLabel('Postcode').fill('SE1 1AA');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to local test checkout' }).click();
  await page.getByRole('button', { name: 'Simulate payment failure' }).click();
  await expect(page.getByRole('heading', { name: 'Payment was not completed.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Activate your engagement' })).toHaveCount(0);
});
