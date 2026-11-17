import type { EntityKind, EntityRecord, Workspace } from '@/lib/contracts';
const createdAt = '2026-10-01T09:00:00.000Z';
function record(
  id: string,
  kind: EntityKind,
  title: string,
  status: string,
  data: Record<string, unknown>,
): EntityRecord {
  return {
    id,
    kind,
    title,
    status,
    data,
    organisationId: 'demo-org',
    engagementId: 'demo-engagement',
    version: 1,
    createdAt,
    updatedAt: '2026-11-12T11:30:00.000Z',
  };
}
export const demoWorkspace: Workspace = {
  user: { id: 'demo-user', name: 'Alex Morgan', email: 'alex@example.com', role: 'customer' },
  organisation: { id: 'demo-org', name: 'Illustrative company', role: 'owner' },
  organisations: [{ id: 'demo-org', name: 'Illustrative company', role: 'owner' }],
  isStaff: false,
  capabilities: {},
  settings: { notificationEmail: 'alex@example.com' },
  members: [{ id: 'demo-user', name: 'Alex Morgan', email: 'alex@example.com', role: 'owner' }],
  engagements: [
    {
      id: 'demo-engagement',
      organisationId: 'demo-org',
      title: 'AWS Savings Sprint',
      status: 'in_progress',
      stage: 'Validate',
      createdAt,
      data: { description: 'Illustrative engagement for product demonstration only.' },
    },
  ],
  orders: [
    {
      id: 'demo-order',
      organisationId: 'demo-org',
      email: 'alex@example.com',
      company: 'Illustrative company',
      name: 'Alex Morgan',
      amount: 500000,
      currency: 'GBP',
      status: 'paid',
      offer: 'savings',
      createdAt,
    },
  ],
  audit: [],
  records: [
    record('demo-opp-1', 'opportunity', 'Right-size the staging database', 'validated', {
      service: 'Amazon RDS',
      owner: 'Platform engineering',
      monthlySaving: 1240,
      currency: 'GBP',
      confidence: 'high',
      risk: 'medium',
      accountId: '123456789012',
      resourceId: 'staging-db',
      evidence:
        'Illustrative: 30-day utilisation review shows capacity materially above observed demand.',
      recommendedAction:
        'Validate instance sizing against peak workload, then raise a reviewed infrastructure change.',
      iacLocation: 'infrastructure/staging/database.tf',
    }),
    record('demo-opp-2', 'opportunity', 'Retire unattached development volumes', 'investigating', {
      service: 'Amazon EBS',
      owner: 'Developer experience',
      monthlySaving: 380,
      currency: 'GBP',
      confidence: 'medium',
      risk: 'low',
      evidence: 'Illustrative: candidate volumes have no current instance attachment.',
      recommendedAction:
        'Confirm ownership, retention obligations and snapshots before requesting deletion.',
    }),
    record('demo-opp-3', 'opportunity', 'Review compute commitment exposure', 'validated', {
      service: 'AWS Savings Plans',
      owner: 'FinOps',
      monthlySaving: 860,
      currency: 'GBP',
      confidence: 'medium',
      risk: 'medium',
      evidence: 'Illustrative: commitment coverage needs review against a demand forecast.',
      recommendedAction: 'Review term and usage scenarios before any commercial commitment.',
    }),
    record(
      'demo-remediation',
      'remediation',
      'Staging database sizing change',
      'awaiting_approval',
      {
        opportunityId: 'demo-opp-1',
        description:
          'Illustrative change: propose a smaller database class after performance validation. Customer engineering retains deployment authority.',
        prUrl: 'https://github.com/example',
        evidence: 'Illustrative load-test and rollback plan.',
      },
    ),
    record('demo-deliverable', 'deliverable', 'Prioritised AWS savings ledger', 'published', {
      description:
        'Illustrative deliverable: a ranked opportunity register with confidence, engineering risk and supporting evidence.',
      visibility: 'customer',
    }),
    record('demo-update', 'update', 'Discovery review complete', 'published', {
      message:
        'Illustrative update: the first evidence review is complete. Your engineering team can review the prioritised recommendations.',
    }),
    record('demo-onboarding', 'onboarding', 'AWS estate onboarding', 'approved', {
      contacts: 'Alex Morgan · Platform lead',
      awsAccounts: '123456789012',
      scope: 'Illustrative development and staging environments.',
      checklist: 'Internal approval received; billing scope identified.',
    }),
  ],
};
