import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { requireAccess } from './access';
import { sql, transaction } from './db';
import {
  entityKinds,
  type EntityKind,
  type EntityRecord,
  type Engagement,
  type Order,
  type Workspace,
} from './contracts';
import { workflowStages } from './schema';
import { appUrl } from './config';
import { outcomeSettlement } from './outcome-billing';

type Data = Record<string, unknown>;
type DbRecord = {
  id: string;
  organisation_id: string;
  engagement_id: string | null;
  kind: EntityKind;
  title: string;
  status: string;
  version: number;
  data: Data;
  created_at: Date;
  updated_at: Date;
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const statuses: Record<EntityKind, string[]> = {
  onboarding: ['draft', 'submitted', 'approved', 'changes_requested'],
  opportunity: ['investigating', 'validated', 'assigned', 'superseded'],
  remediation: ['draft', 'in_review', 'approved', 'changes_requested', 'rejected', 'deployed'],
  approval: ['approved', 'rejected', 'superseded'],
  deployment: ['deployed', 'rolled_back'],
  deliverable: ['draft', 'published', 'archived'],
  verification: ['draft', 'reviewed', 'published', 'superseded'],
  proposal: ['draft', 'proposed', 'accepted', 'rejected', 'superseded'],
  support: ['open', 'in_progress', 'resolved'],
  update: ['draft', 'published', 'archived'],
};
const defaults: Record<EntityKind, string> = {
  onboarding: 'draft',
  opportunity: 'investigating',
  remediation: 'draft',
  approval: 'approved',
  deployment: 'deployed',
  deliverable: 'draft',
  verification: 'draft',
  proposal: 'draft',
  support: 'open',
  update: 'draft',
};
const text = (value: unknown, max = 20000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const dateString = (value: Date | string) => new Date(value).toISOString();
const numeric = (value: unknown, label: string) => {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(n))
    throw new DomainError(`${label} must be a finite number.`);
  return n;
};
const isCustomerApprover = (role: string | null) => role === 'owner' || role === 'approver';
const canOnboard = (role: string | null) => ['owner', 'approver', 'member'].includes(role ?? '');
export function toRecord(row: DbRecord): EntityRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    engagementId: row.engagement_id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    version: row.version,
    data: row.data,
    createdAt: dateString(row.created_at),
    updatedAt: dateString(row.updated_at),
  };
}
function safeData(value: unknown): Data {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw new DomainError('A data object is required.');
  const encoded = JSON.stringify(value);
  if (encoded.length > 200000)
    throw new DomainError('This record is too large. Upload supporting files instead.');
  if (
    /"(?:secretAccessKey|awsAccessKeyId|secretKey|accessKey)"\s*:|(?:AKIA|ASIA)[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(
      encoded,
    )
  )
    throw new DomainError('Do not submit AWS access keys, private keys, or secrets.');
  return JSON.parse(encoded) as Data;
}
function calendarDate(value: unknown, label: string) {
  const input = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input))
    throw new DomainError(`${label} must use a calendar date (YYYY-MM-DD).`);
  const date = new Date(`${input}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input)
    throw new DomainError(`${label} is invalid.`);
  return date;
}
export function verificationCalculation(data: Data) {
  const start = calendarDate(data.observationStart, 'Observation start'),
    end = calendarDate(data.observationEnd, 'Observation end'),
    baseStart = calendarDate(data.baselineStart, 'Baseline start'),
    baseEnd = calendarDate(data.baselineEnd, 'Baseline end');
  const days = (end.getTime() - start.getTime()) / 86400000,
    baselineDays = (baseEnd.getTime() - baseStart.getTime()) / 86400000;
  if (!Number.isFinite(days) || !Number.isFinite(baselineDays) || days <= 0 || baselineDays <= 0)
    throw new DomainError('Valid baseline and observation windows are required.');
  if (baseEnd > start) throw new DomainError('The baseline must end before observation begins.');
  const baseline = numeric(data.baselineCost, 'Baseline cost'),
    observed = numeric(data.observedCost, 'Observed cost');
  if (baseline < 0 || observed < 0) throw new DomainError('Costs cannot be negative.');
  const adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  let adjustment = 0;
  for (const item of adjustments) {
    if (typeof item !== 'object' || !item || !text((item as Data).description))
      throw new DomainError('Every adjustment requires a description.');
    adjustment += numeric((item as Data).amount, 'Adjustment');
  }
  const baselineNormalised = (baseline / baselineDays) * days;
  const normalisedSaving = Number((baselineNormalised - observed + adjustment).toFixed(8));
  if (!Number.isFinite(normalisedSaving) || !Number.isFinite((normalisedSaving / days) * 365))
    throw new DomainError('Financial values exceed the supported calculation range.');
  return {
    observationDays: days,
    baselineDays,
    normalisedBaselineCost: baselineNormalised,
    normalisedSaving,
    annualisedSaving: Number(((normalisedSaving / days) * 365).toFixed(8)),
    calculationVersion: 'normalised-daily-365-v1',
  };
}
export function validateEntity(kind: EntityKind, data: Data, status: string) {
  if (!statuses[kind].includes(status)) throw new DomainError(`Invalid ${kind} status.`);
  if (kind === 'opportunity') {
    if (
      data.monthlySaving !== undefined &&
      numeric(data.monthlySaving, 'Expected monthly saving') < 0
    )
      throw new DomainError('Expected savings cannot be negative.');
    if (data.currency && !/^[A-Z]{3}$/.test(text(data.currency)))
      throw new DomainError('Use an ISO currency code.');
    for (const f of ['confidence', 'risk'])
      if (data[f] && !['low', 'medium', 'high'].includes(text(data[f])))
        throw new DomainError(`Invalid ${f}.`);
    if (status === 'validated' && (!text(data.evidence) || !text(data.recommendedAction)))
      throw new DomainError('Validated opportunities require evidence and a recommended action.');
  }
  if (kind === 'remediation' && !text(data.opportunityId))
    throw new DomainError('Select the linked savings opportunity.');
  if (kind === 'deliverable' && status === 'published' && !text(data.fileId) && !text(data.url))
    throw new DomainError(
      'A published deliverable requires a clean file or a secure evidence URL.',
    );
  if (kind === 'proposal') {
    if (!['implementation', 'outcome'].includes(text(data.offer)))
      throw new DomainError('Choose fixed implementation or outcome-based implementation.');
    if (
      data.offer === 'implementation' &&
      numeric(data.amount ?? 1500000, 'Implementation price') !== 1500000
    )
      throw new DomainError('The fixed Implementation Sprint is £15,000.');
    if (
      data.offer === 'outcome' &&
      data.percentage !== undefined &&
      numeric(data.percentage, 'Outcome percentage') !== 25
    )
      throw new DomainError('The outcome option is 25% of verified savings.');
    if (
      ['proposed', 'accepted'].includes(status) &&
      (!text(data.scope) ||
        !text(data.termsVersion) ||
        (data.offer === 'outcome' && !text(data.measurementBasis)))
    )
      throw new DomainError(
        'Scope, approved terms, and the applicable measurement basis must be agreed before acceptance.',
      );
  }
  if (kind === 'support' && !text(data.message) && !Array.isArray(data.replies))
    throw new DomainError('Write a support message.');
  if (kind === 'verification' && ['reviewed', 'published'].includes(status)) {
    const result = verificationCalculation(data);
    const minimum = numeric(data.minimumObservationDays ?? 30, 'Agreed observation period');
    if (minimum <= 0 || minimum > 366)
      throw new DomainError('The agreed observation period must be between 1 and 366 days.');
    if (result.observationDays < minimum)
      throw new DomainError(
        `Verification requires the agreed ${minimum} complete days of observation (30 by default).`,
      );
    if (new Date(text(data.observationEnd)) > new Date())
      throw new DomainError('Observation cannot end in the future.');
    if (
      !text(data.evidence) ||
      !text(data.measurementBasis) ||
      !text(data.agreementEvidence) ||
      !text(data.currency)
    )
      throw new DomainError(
        'Verification requires billing evidence, currency, an agreed measurement basis, and agreement evidence.',
      );
  }
}
async function audit(
  c: PoolClient,
  org: string | null,
  actor: string,
  action: string,
  id: string | null,
  detail: Data = {},
) {
  await c.query(
    'INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), org, actor, action, id, JSON.stringify(detail)],
  );
}
async function notify(c: PoolClient, org: string, subject: string, message: string) {
  const result = await c.query(
    'SELECT u.email FROM "member" m JOIN "user" u ON u.id=m."userId" WHERE m."organizationId"=$1 AND m.role IN (\'owner\',\'approver\',\'admin\')',
    [org],
  );
  for (const row of result.rows) {
    await c.query(
      "INSERT INTO mail_outbox(id,to_email,subject,text_body,status,attempts) VALUES($1,$2,$3,$4,'pending',0)",
      [randomUUID(), row.email, subject, message],
    );
  }
}
async function linked(
  c: PoolClient,
  id: unknown,
  org: string,
  kind: EntityKind,
  engagement?: string | null,
) {
  const result = await c.query<DbRecord>(
    'SELECT * FROM records WHERE id=$1 AND organisation_id=$2 AND kind=$3',
    [text(id), org, kind],
  );
  const row = result.rows[0];
  if (!row || (engagement && row.engagement_id !== engagement))
    throw new DomainError(`The linked ${kind} is unavailable in this engagement.`, 404);
  return row;
}
async function insertRecord(
  c: PoolClient,
  org: string,
  engagement: string | null,
  kind: EntityKind,
  title: string,
  status: string,
  data: Data,
  actor: string,
) {
  const id = randomUUID();
  const row = (
    await c.query<DbRecord>(
      'INSERT INTO records(id,organisation_id,engagement_id,kind,title,status,data,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id, org, engagement, kind, title, status, JSON.stringify(data), actor],
    )
  ).rows[0];
  await c.query(
    'INSERT INTO record_revisions(record_id,version,data,actor_id) VALUES($1,1,$2,$3)',
    [id, JSON.stringify({ title, status, ...data }), actor],
  );
  return row;
}
async function saveRecord(
  c: PoolClient,
  row: DbRecord,
  title: string,
  status: string,
  data: Data,
  actor: string,
) {
  const updated = (
    await c.query<DbRecord>(
      'UPDATE records SET title=$1,status=$2,data=$3,version=version+1,updated_at=now() WHERE id=$4 AND version=$5 RETURNING *',
      [title, status, JSON.stringify(data), row.id, row.version],
    )
  ).rows[0];
  if (!updated) throw new DomainError('This record changed. Reload before saving.', 409);
  await c.query(
    'INSERT INTO record_revisions(record_id,version,data,actor_id) VALUES($1,$2,$3,$4)',
    [row.id, updated.version, JSON.stringify({ title, status, ...data }), actor],
  );
  return updated;
}
async function verificationSources(
  c: PoolClient,
  data: Data,
  org: string,
  engagement: string | null,
) {
  const opportunity = await linked(c, data.opportunityId, org, 'opportunity', engagement),
    deployment = await linked(c, data.deploymentId, org, 'deployment', engagement),
    remediation = await linked(c, deployment.data.remediationId, org, 'remediation', engagement);
  if (remediation.data.opportunityId !== opportunity.id)
    throw new DomainError('The deployment must remediate the selected opportunity.');
  if (deployment.status !== 'deployed')
    throw new DomainError('A completed customer deployment is required.');
  return { opportunity, deployment, remediation };
}
async function onboardingFiles(c: PoolClient, data: Data, org: string) {
  const references = [
    text(data.supportingFileId),
    ...(Array.isArray(data.supportingFileIds) ? data.supportingFileIds.map((id) => text(id)) : []),
  ].filter(Boolean);
  for (const id of new Set(references)) {
    const file = (
      await c.query('SELECT status FROM files WHERE id=$1 AND organisation_id=$2', [id, org])
    ).rows[0];
    if (!file || file.status !== 'clean')
      throw new DomainError(
        'Supporting documents must belong to this company and pass security scanning.',
      );
  }
}
async function invalidateVerification(c: PoolClient, source: DbRecord, actor: string) {
  const candidates = (
    await c.query<DbRecord>(
      "SELECT * FROM records WHERE organisation_id=$1 AND kind='verification' AND status IN ('reviewed','published') FOR UPDATE",
      [source.organisation_id],
    )
  ).rows;
  for (const candidate of candidates) {
    let affected =
      (source.kind === 'opportunity' && candidate.data.opportunityId === source.id) ||
      (source.kind === 'deployment' && candidate.data.deploymentId === source.id);
    if (source.kind === 'remediation') {
      const deployment = (
        await c.query<DbRecord>('SELECT * FROM records WHERE id=$1 AND organisation_id=$2', [
          text(candidate.data.deploymentId),
          source.organisation_id,
        ])
      ).rows[0];
      affected = deployment?.data.remediationId === source.id;
    }
    if (affected) {
      const next: Data = {
        ...candidate.data,
        invalidatedAt: new Date().toISOString(),
        invalidatedReason: `Linked ${source.kind} revision changed`,
      };
      delete next.reviewedBy;
      delete next.reviewedAt;
      await saveRecord(c, candidate, candidate.title, 'draft', next, actor);
      await audit(c, source.organisation_id, actor, 'verification.invalidated', candidate.id, {
        sourceId: source.id,
      });
    }
  }
}
export async function loadWorkspace(request: Request, organisationId?: string): Promise<Workspace> {
  const access = await requireAccess(request, organisationId ? { organisationId } : undefined);
  const organisations = access.isStaff
    ? await sql<{ id: string; name: string; role: string }>(
        'SELECT id,name,\'staff\' as role FROM "organization" ORDER BY name',
      )
    : await sql<{ id: string; name: string; role: string }>(
        'SELECT o.id,o.name,m.role FROM "organization" o JOIN "member" m ON m."organizationId"=o.id WHERE m."userId"=$1 ORDER BY o.name',
        [access.user.id],
      );
  const selected = organisationId ?? access.organisationId ?? organisations[0]?.id;
  const organisation = organisations.find((o) => o.id === selected) ?? null;
  const settingsRows = await sql<{ key: string; value: Data }>(
    "SELECT key,value FROM settings WHERE key IN ('public',$1)",
    [`organisation:${organisation?.id ?? ''}`],
  );
  const settings: Data = {};
  for (const row of settingsRows) Object.assign(settings, row.value);
  let engagements: Engagement[] = [],
    records: EntityRecord[] = [],
    orders: Order[] = [],
    members: Workspace['members'] = [],
    events: Workspace['audit'] = [];
  if (organisation) {
    const org = organisation.id;
    const [engagementRows, recordRows, orderRows, memberRows, eventRows, awsRows] =
      await Promise.all([
        sql<{
          id: string;
          organisation_id: string;
          title: string;
          status: string;
          stage: string;
          created_at: Date;
          data: Data;
        }>('SELECT * FROM engagements WHERE organisation_id=$1 ORDER BY created_at DESC', [org]),
        sql<DbRecord>('SELECT * FROM records WHERE organisation_id=$1 ORDER BY created_at DESC', [
          org,
        ]),
        sql<Record<string, unknown>>(
          'SELECT * FROM orders WHERE organisation_id=$1 ORDER BY created_at DESC',
          [org],
        ),
        sql<{ id: string; name: string; email: string; role: string }>(
          'SELECT u.id,u.name,u.email,m.role FROM "member" m JOIN "user" u ON u.id=m."userId" WHERE m."organizationId"=$1 ORDER BY u.name',
          [org],
        ),
        sql<{ id: string; action: string; created_at: Date; actor: string; detail: unknown }>(
          'SELECT a.id,a.action,a.created_at,COALESCE(u.name,\'System\') actor,a.detail FROM audit_events a LEFT JOIN "user" u ON u.id=a.actor_id WHERE a.organisation_id=$1 ORDER BY a.created_at DESC LIMIT 100',
          [org],
        ),
        sql(
          'SELECT id,role_arn,status,account_id,last_error,last_checked_at,last_synced_at,engagement_id FROM aws_connections WHERE organisation_id=$1 ORDER BY created_at DESC',
          [org],
        ),
      ]);
    engagements = engagementRows.map((r) => ({
      id: r.id,
      organisationId: r.organisation_id,
      title: r.title,
      status: r.status,
      stage: r.stage,
      createdAt: dateString(r.created_at),
      data: r.data,
    }));
    records = recordRows
      .filter(
        (r) =>
          access.isStaff ||
          !['deliverable', 'verification', 'update', 'proposal'].includes(r.kind) ||
          ['published', 'proposed', 'accepted', 'rejected'].includes(r.status),
      )
      .filter((r) => access.isStaff || r.data.visibility !== 'internal')
      .map(toRecord);
    orders = orderRows.map((r) => ({
      id: String(r.id),
      organisationId: r.organisation_id as string | null,
      email: String(r.email),
      company: String(r.company),
      name: String(r.name),
      amount: Number(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      offer: String(r.offer),
      createdAt: dateString(r.created_at as Date),
      receiptUrl: r.receipt_url as string | null,
    }));
    members = memberRows;
    events = eventRows
      .filter(
        (r) =>
          access.isStaff ||
          ['owner', 'billing'].includes(organisation.role) ||
          !/^order\.|^payment\./.test(r.action),
      )
      .map((r) => ({
        id: r.id,
        action: r.action,
        createdAt: dateString(r.created_at),
        actor: r.actor,
        detail: r.detail,
      }));
    settings.awsConnections = awsRows;
  } else if (access.isStaff) {
    const unclaimed = await sql<Record<string, unknown>>(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
    );
    orders = unclaimed.map((r) => ({
      id: String(r.id),
      organisationId: r.organisation_id as string | null,
      email: String(r.email),
      company: String(r.company),
      name: String(r.name),
      amount: Number(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      offer: String(r.offer),
      createdAt: dateString(r.created_at as Date),
      receiptUrl: r.receipt_url as string | null,
    }));
  }
  if (access.isStaff) {
    const allOrders = await sql<Record<string, unknown>>(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 500',
    );
    settings.unassignedOrders = allOrders
      .filter((r) => !r.organisation_id)
      .map((r) => ({
        id: String(r.id),
        organisationId: null,
        email: String(r.email),
        company: String(r.company),
        name: String(r.name),
        amount: Number(r.amount),
        currency: String(r.currency),
        status: String(r.status),
        offer: String(r.offer),
        createdAt: dateString(r.created_at as Date),
        receiptUrl: r.receipt_url as string | null,
      }));
    settings.allOrders = allOrders.map((r) => ({
      id: String(r.id),
      organisationId: r.organisation_id,
      email: String(r.email),
      company: String(r.company),
      name: String(r.name),
      amount: Number(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      offer: String(r.offer),
      createdAt: dateString(r.created_at as Date),
      receiptUrl: r.receipt_url as string | null,
    }));
  }
  if (!access.isStaff && !['owner', 'billing'].includes(organisation?.role ?? '')) orders = [];
  return {
    user: access.user,
    organisation,
    organisations,
    engagements,
    records,
    orders,
    members,
    audit: events,
    settings,
    isStaff: access.isStaff,
    capabilities: {
      localTest: process.env.NODE_ENV !== 'production' && process.env.PAYMENTS_PROVIDER === 'test',
      canSubmitOnboarding: access.isStaff || canOnboard(organisation?.role ?? null),
      canBilling: access.isStaff || ['owner', 'billing'].includes(organisation?.role ?? ''),
      canApprove: !access.isStaff && isCustomerApprover(organisation?.role ?? null),
      canUpload: access.isStaff || canOnboard(organisation?.role ?? null),
      canManageTeam: access.isStaff || organisation?.role === 'owner',
      aws: process.env.AWS_INTEGRATION_ENABLED === 'true',
      payments: Boolean(process.env.STRIPE_SECRET_KEY),
      files: true,
      email: Boolean(process.env.SMTP_HOST),
      malwareScanning: Boolean(process.env.CLAMAV_HOST),
    },
  };
}
export async function mutateWorkspace(request: Request, input: unknown) {
  const body = safeData(input),
    action = text(body.action, 80),
    data = safeData(body.data ?? {}),
    orgId = text(body.organisationId, 100),
    id = text(body.id, 100);
  const access = await requireAccess(request, orgId ? { organisationId: orgId } : undefined);
  if (action === 'acceptInvite') {
    const token = text(data.token, 500);
    if (!token) throw new DomainError('An invitation token is required.');
    return transaction(async (c) => {
      const invite = (
        await c.query('SELECT * FROM organisation_invitations WHERE token_hash=$1 FOR UPDATE', [
          createHash('sha256').update(token).digest('hex'),
        ])
      ).rows[0];
      if (
        !invite ||
        invite.accepted_at ||
        new Date(invite.expires_at) < new Date() ||
        invite.email.toLowerCase() !== access.user.email.toLowerCase()
      )
        throw new DomainError(
          'This invitation is expired, already used, or belongs to another email.',
          403,
        );
      await c.query(
        'INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,$4) ON CONFLICT("organizationId","userId") DO NOTHING',
        [randomUUID(), invite.organisation_id, access.user.id, invite.role],
      );
      await c.query('UPDATE organisation_invitations SET accepted_at=now() WHERE id=$1', [
        invite.id,
      ]);
      await audit(c, invite.organisation_id, access.user.id, 'invitation.accepted', invite.id);
      return { ok: true, organisationId: invite.organisation_id };
    });
  }
  if (action === 'createOrganisation') {
    if (!access.isStaff)
      throw new DomainError('Only administrators can provision organisations.', 403);
    const name = text(data.name, 160);
    if (!name) throw new DomainError('Company name is required.');
    return transaction(async (c) => {
      const newId = randomUUID();
      await c.query('INSERT INTO "organization"(id,name,slug) VALUES($1,$2,$3)', [
        newId,
        name,
        `${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 50)}-${newId.slice(0, 8)}`,
      ]);
      await audit(c, newId, access.user.id, 'organisation.created', newId);
      return { ok: true, organisationId: newId };
    });
  }
  if (!orgId) throw new DomainError('Select an organisation.');
  const memberRole = access.organisationRole;
  const approver = isCustomerApprover(memberRole);
  return transaction(async (c) => {
    if (action === 'createEngagement' || action === 'updateEngagement') {
      if (!access.isStaff) throw new DomainError('Only administrators manage engagements.', 403);
      const title = text(data.title, 200);
      if (!title) throw new DomainError('Engagement title is required.');
      const stage = text(data.stage) || 'Find';
      if (!(workflowStages as readonly string[]).includes(stage))
        throw new DomainError('Invalid method stage.');
      const status = text(data.status) || 'onboarding';
      if (
        ![
          'onboarding',
          'active',
          'implementation',
          'verification',
          'complete',
          'on_hold',
          'cancelled',
        ].includes(status)
      )
        throw new DomainError('Invalid engagement status.');
      const engagementId = action === 'createEngagement' ? randomUUID() : id;
      if (action === 'createEngagement')
        await c.query(
          'INSERT INTO engagements(id,organisation_id,title,status,stage,data) VALUES($1,$2,$3,$4,$5,$6)',
          [engagementId, orgId, title, status, stage, JSON.stringify(data)],
        );
      else if (
        !(
          await c.query(
            'UPDATE engagements SET title=$1,status=$2,stage=$3,data=data||$4::jsonb,updated_at=now() WHERE id=$5 AND organisation_id=$6',
            [title, status, stage, JSON.stringify(data), engagementId, orgId],
          )
        ).rowCount
      )
        throw new DomainError('Engagement not found.', 404);
      await audit(
        c,
        orgId,
        access.user.id,
        `engagement.${action === 'createEngagement' ? 'created' : 'updated'}`,
        engagementId,
        { stage, status },
      );
      await notify(
        c,
        orgId,
        'HKGpipi engagement update',
        `${title}: ${stage} — ${status}. Review the secure portal for details.`,
      );
      return { ok: true, id: engagementId };
    }
    if (action === 'settings') {
      if (!access.isStaff && memberRole !== 'owner')
        throw new DomainError('Company owners manage settings.', 403);
      const name = text(data.name, 160),
        notificationEmail = text(data.notificationEmail, 254);
      if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail))
        throw new DomainError('Enter a valid notification email.');
      if (name) await c.query('UPDATE "organization" SET name=$1 WHERE id=$2', [name, orgId]);
      await c.query(
        'INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=settings.value||excluded.value,updated_at=now()',
        [`organisation:${orgId}`, JSON.stringify({ notificationEmail })],
      );
      await audit(c, orgId, access.user.id, 'organisation.settings_updated', orgId);
      return { ok: true };
    }
    if (action === 'invite') {
      if (!access.isStaff && memberRole !== 'owner')
        throw new DomainError('Company owners invite team members.', 403);
      const email = text(data.email, 254).toLowerCase(),
        role = text(data.role) || 'viewer';
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !['owner', 'approver', 'member', 'viewer', 'billing'].includes(role)
      )
        throw new DomainError('A valid email and customer role are required.');
      const token = randomBytes(32).toString('hex'),
        inviteId = randomUUID();
      await c.query(
        "INSERT INTO organisation_invitations(id,organisation_id,email,role,token_hash,expires_at,invited_by) VALUES($1,$2,$3,$4,$5,now()+interval '7 days',$6)",
        [
          inviteId,
          orgId,
          email,
          role,
          createHash('sha256').update(token).digest('hex'),
          access.user.id,
        ],
      );
      const base = appUrl();
      await c.query(
        "INSERT INTO mail_outbox(id,to_email,subject,text_body,status,attempts) VALUES($1,$2,$3,$4,'pending',0)",
        [
          randomUUID(),
          email,
          'Your HKGpipi company invitation',
          `Sign in using ${email}, then accept your invitation: ${base}/portal?invite=${token}\nThis link expires in seven days.`,
        ],
      );
      await audit(c, orgId, access.user.id, 'member.invited', inviteId, { email, role });
      return { ok: true };
    }
    if (action === 'removeMember') {
      if (!access.isStaff && memberRole !== 'owner')
        throw new DomainError('Only owners can remove members.', 403);
      if (id === access.user.id) throw new DomainError('You cannot remove your own membership.');
      const target = (
        await c.query(
          'SELECT role FROM "member" WHERE "userId"=$1 AND "organizationId"=$2 FOR UPDATE',
          [id, orgId],
        )
      ).rows[0];
      if (!target) throw new DomainError('Member not found.', 404);
      if (
        target.role === 'owner' &&
        (
          await c.query('SELECT id FROM "member" WHERE "organizationId"=$1 AND role=\'owner\'', [
            orgId,
          ])
        ).rowCount === 1
      )
        throw new DomainError('An organisation must retain an owner.');
      await c.query('DELETE FROM "member" WHERE "userId"=$1 AND "organizationId"=$2', [id, orgId]);
      await audit(c, orgId, access.user.id, 'member.removed', id);
      return { ok: true };
    }
    const kind = text(body.entity) as EntityKind;
    if (!(entityKinds as readonly string[]).includes(kind))
      throw new DomainError('Choose a supported record type.');
    // Conversation authorship is server-owned. Client-supplied history must not
    // impersonate staff or replace previously recorded replies.
    if (kind === 'support') delete data.replies;
    const proposalQuery = async (text: string, values: unknown[]) =>
      (await c.query(text, values)).rows;
    const engagementId = text(body.engagementId, 100) || null;
    if (
      engagementId &&
      !(
        await c.query('SELECT id FROM engagements WHERE id=$1 AND organisation_id=$2', [
          engagementId,
          orgId,
        ])
      ).rowCount
    )
      throw new DomainError('Engagement not found.', 404);
    let row: DbRecord | undefined;
    if (id) {
      row = (
        await c.query<DbRecord>(
          'SELECT * FROM records WHERE id=$1 AND organisation_id=$2 AND kind=$3 FOR UPDATE',
          [id, orgId, kind],
        )
      ).rows[0];
      if (!row) throw new DomainError('Record not found.', 404);
      if (Number(body.version) !== row.version)
        throw new DomainError('This record changed. Reload before saving.', 409);
    }
    if (action === 'create') {
      if (!access.isStaff && !['onboarding', 'support'].includes(kind))
        throw new DomainError('Only administrators create this record.', 403);
      if (!access.isStaff && kind === 'onboarding' && !canOnboard(memberRole))
        throw new DomainError('Company owners, approvers, or members manage onboarding.', 403);
      if (['approval', 'deployment'].includes(kind))
        throw new DomainError('Use the approval or deployment workflow.');
      const title = text(data.title, 240);
      if (!title) throw new DomainError('A title is required.');
      const status = text(data.status) || defaults[kind];
      if (kind === 'onboarding' && !['draft', 'submitted'].includes(status))
        throw new DomainError('Onboarding must be submitted before review.');
      if (
        ['deliverable', 'verification', 'proposal', 'update'].includes(kind) &&
        status !== 'draft'
      )
        throw new DomainError('Create a draft, then use the review or publication workflow.');
      if (kind === 'remediation' && !['draft', 'in_review'].includes(status))
        throw new DomainError('Use the customer approval and deployment workflow.');
      delete data.title;
      delete data.status;
      if (kind === 'remediation')
        await linked(c, data.opportunityId, orgId, 'opportunity', engagementId);
      if (kind === 'verification') {
        await verificationSources(c, data, orgId, engagementId);
        if (data.baselineStart && data.observationStart)
          Object.assign(data, verificationCalculation(data));
      }
      if (kind === 'proposal') {
        data.amount = data.offer === 'implementation' ? 1500000 : 0;
        data.currency = 'GBP';
        data.percentage = data.offer === 'outcome' ? 25 : undefined;
        if (data.offer === 'outcome' && data.parentProposalId && data.verificationId)
          Object.assign(data, await outcomeSettlement(data, orgId, undefined, proposalQuery));
        if (status === 'accepted')
          throw new DomainError('Only the customer can accept a proposed scope.');
      }
      if (kind === 'onboarding') await onboardingFiles(c, data, orgId);
      validateEntity(kind, data, status);
      row = await insertRecord(c, orgId, engagementId, kind, title, status, data, access.user.id);
    } else {
      if (!row) throw new DomainError('Select a record.');
      let next: Data = { ...row.data },
        status = row.status,
        title = row.title;
      if (action === 'update') {
        if (!access.isStaff && !['onboarding', 'support'].includes(kind))
          throw new DomainError('Only administrators edit this record.', 403);
        if (['approval', 'deployment'].includes(kind))
          throw new DomainError(
            'Approval and deployment records are immutable; use the explicit rollback workflow.',
          );
        if (!access.isStaff && kind === 'onboarding' && !canOnboard(memberRole))
          throw new DomainError('Company owners, approvers, or members manage onboarding.', 403);
        if (kind === 'support' && text(data.reply)) {
          const replies = Array.isArray(next.replies) ? next.replies : [];
          next.replies = [
            ...replies,
            {
              id: randomUUID(),
              author: access.user.name,
              actorId: access.user.id,
              message: text(data.reply),
              at: new Date().toISOString(),
              staff: access.isStaff,
            },
          ];
          status = text(data.status) || row.status;
        } else {
          title = text(data.title, 240) || row.title;
          status = text(data.status) || row.status;
          delete data.title;
          delete data.status;
          next = { ...next, ...data };
          if (kind === 'onboarding' && !['draft', 'submitted'].includes(status))
            status = 'submitted';
          if (kind === 'remediation') {
            status = status === 'draft' ? 'draft' : 'in_review';
            delete next.approvedBy;
            delete next.approvedAt;
            delete next.approvedRevision;
          }
          if (kind === 'proposal') {
            status = 'draft';
            delete next.acceptedBy;
            delete next.acceptedAt;
            delete next.acceptedVersion;
            delete next.verificationRevision;
            delete next.parentRevision;
            delete next.settlementAmount;
            if (next.offer === 'outcome' && next.parentProposalId && next.verificationId)
              Object.assign(next, await outcomeSettlement(next, orgId, row.id, proposalQuery));
          }
          if (kind === 'deliverable' || kind === 'update') status = 'draft';
          if (kind === 'verification') {
            status = 'draft';
            delete next.reviewedBy;
            delete next.reviewedAt;
            Object.assign(next, verificationCalculation(next));
          }
        }
      } else if (action === 'delete') {
        if (!access.isStaff) throw new DomainError('Only administrators archive records.', 403);
        status =
          kind === 'opportunity'
            ? 'superseded'
            : kind === 'proposal' || kind === 'verification'
              ? 'superseded'
              : kind === 'support'
                ? 'resolved'
                : statuses[kind].includes('archived')
                  ? 'archived'
                  : row.status;
        next.archived = true;
        next.archivedAt = new Date().toISOString();
      } else if (action === 'approve' || action === 'reject') {
        if (kind === 'remediation') {
          if (access.isStaff || !approver)
            throw new DomainError(
              'Customer owners or approvers must approve the exact remediation revision.',
              403,
            );
          if (!['in_review', 'changes_requested', 'draft'].includes(row.status))
            throw new DomainError('This remediation is not awaiting approval.');
          if (!text(row.data.description) || !text(row.data.evidence))
            throw new DomainError('Remediation needs change details and evidence before approval.');
          status = action === 'approve' ? 'approved' : 'changes_requested';
          await insertRecord(
            c,
            orgId,
            row.engagement_id,
            'approval',
            `${action === 'approve' ? 'Approved' : 'Changes requested'}: ${row.title}`,
            action === 'approve' ? 'approved' : 'rejected',
            {
              remediationId: row.id,
              revision: row.version + 1,
              reviewedRevision: row.version,
              decision: action,
              reason: text(data.reason),
              customerId: access.user.id,
            },
            access.user.id,
          );
          next.approvedRevision = action === 'approve' ? row.version + 1 : null;
          next.approvedBy = action === 'approve' ? access.user.id : null;
          next.approvedAt = action === 'approve' ? new Date().toISOString() : null;
        } else if (kind === 'onboarding' && access.isStaff) {
          if (row.status !== 'submitted')
            throw new DomainError('Only submitted onboarding can be reviewed.');
          status = action === 'approve' ? 'approved' : 'changes_requested';
          next.reviewedBy = access.user.id;
          next.reviewedAt = new Date().toISOString();
          next.reviewNote = text(data.reason);
        } else if (kind === 'proposal' && action === 'reject' && !access.isStaff && approver) {
          status = 'rejected';
          next.rejectedBy = access.user.id;
          next.reason = text(data.reason);
        } else throw new DomainError('This action is unavailable.', 403);
      } else if (action === 'accept' && kind === 'proposal') {
        if (access.isStaff || memberRole !== 'owner')
          throw new DomainError(
            'The customer company owner must accept the commercial proposal.',
            403,
          );
        if (row.status !== 'proposed')
          throw new DomainError('Only proposed scopes can be accepted.');
        status = 'accepted';
        next.acceptedBy = access.user.id;
        next.acceptedAt = new Date().toISOString();
        next.acceptedVersion = row.version;
        next.acceptanceEvidence =
          text(data.reason) || 'Accepted in the authenticated customer portal';
      } else if (action === 'publish') {
        if (
          !access.isStaff ||
          !['deliverable', 'verification', 'update', 'proposal'].includes(kind)
        )
          throw new DomainError('Only administrators publish this record.', 403);
        if (kind === 'verification') {
          if (row.status !== 'reviewed')
            throw new DomainError('Review the verification record before publication.');
          const sources = await verificationSources(c, next, orgId, row.engagement_id);
          if (
            Number(next.opportunityRevision) !== sources.opportunity.version ||
            Number(next.deploymentRevision) !== sources.deployment.version ||
            Number(next.remediationRevision) !== sources.remediation.version
          )
            throw new DomainError(
              'Linked evidence changed after review. Review the verification again.',
              409,
            );
        }
        status = kind === 'proposal' ? 'proposed' : 'published';
        next.publishedAt = new Date().toISOString();
        next.publishedBy = access.user.id;
      } else if (action === 'deploy' && kind === 'remediation') {
        if (access.isStaff || !approver)
          throw new DomainError('The customer must confirm its authorised deployment.', 403);
        if (row.status !== 'approved' || Number(row.data.approvedRevision) !== row.version)
          throw new DomainError(
            'Approve the current remediation revision before recording deployment.',
          );
        if (
          data.customerControlled !== true ||
          !text(data.evidence) ||
          !text(data.deployedAt) ||
          !Number.isFinite(Date.parse(text(data.deployedAt))) ||
          new Date(text(data.deployedAt)) > new Date()
        )
          throw new DomainError(
            'Provide the customer deployment time and evidence, and confirm customer-controlled deployment.',
          );
        await insertRecord(
          c,
          orgId,
          row.engagement_id,
          'deployment',
          `Deployment: ${row.title}`,
          'deployed',
          {
            remediationId: row.id,
            revision: row.version,
            deployedAt: text(data.deployedAt),
            evidence: text(data.evidence),
            customerControlled: true,
            confirmedBy: access.user.id,
          },
          access.user.id,
        );
        status = 'deployed';
        next.deployedAt = text(data.deployedAt);
        next.deploymentEvidence = text(data.evidence);
      } else if (action === 'rollback' && kind === 'deployment') {
        if (access.isStaff || !approver)
          throw new DomainError('Customer approvers must confirm a rollback.', 403);
        if (!text(data.reason) || !text(data.evidence))
          throw new DomainError('Rollback reason and customer evidence are required.');
        status = 'rolled_back';
        next.rolledBackAt = new Date().toISOString();
        next.rollbackReason = text(data.reason);
        next.rollbackEvidence = text(data.evidence);
        next.rolledBackBy = access.user.id;
      } else if (action === 'verify' && kind === 'verification') {
        if (!access.isStaff) throw new DomainError('Only HKGpipi reviewers verify savings.', 403);
        const { deployment, opportunity, remediation } = await verificationSources(
          c,
          next,
          orgId,
          row.engagement_id,
        );
        if (opportunity.data.currency && next.currency !== opportunity.data.currency)
          throw new DomainError('Verification currency must match the opportunity.');
        if (new Date(text(next.observationStart)) < new Date(text(deployment.data.deployedAt)))
          throw new DomainError('Observation must start after deployment.');
        const overlaps = await c.query(
          "SELECT id FROM records WHERE organisation_id=$1 AND kind='verification' AND id!=$2 AND status IN ('reviewed','published') AND data->>'opportunityId'=$3 AND (data->>'observationStart')::date < $4::date AND (data->>'observationEnd')::date > $5::date",
          [orgId, row.id, opportunity.id, text(next.observationEnd), text(next.observationStart)],
        );
        if (overlaps.rowCount)
          throw new DomainError(
            'This observation overlaps an existing verified record for the opportunity. Supersede the previous record first.',
          );
        Object.assign(next, verificationCalculation(next), {
          reviewedBy: access.user.id,
          reviewedAt: new Date().toISOString(),
          opportunityRevision: opportunity.version,
          deploymentRevision: deployment.version,
          remediationRevision: remediation.version,
        });
        status = 'reviewed';
      } else throw new DomainError('Unsupported action.');
      if (kind === 'onboarding') await onboardingFiles(c, next, orgId);
      if (
        kind === 'proposal' &&
        next.offer === 'outcome' &&
        next.parentProposalId &&
        ['proposed', 'accepted'].includes(status)
      )
        Object.assign(next, await outcomeSettlement(next, orgId, row.id, proposalQuery));
      validateEntity(kind, next, status);
      if (kind === 'deliverable' && ['published'].includes(status) && text(next.fileId)) {
        const file = (
          await c.query('SELECT status FROM files WHERE id=$1 AND organisation_id=$2', [
            text(next.fileId),
            orgId,
          ])
        ).rows[0];
        if (!file || file.status !== 'clean')
          throw new DomainError(
            'The deliverable file must pass security scanning before publication.',
          );
      }
      if (text(next.url) && !/^https:\/\//i.test(text(next.url)))
        throw new DomainError('Evidence links must use HTTPS.');
      if (kind === 'remediation')
        await linked(c, next.opportunityId, orgId, 'opportunity', row.engagement_id);
      row = await saveRecord(c, row, title, status, next, access.user.id);
      if (
        ['opportunity', 'remediation', 'deployment'].includes(kind) &&
        ['update', 'rollback', 'delete'].includes(action)
      )
        await invalidateVerification(c, row, access.user.id);
    }
    await audit(c, orgId, access.user.id, `${kind}.${action}`, row.id, {
      status: row.status,
      version: row.version,
    });
    if (
      ['publish', 'approve', 'reject', 'accept', 'deploy', 'verify'].includes(action) ||
      kind === 'support' ||
      (kind === 'onboarding' && row.status === 'submitted')
    )
      await notify(
        c,
        orgId,
        `HKGpipi: ${row.title}`,
        `${row.title} — ${row.status}. Open your secure HKGpipi portal to review the update.`,
      );
    return { record: toRecord(row) };
  });
}
