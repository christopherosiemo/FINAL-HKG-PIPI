/** Persisted domain tables live in versioned SQL migrations; auth tables are maintained alongside them. */
export const tenantTables = [
  'engagements',
  'records',
  'audit_events',
  'aws_connections',
  'billing_snapshots',
  'files',
] as const;
export const workflowStages = [
  'Find',
  'Validate',
  'Assign',
  'Change',
  'Approve',
  'Deploy',
  'Verify',
] as const;
export const customerRoles = ['owner', 'approver', 'member', 'viewer', 'billing'] as const;
export type CustomerRole = (typeof customerRoles)[number];
