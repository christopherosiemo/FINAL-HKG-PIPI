# AWS reference deployment

This Terraform configuration is a deployment reference, not an already-provisioned service. Applying it creates billable resources; no apply or production DNS change is part of local development.

Provide an existing VPC, public subnets for the HTTPS application load balancer, and private subnets with outbound NAT or appropriate endpoints for ECS/ECR, S3, AWS billing APIs, SMTP and ClamAV definition updates. Supply an already-validated ACM certificate and immutable web/worker image URIs. The reference creates private encrypted PostgreSQL with protected backups, private encrypted/versioned S3, ECS web/worker tasks with malware scanning, HTTPS routing, CloudWatch logs and a storage alarm. It does not change public DNS.

Store the application runtime JSON secret in Secrets Manager: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`. Supply only its ARN. Use a dedicated application database login, never the RDS master login in the web service. Bootstrap tables with the migration role, grant the runtime role the required table/sequence rights and ownership of the dedicated jobs schema for pg-boss migrations. Use verified TLS database connections and the appropriate RDS CA trust configuration.

Set `commercial_activation_approved=false` until approved legal/tax configuration and provider acceptance are complete. Give the application role only explicit customer discovery-role ARNs. The generated role ARN is the trusted principal to review with customers. AWS and Stripe remain real adapters; the reference does not inject local fixture secrets.

Use an isolated staging name and URLs first. Build the web image with `docker build --target web` and worker with `--target worker`. Run `terraform init`, `terraform fmt -check` and `terraform validate`, then review the complete plan. Protect remote Terraform state; configure a backed-up encrypted remote backend before a real apply. Connect alarm actions, CloudWatch logs and the redacted error-monitoring webhook to the approved operations destination. Confirm retention, database sizing, high availability and email provider requirements before production.

The scanner is an essential sidecar; a failed scan remains quarantined and can be retried operationally. Run migrations and scanner/provider checks before customer acceptance. Keep a record of image digests and the prior service revision for rollback. Domain replacement remains subject to explicit owner authorisation.
