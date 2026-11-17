import 'dotenv/config';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { createVerifiedFixtureSession } from '../tests/support/auth-fixture';
import { sql } from '../src/lib/db';

test.use({ actionTimeout: 15000 });
const screens = [
  '',
  'engagements',
  'onboarding',
  'ledger',
  'implementation',
  'deliverables',
  'verification',
  'proposals',
  'billing',
  'members',
  'support',
  'settings',
];
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function confirm(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('complete illustrative portals remain read-only, responsive and accessible', async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const route of screens) {
    await page.goto(`/portal/${route}?demo=1`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByText('Illustrative workspace', { exact: true })).toBeVisible();
  }
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/portal?demo=1',
      '/portal/ledger?demo=1',
      '/portal/onboarding?demo=1',
      '/admin?demo=1',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), {
          message: `${width}px ${route} document overflow`,
          timeout: 3000,
        })
        .toBe(true);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        audit.violations
          .filter((v) => ['serious', 'critical'].includes(v.impact || ''))
          .map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
          })),
        `${width}px ${route}`,
      ).toEqual([]);
    }
  }
  await page.goto('/portal/onboarding?demo=1');
  await expect(page.getByRole('button', { name: 'New onboarding submission' })).toBeDisabled();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Workspace navigation' })
    .getByRole('link', { name: 'Savings ledger', exact: true })
    .click();
  await expect(page).toHaveURL(/ledger\?demo=1/);
});

