# Verification record — 17 November 2026

This record covers the implemented product in the available local environment. It does not assert a live deployment, an actual Stripe sandbox transaction, real customer AWS access, approved legal documents or an independently certified security assessment.

## Measured acceptance

| Check                                                              | Result                                                                                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                | Passed with generated Next.js route types.                                                                                                                                |
| `npm run lint`                                                     | Passed.                                                                                                                                                                   |
| `RUN_INTEGRATION_TESTS=true npm test`                              | **61 tests passed across 13 files**, no skipped tests in the complete run.                                                                                                |
| `npx playwright test --output=work/final-complete-browser-results` | **9 browser tests passed** in 2.7 minutes.                                                                                                                                |
| `npm run format:check`                                             | Passed; generated Next.js type declarations are excluded from formatting.                                                                                                 |
| `npm run check:scanner`                                            | Actual ClamAV accepted a clean file and rejected the standard EICAR antivirus test.                                                                                       |
| `node scripts/check-restore.mjs`                                   | A consistent PostgreSQL custom-format dump restored into a separate local database; **all 39 table row counts matched** the exported snapshot. Source database unchanged. |
| Production build                                                   | Passed using Next.js standalone output, including TypeScript and static/dynamic route generation. Legal document pages read deployment configuration at request time.     |
| Docker web/worker                                                  | Both targets built; non-root web health and worker startup/migration checks passed. Web package inspection found **zero copied environment files**.                       |
| `npm audit --audit-level=moderate`                                 | **0 reported vulnerabilities** in the installed dependency tree.                                                                                                          |
| Terraform                                                          | Format, initialisation and validation passed for the AWS reference. No infrastructure apply or DNS change performed.                                                      |

## What the browser and service checks prove

- Every required public route renders, including checkout policies. Responsive bounds and navigation are tested at 375, 768 and 1440 pixels. Manual browser review also covered the desktop homepage, mobile homepage and tablet ledger. Screenshots use public or explicitly labelled illustrative data.
- Axe checks found no critical or serious WCAG A/AA violations on the tested public and portal screens. This is automated coverage, not a claim that every possible interaction or assistive technology has been independently audited.
- The local purchase flow creates a persisted £5,000 order and a verified confirmation. Failed payments never activate an engagement. HTTP checks exercise idempotency, account verification, safe claiming, tenant isolation, MFA/recovery challenges, password recovery, session revocation, reconciliation and persisted refund/dispute states. SMTP messages are delivered to Mailpit.
- Customer onboarding and support save through the actual UI/API/database. Admin findings lead to customer exact-revision approval and customer deployment evidence. Reviewed financial verification is published from documented inputs; source changes invalidate signoff.
- The outcome journey accepts a contractual fee basis, rejects payment on the original agreement, prepares a separately approved fee against published GBP evidence, and completes a local **£5,475** test payment from a **£21,900** agreed verified fee base. The order preserves the agreement/evidence snapshot and creates no duplicate engagement. Negative/currency/revision mismatches and duplicate payable requests are rejected. A second database guard preserves uniqueness in immutable order history after proposal archival or refunds. Concurrent provider reads are serialized under the order lock, with deterministic PostgreSQL regression tests.
- Direct service tests cover role boundaries, single-use recipient-bound invitations, last-owner retention, document quarantine and tenant isolation, private publication, durable jobs/dead letters/retry, public enquiries/admin replies, financial overlaps/currencies and credential-containing upload rejection.
- AWS tests use explicit offline SDK fixtures for STS identity, missing/wrong external-ID denial, billing access, pagination and failure behavior. Only an explicit provider access denial proves negative permission checks; network errors do not. The deployed adapter uses the official SDK and no infrastructure mutation calls.

## Integration boundaries still requiring activation

1. Actual Stripe sandbox acceptance requires a sandbox account/key/webhook configuration. The official SDK raw-signature verifier and provider-state interfaces have been tested offline; the local test adapter is **not** evidence of a Stripe-hosted transaction. It is explicitly enabled only for development and prohibited in production.
2. Authorised AWS and private S3 acceptance require the owner workload identity, scoped customer test role and storage account. Local private-file behavior and the real malware scanner are verified. No real customer billing evidence has been collected.
3. Mailpit proves SMTP delivery inside the development environment. A verified sender, authenticated TLS SMTP, DNS records and delivery/bounce checks remain required for internet email.
4. Seller/legal/privacy/tax approvals and exact contractual conditions remain owner inputs. Runtime activation gates refuse incomplete commercial configuration. No bundled fixture terms are represented as approved binding contracts.
5. Hosting must have private PostgreSQL, persistent/shared storage, worker/scanner services, TLS, secrets, monitoring and tested provider configuration. The available Vercel connection returned a team-scope authorisation error; it did not supply a usable deployment target. The container/AWS deployment reference is provided and no production environment has been changed.

See ACTIVATION.md for the complete secure activation and release procedure. Test traces, local database dumps, fixture secrets and private files remain ignored and are excluded from source delivery. Tests create synthetic fixtures and must never run against a production database.

## Production performance audit

The production homepage scored **100 accessibility, 100 best practices and 100 SEO** in the local Lighthouse audit after contrast and heading corrections. Its default mobile performance scores were 59 and 69 in repeated Windows runs, with limited available memory and large unattributed renderer tasks. The isolated mobile run measured 0.8 s LCP and zero material layout shift, but blocking time remained above target locally. These timings are lab measurements, not production field data.

CI repeats the production audit on a separate Linux runner and retains its JSON artifact. It requires performance >=90 and accessibility >=95. The actual runner result is visible in the pull request checks and retained `production-performance-audit` artifact; it must pass before release. This comparison is needed to distinguish implementation cost from the constrained local timing environment.
