# HKGpipi — AWS cloud margin recovery

A complete commercial website and engagement operating application: public pages, ordering, Stripe Checkout, verified customer accounts, secure AWS onboarding, savings ledger, engineering approvals, customer-controlled deployment records, financial verification, customer/admin workspaces, support and operational recovery.

The repository implements a human-operated engineering service. Discovery permissions never deploy customer infrastructure. Estimates, observed normalised savings and verified annualised results remain distinct.

## Run locally without production credentials

Requirements: Node.js 24+, npm and Docker Desktop with the Linux engine running. Ports: application **3001**, PostgreSQL **55432**, Mailpit SMTP **1025** and inbox **8025**, scanner **3310**.

```sh
npm ci
npm run setup:local
npm run dev:services
npm run db:migrate
npm run db:seed
npm run dev
```

In another terminal:

```sh
npm run worker
```

Open [the application](http://127.0.0.1:3001) and [the local email inbox](http://127.0.0.1:8025). The scanner may need time to load current definitions; uploads remain quarantined until it is ready.

`setup:local` preserves any existing `.env`. When none exists, it generates a random local authentication secret and **explicitly labelled test-only** commercial fixtures. Local checkout contacts no payment provider and charges no money. It is prohibited in production. Local fixtures never represent approved service terms or real customer outcomes.

The example configuration defaults to the real Stripe adapter with checkout disabled until configured. See [.env.example](.env.example) for every integration variable. Never deploy the development `.env`.

## Use the complete journey

1. Open `/start`, place a local test order and choose a success or failure outcome.
2. Use the ordering email to create an account, retrieve its verification message in Mailpit, sign in, and activate the engagement at `/activate`.
3. Complete and submit onboarding. The portal persists drafts, submitted information and review states separately from actual AWS connectivity.
4. Use an administrator account to review onboarding, create findings and remediation, publish deliverables and prepare implementation proposals.
5. A customer owner/approver approves the exact remediation revision and records its authorised deployment evidence.
6. An administrator prepares the billing baseline, observation period, normalisation adjustments and agreed measurement evidence, then reviews and publishes verification.
7. For outcome implementation, the owner first accepts the measurement/fee agreement. After verification, an administrator prepares a separate evidence-linked payment request. The owner approves its exact verified fee before opening checkout. The original agreement is never automatically charged, and duplicate requests against the same evidence are prevented.

Illustrative interfaces are available at `/portal?demo=1` and `/admin?demo=1`. They are clearly labelled, read-only, isolated fixture data; they never seed real organisations.

### Administrator access

There is no default administrator or password. Set `ADMIN_BOOTSTRAP_PASSWORD` securely in the process environment, then run:

```sh
npm run admin:create -- owner@example.com "Owner name"
```

The CLI refuses to promote an existing account. Verify the administrator email, sign in and enroll an authenticator at `/account-security`. Access requires a session with a recorded successful TOTP or recovery-code challenge. Password-only and stale pre-enrollment sessions cannot access administration. Remove the bootstrap password from the environment afterwards.

### Organisation permissions

- **Owner:** company/team settings, onboarding, commercial proposal acceptance, engineering approval and billing.
- **Approver:** onboarding and exact-revision engineering approval/deployment; no billing access.
- **Member:** onboarding and engagement participation; no commercial or engineering approval.
- **Billing:** commercial records and engagement visibility; no engineering changes or approvals.
- **Viewer:** engagement visibility and support; no onboarding edits, approval or billing.
- **Administrator:** HKGpipi fulfilment and operations, protected by mandatory MFA. Customer approval/deployment confirmation remains customer-only.

## Architecture and persistence

- Next.js App Router, React and TypeScript; locally hosted fonts and a shared responsive design system.
- PostgreSQL with bound `pg` queries, explicit transactions and versioned SQL migrations. SQL-first migrations are the schema source of truth; no ORM/code-generation step is required.
- Better Auth email verification, recovery, secure sessions, TOTP and recovery codes. Tenant permissions are checked in every application service; composite keys prevent cross-organisation references.
- Orders, provider events and immutable commercial snapshots; atomic payment fulfilment and once-only account claiming.
- Versioned engagement records for onboarding, opportunities, remediation, approvals, deployments, deliverables, proposals, support and verification. Optimistic concurrency protects updates; source changes supersede verification signoff.
- `pg-boss` durable jobs for AWS collection, scanning and reconciliation, plus a transactional SMTP outbox with retries and dead-letter inspection.
- Official Stripe and AWS SDK adapters. Private local/S3 objects, file-content restrictions, checksum validation and fail-closed ClamAV scanning.

Public routes include `/`, `/method`, `/savings-sprint`, `/implementation`, `/verification`, `/security`, `/pricing`, `/contact`, `/faq`, `/privacy`, `/terms`, `/checkout-policies` and `/start`. Account/system pages, `/order/[id]`, the `/portal` workspace and `/admin` operations are integrated with the same application.

The API covers accounts, orders, payment events/reconciliation, activation, workspace mutations, AWS onboarding/evidence, protected documents, public enquiries and operational retries. Public contact is persisted and acknowledged; admin enquiries contain reply history and operational assignment. No client-side role or URL identifier grants access.

## Verification

Start the database and application before integration/browser tests. Use a dedicated local test database. These tests create synthetic fixture accounts and orders; they must not run against a production database.

```sh
npm run typecheck
npm run lint
npm test
npm run check:scanner
node scripts/check-restore.mjs
npx playwright install chromium
npm run test:e2e
npm run build
npm audit --audit-level=moderate
```

The HTTP authentication/payment test additionally requires `RUN_INTEGRATION_TESTS=true`, the application on `BETTER_AUTH_URL`, and Mailpit. Set the variable in your shell and run `npm test`; every test can then run without production credentials. Actual Stripe sandbox transactions and authorised AWS connectivity need the corresponding test account configuration and have separate activation checks.

The restore check is restricted to the local Docker development database. It exports a consistent snapshot, restores it into a new isolated database and compares every table's row count. It retains the ignored backup and isolated fixture database for inspection. Production backups require a separate, reviewed provider recovery procedure.

The build generates route types, verifies TypeScript and emits standalone Node output. A post-build check removes Next.js's copied environment files; inject runtime configuration externally. Container images use the same build. CI runs database tests, lint, type checks, build, audit and browser journeys.

## Deployment and operation

See [external activation](docs/ACTIVATION.md), [AWS deployment reference](infra/README.md), [the implementation checklist](docs/IMPLEMENTATION_CHECKLIST.md) and [verification evidence](docs/VERIFICATION.md).

Docker targets `web` and `worker` are supplied. Use a separate migration identity, private PostgreSQL, shared private S3 storage, a scanner, SMTP, TLS, persistent jobs and monitoring in production. `/api/health` checks database readiness. The admin operational queue view supports failed mail, scan and job inspection/retry; billing operations reconcile against current provider state.

For AWS ALB, set `TRUSTED_PROXY=alb` and ensure the web container is reachable only from the load balancer. The application uses the final appended source address, not client-supplied forwarding headers. Cloudflare mode requires ingress restricted to trusted Cloudflare traffic; direct deployments default to no trusted forwarding headers.

The Terraform reference provisions protected private data services, ECS web/worker/scanner tasks, HTTPS routing and logs using an existing network and supplied runtime secret ARN. It has not been applied. No production DNS or existing live website is replaced without explicit authorisation.

Live commercial activation requires approved seller/legal/tax details, configured provider accounts and provider-backed acceptance. Unapproved terms and missing credentials disable dependent actions. They never cause the application to simulate a live payment, connection or verified saving.