test('customer onboarding and support forms persist through authenticated UI', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const fixture = await createVerifiedFixtureSession();
  await context.addCookies(fixture.browser.playwrightCookies());
  await page.goto('/portal/onboarding');
  await page.getByRole('button', { name: 'Complete onboarding', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI acceptance onboarding');
  await dialog
    .getByLabel(/^Engagement contacts/)
    .fill('Alex, engineering lead; finance@example.test');
  await dialog.getByLabel(/^AWS account IDs/).fill('123456789012');
  await dialog
    .getByLabel('Estate and engagement scope')
    .fill('Approved development account discovery. No infrastructure changes authorised.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: /UI acceptance onboarding/ }).click();
  await confirm(page, 'Submit for review');
  await expect(page.locator('.ws-detail-heading .ws-status')).toHaveText('submitted');
  const [onboarding] = await sql<{ status: string; data: Record<string, unknown> }>(
    "SELECT status,data FROM records WHERE organisation_id=$1 AND kind='onboarding'",
    [fixture.organisationId],
  );
  expect(onboarding.status).toBe('submitted');
  expect(onboarding.data.awsAccounts).toBe('123456789012');
  await page.goto('/portal/support');
  await page.getByRole('button', { name: 'Ask a question' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('Confirm our billing scope');
  await dialog
    .getByLabel(/^How can we help/)
    .fill('Please confirm the payer account is within the agreed discovery scope.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm our billing scope', exact: true }).click();
  await page
    .getByLabel('Reply', { exact: true })
    .fill('The engineering contact is now available for review.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(
    page
      .locator('.ws-conversation article')
      .getByText('The engineering contact is now available for review.', { exact: true }),
  ).toBeVisible();
  const [support] = await sql<{ data: { replies: unknown[] } }>(
    "SELECT data FROM records WHERE organisation_id=$1 AND kind='support'",
    [fixture.organisationId],
  );
  expect(support.data.replies).toHaveLength(1);
  const denied = await fixture.browser.call(`/api/v1/workspace?organisationId=${randomUUID()}`);
  expect(denied.status).toBe(404);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/portal$/);
});

test('administrator and customer fulfil a persistent evidence-backed engineering workflow', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const staff = await createVerifiedFixtureSession({ staff: true });
  const customer = await createVerifiedFixtureSession({ engagement: false });
  await sql('INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,\'owner\')', [
    randomUUID(),
    staff.organisationId,
    customer.userId,
  ]);
  const adminContext = await browser.newContext();
  await adminContext.addCookies(staff.browser.playwrightCookies());
  const admin = await adminContext.newPage();
  await admin.goto('/admin/ledger');
  await admin.getByRole('button', { name: 'New savings opportunity' }).click();
  let dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI acceptance RDS sizing');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('validated');
  await dialog.getByLabel('AWS service', { exact: true }).fill('Amazon RDS');
  await dialog.getByLabel('Expected monthly saving').fill('1800');
  await dialog
    .getByLabel('Supporting evidence')
    .fill('Thirty-day approved utilisation and cost evidence.');
  await dialog
    .getByLabel('Recommended action')
    .fill('Review a smaller instance class after load testing.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await admin.getByRole('button', { name: 'UI acceptance RDS sizing', exact: true }).click();
  await admin.getByRole('button', { name: 'Create engineering change' }).click();
  dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI acceptance reviewed RDS change');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('in_review');
  await dialog
    .getByLabel('Engineering change and validation plan')
    .fill(
      'Change the approved IaC instance class. Follow customer review, tests and rollback controls.',
    );
  await dialog
    .getByLabel('Testing and implementation evidence')
    .fill('Load-test report and reviewed infrastructure plan.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  const records = await sql<{ id: string; kind: string }>(
    'SELECT id,kind FROM records WHERE organisation_id=$1',
    [staff.organisationId],
  );
  const opportunity = records.find((r) => r.kind === 'opportunity')!;
  const remediation = records.find((r) => r.kind === 'remediation')!;
  await admin.goto(`/admin/implementation/${remediation.id}`);
  await expect(admin.getByRole('button', { name: 'Approve this revision' })).toHaveCount(0);
  const customerContext = await browser.newContext();
  await customerContext.addCookies(customer.browser.playwrightCookies());
  const portal = await customerContext.newPage();
  await portal.goto(`/portal/implementation/${remediation.id}`);
  await portal.getByRole('button', { name: 'Approve this revision' }).click();
  dialog = portal.getByRole('dialog');
  await dialog.getByLabel('Approval note').fill('Reviewed and approved by customer engineering.');
  await dialog.getByRole('button', { name: 'Approve this revision' }).click();
  await expect(dialog).toHaveCount(0);
  await portal.getByRole('button', { name: 'Record deployment' }).click();
  dialog = portal.getByRole('dialog');
  await dialog.getByLabel('Deployment date').fill(day(-65));
  await dialog
    .getByLabel('Deployment evidence and reference')
    .fill('Customer pipeline run 42, reviewed production change.');
  await dialog.getByRole('button', { name: 'Record deployment' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(portal.locator('.ws-detail-heading .ws-status')).toHaveText('deployed');
  await admin.goto('/admin/verification');
  await admin.getByRole('button', { name: 'New verification record' }).click();
  dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI acceptance verified billing');
  await dialog
    .getByRole('combobox', { name: 'Opportunity ID', exact: true })
    .selectOption(opportunity.id);
  const [deployment] = await sql<{ id: string }>(
    "SELECT id FROM records WHERE organisation_id=$1 AND kind='deployment'",
    [staff.organisationId],
  );
  await dialog
    .getByRole('combobox', { name: 'Deployment record ID', exact: true })
    .selectOption(deployment.id);
  await dialog.getByLabel('Baseline start', { exact: true }).fill(day(-100));
  await dialog.getByLabel('Baseline end', { exact: true }).fill(day(-70));
  await dialog.getByLabel('Observation start', { exact: true }).fill(day(-60));
  await dialog.getByLabel('Observation end', { exact: true }).fill(day(-30));
  await dialog.getByLabel('Baseline cost', { exact: true }).fill('6000');
  await dialog.getByLabel('Observed cost', { exact: true }).fill('4200');
  await dialog
    .getByLabel('Agreed measurement and normalisation basis')
    .fill('Agreed daily-normalised billing comparison, annualised over 365 days.');
  await dialog
    .getByLabel(/^Customer agreement evidence/)
    .fill('Customer accepted engagement scope, measurement schedule v1.');
  await dialog
    .getByLabel('Billing and deployment evidence')
    .fill('AWS payer billing exports and customer pipeline run 42.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await admin.getByRole('button', { name: 'UI acceptance verified billing', exact: true }).click();
  await confirm(admin, 'Review verification');
  await confirm(admin, 'Publish to customer');
  await expect(admin.locator('.ws-detail-heading .ws-status')).toHaveText('published');
  await portal.goto('/portal/verification');
  await portal.getByRole('button', { name: 'UI acceptance verified billing', exact: true }).click();
  await expect(portal.locator('.ws-detail-heading .ws-status')).toHaveText('published');
  await expect(portal.getByText('£21,900', { exact: true })).toBeVisible();
  const [verified] = await sql<{ status: string; data: Record<string, unknown> }>(
    "SELECT status,data FROM records WHERE organisation_id=$1 AND kind='verification'",
    [staff.organisationId],
  );
  expect(verified.status).toBe('published');
  expect(verified.data.normalisedSaving).toBe(1800);
  expect(verified.data.annualisedSaving).toBe(21900);
  // Complete the separately approved outcome agreement and final verified fee.
  await admin.goto('/admin/proposals');
  await admin.getByRole('button', { name: 'New implementation proposal' }).click();
  dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI accepted outcome agreement');
  await dialog
    .getByRole('combobox', { name: 'Commercial option', exact: true })
    .selectOption('outcome');
  await dialog
    .getByRole('combobox', { name: 'Agreed outcome fee base', exact: true })
    .selectOption('annualisedSaving');
  await dialog
    .getByLabel('Agreed scope of engineering work')
    .fill('Approved customer-controlled RDS remediation under the outcome model.');
  await dialog.getByLabel('Approved terms version').fill(process.env.LEGAL_TERMS_VERSION!);
  await dialog
    .getByLabel('Outcome measurement and contractual basis')
    .fill('25% of reviewed annualised GBP savings under the accepted verification schedule.');
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await admin.getByRole('button', { name: 'UI accepted outcome agreement', exact: true }).click();
  await confirm(admin, 'Send proposal');
  await portal.goto('/portal/proposals');
  await portal.getByRole('button', { name: 'UI accepted outcome agreement', exact: true }).click();
  await confirm(portal, 'Accept proposal');
  const [agreement] = await sql<{ id: string }>(
    'SELECT id FROM records WHERE organisation_id=$1 AND title=$2',
    [staff.organisationId, 'UI accepted outcome agreement'],
  );
  const unpayable = await customer.browser.call('/api/v1/orders/config?proposalId=' + agreement.id);
  expect(unpayable.status).toBe(409);
  await admin.goto('/admin/proposals/' + agreement.id);
  await admin.getByRole('button', { name: 'Prepare outcome payment request' }).click();
  dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('UI approved verified outcome payment');
  const [verifiedRecord] = await sql<{ id: string }>(
    "SELECT id FROM records WHERE organisation_id=$1 AND kind='verification'",
    [staff.organisationId],
  );
  await dialog
    .getByRole('combobox', { name: 'Published verification record ID', exact: true })
    .selectOption(verifiedRecord.id);
  await dialog
    .getByLabel('Outcome invoicing agreement evidence')
    .fill(
      'Customer-accepted verification schedule: 25% of annualised verified GBP saving, separately approved payment.',
    );
  await dialog.getByRole('button', { name: 'Save record' }).click();
  await expect(dialog).toHaveCount(0);
  await admin.goto('/admin/proposals');
  await admin
    .getByRole('button', { name: 'UI approved verified outcome payment', exact: true })
    .click();
  await confirm(admin, 'Send proposal');
  await portal.goto('/portal/proposals');
  await portal
    .getByRole('button', { name: 'UI approved verified outcome payment', exact: true })
    .click();
  await confirm(portal, 'Approve outcome payment');
  await portal.getByRole('link', { name: 'Review order & pay' }).click();
  await expect(portal.locator('.checkout-form h2')).toContainText('£5,475');
  await portal.getByLabel('Full name', { exact: true }).fill('Fixture Customer');
  await portal.getByLabel('Work email', { exact: false }).fill(customer.email);
  await portal.getByLabel('Company name').fill('UI outcome fixture');
  await portal.getByLabel('Billing address', { exact: true }).fill('1 Test Street');
  await portal.getByLabel('Town or city').fill('London');
  await portal.getByLabel('Postcode').fill('SE1 1AA');
  await portal.getByRole('checkbox').check();
  await portal.getByRole('button', { name: 'Continue to local test checkout' }).click();
  await portal.getByRole('button', { name: 'Simulate confirmed test payment' }).click();
  await expect(
    portal.getByRole('heading', { name: 'Your outcome payment is confirmed.' }),
  ).toBeVisible();
  const [outcomeOrder] = await sql<{
    amount: string;
    status: string;
    legal_snapshot: Record<string, unknown>;
  }>(
    "SELECT amount,status,legal_snapshot FROM orders WHERE organisation_id=$1 AND offer='outcome'",
    [staff.organisationId],
  );
  expect(Number(outcomeOrder.amount)).toBe(547500);
  expect(outcomeOrder.status).toBe('paid');
  expect(outcomeOrder.legal_snapshot.proposalSnapshot).toBeTruthy();
  const [engagementCount] = await sql<{ count: string }>(
    'SELECT count(*) FROM engagements WHERE organisation_id=$1',
    [staff.organisationId],
  );
  expect(engagementCount.count).toBe('1');
  await adminContext.close();
  await customerContext.close();
});
