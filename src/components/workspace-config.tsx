import type { EntityKind, EntityRecord, Workspace } from '@/lib/contracts';

export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'email' | 'url' | 'select' | 'file';
  options?: string[];
  required?: boolean;
  help?: string;
  placeholder?: string;
};
export const entityLabels: Record<EntityKind, string> = {
  onboarding: 'Onboarding submission',
  opportunity: 'Savings opportunity',
  remediation: 'Remediation',
  approval: 'Approval',
  deployment: 'Deployment record',
  deliverable: 'Deliverable',
  verification: 'Verification record',
  proposal: 'Implementation proposal',
  support: 'Support request',
  update: 'Engagement update',
};
export const stages = ['Find', 'Validate', 'Assign', 'Change', 'Approve', 'Deploy', 'Verify'];
export const fields: Record<EntityKind, Field[]> = {
  onboarding: [
    {
      name: 'contacts',
      label: 'Engagement contacts',
      type: 'textarea',
      required: true,
      help: 'Names, roles and work email addresses of your technical and finance contacts.',
    },
    {
      name: 'awsAccounts',
      label: 'AWS account IDs',
      required: true,
      help: 'Account IDs only. Never enter access keys, secret keys or passwords.',
    },
    { name: 'scope', label: 'Estate and engagement scope', type: 'textarea', required: true },
    {
      name: 'roleArn',
      label: 'Discovery role ARN',
      placeholder: 'arn:aws:iam::123456789012:role/HKGpipiDiscovery',
    },
    {
      name: 'checklist',
      label: 'Access and onboarding checklist',
      type: 'textarea',
      help: 'Confirm internal approval, account ownership and billing data availability.',
    },
    { name: 'notes', label: 'Additional context', type: 'textarea' },
    {
      name: 'supportingFileId',
      label: 'Secure supporting file ID',
      help: 'Optional. Upload an approved supporting document below; never upload credentials.',
    },
  ],
  opportunity: [
    { name: 'service', label: 'AWS service', required: true },
    { name: 'accountId', label: 'AWS account ID' },
    { name: 'resourceId', label: 'Resource reference' },
    {
      name: 'overlapGroup',
      label: 'Mutually exclusive opportunity group',
      help: 'Use the same group for alternative changes whose savings must not be added together. Findings for the same resource are also counted conservatively.',
    },
    { name: 'owner', label: 'Responsible team / owner' },
    { name: 'monthlySaving', label: 'Expected monthly saving', type: 'number', required: true },
    { name: 'currency', label: 'Currency', type: 'select', options: ['GBP', 'USD', 'EUR'] },
    { name: 'confidence', label: 'Confidence', type: 'select', options: ['low', 'medium', 'high'] },
    { name: 'risk', label: 'Engineering risk', type: 'select', options: ['low', 'medium', 'high'] },
    { name: 'evidence', label: 'Supporting evidence', type: 'textarea', required: true },
    { name: 'recommendedAction', label: 'Recommended action', type: 'textarea', required: true },
    { name: 'iacLocation', label: 'Infrastructure-as-code location' },
  ],
  remediation: [
    { name: 'opportunityId', label: 'Opportunity ID', required: true },
    {
      name: 'description',
      label: 'Engineering change and validation plan',
      type: 'textarea',
      required: true,
    },
    { name: 'prUrl', label: 'Pull request URL', type: 'url' },
    { name: 'ticketUrl', label: 'Engineering ticket URL', type: 'url' },
    { name: 'iacLocation', label: 'Infrastructure-as-code location' },
    { name: 'evidence', label: 'Testing and implementation evidence', type: 'textarea' },
  ],
  approval: [
    { name: 'remediationId', label: 'Remediation ID', required: true },
    { name: 'revision', label: 'Remediation revision', type: 'number', required: true },
    { name: 'decision', label: 'Decision', type: 'select', options: ['approved', 'rejected'] },
    { name: 'reason', label: 'Decision rationale', type: 'textarea', required: true },
  ],
  deployment: [
    { name: 'remediationId', label: 'Remediation ID', required: true },
    { name: 'revision', label: 'Approved revision', type: 'number', required: true },
    { name: 'deployedAt', label: 'Deployment date', type: 'date', required: true },
    {
      name: 'evidence',
      label: 'Customer-controlled deployment evidence',
      type: 'textarea',
      required: true,
    },
  ],
  deliverable: [
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    {
      name: 'fileId',
      label: 'Secure file ID',
      help: 'Upload a file below, then use its returned ID here.',
    },
    {
      name: 'url',
      label: 'Supporting external URL',
      type: 'url',
      help: 'Optional. Use an authorised customer-accessible location.',
    },
    { name: 'visibility', label: 'Visibility', type: 'select', options: ['customer', 'internal'] },
  ],
  verification: [
    { name: 'opportunityId', label: 'Opportunity ID', required: true },
    { name: 'deploymentId', label: 'Deployment record ID', required: true },
    { name: 'baselineStart', label: 'Baseline start', type: 'date', required: true },
    { name: 'baselineEnd', label: 'Baseline end', type: 'date', required: true },
    { name: 'observationStart', label: 'Observation start', type: 'date', required: true },
    { name: 'observationEnd', label: 'Observation end', type: 'date', required: true },
    { name: 'baselineCost', label: 'Baseline cost', type: 'number', required: true },
    { name: 'observedCost', label: 'Observed cost', type: 'number', required: true },
    {
      name: 'adjustments',
      label: 'Normalisation adjustment',
      type: 'number',
      help: 'Positive amounts increase the calculated saving; negative amounts reduce it. Explain the approved adjustment below.',
    },
    { name: 'adjustmentReason', label: 'Adjustment explanation', type: 'textarea' },
    {
      name: 'agreementEvidence',
      label: 'Customer agreement evidence',
      type: 'textarea',
      required: true,
      help: 'Record the approval or agreed document that establishes the measurement basis.',
    },
    {
      name: 'minimumObservationDays',
      label: 'Agreed minimum observation days',
      type: 'number',
      help: 'Defaults to 30 days. Any alternative observation period must be supported by the recorded customer agreement.',
    },
    { name: 'currency', label: 'Currency', type: 'select', options: ['GBP', 'USD', 'EUR'] },
    {
      name: 'measurementBasis',
      label: 'Agreed measurement and normalisation basis',
      type: 'textarea',
      required: true,
    },
    {
      name: 'evidence',
      label: 'Billing and deployment evidence',
      type: 'textarea',
      required: true,
    },
  ],
  proposal: [
    {
      name: 'feeBasis',
      label: 'Agreed outcome fee base',
      type: 'select',
      options: ['', 'normalisedSaving', 'annualisedSaving'],
      help: 'Select only the measurement base agreed in the outcome contract. No fee is calculated from estimates.',
    },
    {
      name: 'parentProposalId',
      label: 'Underlying accepted outcome agreement ID',
      help: 'Leave empty for the original agreement; payment requests must link the accepted agreement.',
    },
    {
      name: 'verificationId',
      label: 'Published verification record ID',
      help: 'Required only for a final outcome payment request.',
    },
    {
      name: 'feeAgreementEvidence',
      label: 'Outcome invoicing agreement evidence',
      type: 'textarea',
      help: 'Reference the agreed fee base and invoicing conditions.',
    },
    {
      name: 'offer',
      label: 'Commercial option',
      type: 'select',
      options: ['implementation', 'outcome'],
    },
    { name: 'scope', label: 'Agreed scope of engineering work', type: 'textarea', required: true },
    {
      name: 'amount',
      label: 'Agreed fixed price, in pence',
      type: 'number',
      help: 'Implementation Sprint reference price: 1500000 (£15,000). Outcome-based fees require the agreed verification basis.',
    },
    { name: 'currency', label: 'Currency', type: 'select', options: ['GBP'] },
    { name: 'termsVersion', label: 'Approved terms version', required: true },
    {
      name: 'measurementBasis',
      label: 'Outcome measurement and contractual basis',
      type: 'textarea',
    },
  ],
  support: [
    {
      name: 'message',
      label: 'How can we help?',
      type: 'textarea',
      required: true,
      help: 'Describe the question and relevant engagement. Do not share secrets or credentials.',
    },
  ],
  update: [{ name: 'message', label: 'Customer-facing update', type: 'textarea', required: true }],
};
export const statusOptions: Record<EntityKind, string[]> = {
  onboarding: ['draft', 'submitted', 'approved', 'changes_requested'],
  opportunity: ['investigating', 'validated', 'assigned', 'superseded'],
  remediation: ['draft', 'in_review', 'approved', 'changes_requested', 'deployed'],
  approval: ['approved', 'rejected'],
  deployment: ['deployed', 'rolled_back'],
  deliverable: ['draft', 'published'],
  verification: ['draft', 'reviewed', 'published'],
  proposal: ['draft', 'proposed', 'accepted', 'rejected'],
  support: ['open', 'in_progress', 'resolved'],
  update: ['draft', 'published'],
};
export function human(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(human).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value).replace(/_/g, ' ');
}
export function date(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function money(value: unknown, currency = 'GBP', pence = false): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(pence ? n / 100 : n);
  } catch {
    return `${n.toLocaleString()} ${currency}`;
  }
}
export function recordAmount(record: EntityRecord, field = 'monthlySaving'): number {
  const n = Number(record.data[field]);
  return Number.isFinite(n) ? n : 0;
}
export function exportRecords(records: EntityRecord[], filename: string) {
  const rows = [
    ['ID', 'Title', 'Status', 'Engagement', 'Updated', 'Data'],
    ...records.map((r) => [
      r.id,
      r.title,
      r.status,
      r.engagementId || '',
      r.updatedAt,
      JSON.stringify(r.data),
    ]),
  ];
  const csv = rows
    .map((row) =>
      row
        .map(
          (v) =>
            `"${(/^[=+@\-\t\r]/.test(String(v)) ? "'" + String(v) : String(v)).replace(/"/g, '""')}"`,
        )
        .join(','),
    )
    .join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
export function conservativeOpportunities(records: EntityRecord[]): EntityRecord[] {
  const candidates = new Map<string, EntityRecord>();
  for (const record of records) {
    if (record.kind !== 'opportunity' || record.status === 'superseded' || record.data.archived)
      continue;
    const overlap = String(
      record.data.overlapGroup ||
        (record.data.resourceId
          ? `${record.data.accountId || ''}:${record.data.service || ''}:${record.data.resourceId}`
          : record.id),
    );
    const key = `${record.engagementId}:${record.data.currency || 'GBP'}:${overlap}`;
    const previous = candidates.get(key);
    if (!previous || recordAmount(record) > recordAmount(previous)) candidates.set(key, record);
  }
  return [...candidates.values()];
}
export function latestVerifications(records: EntityRecord[]): EntityRecord[] {
  const latest = new Map<string, EntityRecord>();
  for (const record of [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    if (record.kind !== 'verification' || record.status !== 'published' || record.data.archived)
      continue;
    const opportunity = records.find((item) => item.id === record.data.opportunityId);
    const overlap = String(
      opportunity?.data.overlapGroup ||
        (opportunity?.data.resourceId
          ? `${opportunity.data.accountId || ''}:${opportunity.data.service || ''}:${opportunity.data.resourceId}`
          : record.data.opportunityId || record.id),
    );
    const key = `${record.engagementId}:${record.data.currency || 'GBP'}:${overlap}`;
    if (!latest.has(key)) latest.set(key, record);
  }
  return [...latest.values()];
}
export function groupMoney(records: EntityRecord[], field: string): string[] {
  const values = new Map<string, number>();
  const selected = field === 'monthlySaving' ? conservativeOpportunities(records) : records;
  selected.forEach((r) => {
    const currency = String(r.data.currency || 'GBP');
    values.set(currency, (values.get(currency) || 0) + recordAmount(r, field));
  });
  return [...values].map(([currency, amount]) => money(amount, currency));
}
export function defaultData(kind: EntityKind): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      fields[kind].filter((f) => f.type === 'select').map((f) => [f.name, f.options?.[0] || '']),
    ),
    ...(kind === 'verification' ? { minimumObservationDays: 30 } : {}),
  };
}
export function filteredRecords(
  workspace: Workspace,
  kind: EntityKind,
  engagementId: string,
): EntityRecord[] {
  return workspace.records.filter(
    (r) => r.kind === kind && (!engagementId || r.engagementId === engagementId),
  );
}
