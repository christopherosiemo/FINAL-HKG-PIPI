# Required final product checklist

Every row is part of the same final deliverable. A milestone is build order, not a scope reduction. Provider/live verification remains separately recorded in ACTIVATION.md.

Status: **I** implemented; **V** verified locally; **E** externally dependent verification/configuration. Final test commands/results are recorded in VERIFICATION.md.

| ID     | Required capability                              | Implementation / acceptance evidence                                                        | Status |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------ |
| PUB-01 | Homepage and authentic official brand            | Marketing components, faithful raster derivatives; desktop/tablet/mobile browser review     | V      |
| PUB-02 | Method with all seven steps                      | Method page, shared workflow sequence; no missing Deploy stage                              | V      |
| PUB-03 | Savings Sprint details and all deliverables      | Savings Sprint page and complete price/scope explanation                                    | V      |
| PUB-04 | Fixed and outcome implementation alternatives    | Implementation and pricing pages; £15k/25% terms consistent                                 | V      |
| PUB-05 | Verification explanation                         | Separate expected, observed-normalised and verified annualised values                       | V      |
| PUB-06 | Security and AWS access                          | Read-only discovery boundaries and customer deployment authority                            | V      |
| PUB-07 | Pricing, contact, FAQ                            | Persisted contact plus SMTP acknowledgements; complete FAQ                                  | V      |
| PUB-08 | Privacy, terms and checkout policies             | Explicit legal configuration points and server activation gates                             | V / E  |
| PUB-09 | Error, 404, loading, empty and permission states | Shared public/account/portal states                                                         | V      |
| PUB-10 | Premium responsive system across every surface   | Shared typography/colour/controls; scoped portal design                                     | V      |
| PUB-11 | SEO and accessibility                            | Metadata, sitemap, robots, semantic controls, keyboard support and axe                      | V      |
| COM-01 | Server-owned order configuration                 | Fixed SKU/GBP/minor-unit prices; tax and legal approval enforced                            | V      |
| COM-02 | Company/billing details and scope review         | Checkout form validation; immutable commercial snapshots                                    | V      |
| COM-03 | Real Stripe Checkout                             | Official SDK, idempotent session creation, hosted payment entry                             | V / E  |
| COM-04 | Verified/idempotent payment processing           | Raw-body signatures, payment identity/amount/currency checks, atomic fulfilment             | V      |
| COM-05 | Failure, pending, cancellation, expiry           | Accurate provider state, unpaid cancellation and retry paths                                | V      |
| COM-06 | Refunds/disputes/reconciliation                  | Persisted events, financial history, provider-state reconciliation                          | V / E  |
| COM-07 | Genuine order confirmation/receipt access        | Transactional outbox and provider receipt link; test labels maintained                      | V      |
| COM-08 | Safe order-to-account claiming                   | Verified email possession, no domain matching or URL-token membership                       | V      |
| COM-09 | Fixed implementation purchase after agreement    | Versioned proposal acceptance and £15k server validation                                    | V      |
| COM-10 | Outcome agreement without automatic charging     | Accepted basis; published GBP evidence; separately approved exact fee; duplicate protection | V / E  |
| IAM-01 | Registration, verification, login and logout     | Better Auth and persisted PostgreSQL sessions                                               | V      |
| IAM-02 | Password recovery and account settings           | Recovery, password/name changes and session revocation                                      | V      |
| IAM-03 | Mandatory administrator MFA                      | TOTP/recovery codes; stale pre-enrollment sessions denied                                   | V      |
| IAM-04 | Organisation permissions and tenant isolation    | Server checks, composite tenant foreign keys, direct-request tests                          | V      |
| IAM-05 | Invitations and membership management            | Hashed expiring invitations, verified-email acceptance, owner retention                     | V      |
| ONB-01 | Resumable onboarding and review                  | Persisted drafts/submissions, review/request-change states                                  | V      |
| ONB-02 | AWS role templates and external IDs              | Least-privilege CloudFormation/Terraform/manual guidance                                    | V      |
| ONB-03 | Real AWS role/billing validation                 | Correct and missing/wrong external-ID checks; explicit failed/revoked states                | V / E  |
| ONB-04 | Billing/inventory ingestion                      | Paginated SDK collectors, source/currency/estimated coverage diagnostics                    | V / E  |
| ONB-05 | Secure supporting documents                      | Private storage, type/content limits, quarantine and malware scanning                       | V      |
| CUS-01 | Dashboard and engagement timelines               | Real tenant records, empty states, method progress and updates                              | V      |
| CUS-02 | Savings ledger and opportunity detail            | Search/filter/sort/export, resource/owner/risk/evidence/IaC context                         | V      |
| CUS-03 | Distinct financial states                        | Estimates separate from observed/verified; currency-aware totals                            | V      |
| CUS-04 | Remediation/approval tracking                    | Exact revision approval, requested changes and history                                      | V      |
| CUS-05 | Customer-controlled deployment                   | Explicit customer confirmation/evidence; no discovery mutations                             | V      |
| CUS-06 | Deliverables and evidence                        | Draft/publication distinction and authorised clean-file downloads                           | V      |
| CUS-07 | Verification records                             | Baseline/windows/adjustments/agreement/evidence/reviewer/calculation versions               | V      |
| CUS-08 | Billing, orders, proposals and settings          | Persisted commercial records, accepted scopes and role-appropriate controls                 | V      |
| CUS-09 | Support workflow                                 | Persisted questions/replies, notifications and operational ownership                        | V      |
| ADM-01 | Organisation/customer management                 | Provisioning, memberships, engagement CRUD and selection                                    | V      |
| ADM-02 | Order/payment operations                         | Cross-customer records, status/reconciliation and audit                                     | V      |
| ADM-03 | Onboarding/AWS reviews                           | Submission reviews, connection state and evidence diagnostics                               | V      |
| ADM-04 | Opportunity/remediation management               | Validated findings, revisions, ownership and technical references                           | V      |
| ADM-05 | Deliverable management                           | Secure upload, scan status, version and explicit publication                                | V      |
| ADM-06 | Verification management                          | Calculation/review/publication with source-revision invalidation                            | V      |
| ADM-07 | Customer updates and support                     | Publication controls and persistent replies                                                 | V      |
| ADM-08 | Operational configuration and recovery           | Integration indicators, queue/mail/file failures and explicit retries                       | V      |
| SYS-01 | Database schema/migrations                       | Versioned SQL with transactional migration lock; fresh database test                        | V      |
| SYS-02 | Durable worker/outbox                            | pg-boss backoff/deadletter and PostgreSQL mail outbox                                       | V      |
| SYS-03 | Real email integration                           | Branded escaped HTML/plain text; local SMTP capture                                         | V / E  |
| SYS-04 | Real local/S3 storage and ClamAV                 | Tenant-safe files, content restrictions, actual scanner smoke test                          | V / E  |
| SYS-05 | Logging/security/health                          | Redacted errors, audit events, rate limits, headers and health endpoint                     | V      |
| SYS-06 | Repeatable no-secret local environment           | Generated local auth secret, explicit test adapter and Docker services                      | V      |
| SYS-07 | Automated tests and CI                           | Unit/domain, PostgreSQL, HTTP+SMTP, browser and accessibility checks                        | V      |
| SYS-08 | Docker deployment and AWS reference              | Web/worker images, private infrastructure, TLS/secrets/backup runbooks                      | V / E  |
| SYS-09 | Isolation of illustrative data                   | Read-only explicit demo routes; no automatic demo rows in customer tenants                  | V      |
| SYS-10 | Full acceptance audit                            | Every requirement mapped; local tests and activation limits recorded                        | V / E  |

No row may be silently removed to obtain completion. An E entry means the real integration is implemented but its external account, approval or live acceptance still requires activation; it does not mean a simulated production implementation is acceptable.
