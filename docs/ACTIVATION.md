# External activation — after implementation and local verification

No production account is needed to develop the application. The default example cannot accept payments. `npm run setup:local` explicitly creates an ignored local test configuration; it never represents approved commercial terms or a provider sandbox.

## Required owner configuration

1. Approve seller legal identity/address, full privacy notice, engagement terms, cancellation/refund and commencement policies, tax treatment, eligible sales markets and retention/subprocessor requirements. Configure the version and HTTPS URLs of approved documents. The bundled explanatory legal pages identify unapproved details; they are not fabricated approved contracts.
2. Provision Stripe. Add a **sandbox secret key** and sandbox webhook secret first; select `PAYMENTS_PROVIDER=stripe`, disable the local test adapter, and configure applicable Stripe Tax settings. Register `/api/payments/stripe/webhook`. Exercise success, decline, authentication challenge, abandonment, delayed delivery, duplicate/reordered events and refunds. Record provider test IDs and evidence without recording card details or secrets. Only then add live keys after account activation. Never use a live card to test failure cases.
3. Configure authenticated SMTP and a verified sender domain. Set SPF/DKIM/DMARC with the chosen provider, review bounce/delivery monitoring, and send a controlled test. Mailpit proves the application/SMTP flow locally; it does not verify internet deliverability.
4. Configure private S3 storage, encryption, access policy and a running ClamAV service with current definitions. Local private storage is supported for a single persistent host; use shared S3 for multiple web/worker replicas. Files remain quarantined if scanning is unavailable.
5. Provide HKGpipi's trusted AWS role principal and workload identity. Configure the permitted regions and explicit customer role ARNs. Agree the onboarding policy with the customer. Verify that missing/wrong external IDs fail, confirm billing scope, collect actual evidence and revoke test access afterwards. Never provide customer access keys to an ordinary form.
6. Provide hosting, TLS/domain/DNS access, monitoring destinations, backup policy and initial administrator email. Create an administrator through the CLI and complete authenticator enrollment; no default administrator exists.
7. For each outcome-based engagement, agree the scope, observation/normalisation/annualisation basis, exclusions, evidence and invoicing conditions before accepting its proposal or requesting payment. The service never charges 25% from an estimated ledger total.

## Activation gates

`LEGAL_APPROVED`, `TAX_APPROVED`, document version/URL, seller details and payment credentials are enforced by the server. Live Stripe additionally rejects local fixture legal/tax values and non-HTTPS terms. Test adapters are forbidden under `NODE_ENV=production`. Missing configuration disables the affected capability rather than returning simulated success.

The final provider acceptance record must distinguish the local payment adapter, actual Stripe sandbox, authorised AWS account tests and live production. None can substitute for another.

## Production release procedure

1. Review the implementation checklist and retained automated test results.
2. Build immutable web and worker images. Run migrations using the migration role. Back up the database and verify the restore procedure in a separate environment.
3. Configure staging secrets outside Git. Deploy the web service, worker and scanner. Check `/api/health`, worker activity, SMTP and private-file processing.
4. Complete provider-backed acceptance using test accounts and approved test documentation. Verify tenant boundaries again against the deployed environment.
5. Obtain explicit authorisation before replacing `hkgpipi.com`. Keep the current website and DNS unchanged until that authorisation is given.
6. Deploy the tested image revisions, verify TLS and canonical URLs, activate approved live commercial configuration, and perform non-charging live smoke checks. Monitor payment errors, webhook lag, failed jobs, scan quarantine, email failures and database health.
7. Roll back application images if needed. Migrations are additive; restore a database only under an explicit, reviewed recovery procedure. Retain payment events and commercial audit history.

## Credentials handling

Use environment injection or Secrets Manager. `.env`, `.env.local`, private files, browser traces and real exports are excluded from Git and deployment tracing. Never put secrets in public environment variables, screenshots, tickets, command arguments or generated documentation.
