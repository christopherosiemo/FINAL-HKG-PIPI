import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/access', async () => {
  const { sql } = await import('../src/lib/db');
  return {
    requireAccess: async (request: Request, options: { organisationId?: string } = {}) => {
      const id = request.headers.get('x-fixture-user');
      const user = (
        await sql<{
          id: string;
          name: string;
          email: string;
          role: string;
          twoFactorEnabled: boolean;
        }>('SELECT * FROM "user" WHERE id=$1', [id])
      )[0];
      if (!user) throw Object.assign(new Error('Sign in'), { status: 401 });
      const member = (
        await sql<{ role: string; organizationId: string }>(
          'SELECT * FROM "member" WHERE "userId"=$1 AND ($2::text IS NULL OR "organizationId"=$2) ORDER BY "createdAt" LIMIT 1',
          [id, options.organisationId ?? null],
        )
      )[0];
      if (options.organisationId && user.role !== 'admin' && !member)
        throw Object.assign(new Error('Organisation inaccessible'), { status: 404 });
      return {
        user,
        isStaff: user.role === 'admin',
        organisationId: member?.organizationId ?? null,
        organisationRole: member?.role ?? null,
      };
    },
  };
});
import { pool, sql } from '../src/lib/db';
import { mutateWorkspace, loadWorkspace } from '../src/lib/domain';
import type { EntityRecord } from '../src/lib/contracts';

const ids = {
  staff: randomUUID(),
  customer: randomUUID(),
  other: randomUUID(),
  org: randomUUID(),
  otherOrg: randomUUID(),
  engagement: randomUUID(),
};
const req = (who: keyof typeof ids) =>
  new Request('http://localhost/api/v1/workspace', { headers: { 'x-fixture-user': ids[who] } });
const mutation = (who: keyof typeof ids, body: Record<string, unknown>) =>
  mutateWorkspace(req(who), {
    organisationId: ids.org,
    engagementId: ids.engagement,
    data: {},
    ...body,
  }) as Promise<{ record: EntityRecord }>;
let opportunity: EntityRecord,
  remediation: EntityRecord,
  deployment: EntityRecord,
  verification: EntityRecord;
it('binds a single-use team invitation to its recipient and retains company ownership', async () => {
  const [recipient] = await sql<{ email: string }>('SELECT email FROM "user" WHERE id=$1', [
    ids.other,
  ]);
  await mutation('customer', {
    action: 'invite',
    data: { email: recipient.email, role: 'approver' },
  });
  const [mail] = await sql<{ text_body: string }>(
    'SELECT text_body FROM mail_outbox WHERE to_email=$1 ORDER BY created_at DESC LIMIT 1',
    [recipient.email],
  );
  const token = mail.text_body.match(/invite=([a-f0-9]+)/)?.[1];
  expect(token).toBeTruthy();
  await expect(
    mutateWorkspace(req('customer'), { action: 'acceptInvite', data: { token } }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    mutateWorkspace(req('other'), { action: 'acceptInvite', data: { token } }),
  ).resolves.toMatchObject({ ok: true, organisationId: ids.org });
  await expect(
    mutateWorkspace(req('other'), { action: 'acceptInvite', data: { token } }),
  ).rejects.toMatchObject({ status: 403 });
  const [member] = await sql<{ role: string }>(
    'SELECT role FROM "member" WHERE "organizationId"=$1 AND "userId"=$2',
    [ids.org, ids.other],
  );
  expect(member.role).toBe('approver');
  await expect(mutation('staff', { action: 'removeMember', id: ids.customer })).rejects.toThrow(
    'retain an owner',
  );
  await mutation('customer', { action: 'removeMember', id: ids.other });
});
it('prevents duplicate payable requests for the same outcome agreement and verification', async () => {
  const data = { parentProposalId: randomUUID(), verificationId: randomUUID() };
  const insert = () =>
    sql(
      "INSERT INTO records(id,organisation_id,kind,title,status,data,created_by) VALUES($1,$2,'proposal','Outcome fixture','proposed',$3,$4)",
      [randomUUID(), ids.org, data, ids.staff],
    );
  await insert();
  await expect(insert()).rejects.toMatchObject({
    code: '23505',
    constraint: 'outcome_settlement_evidence_unique',
  });
});
it('never trusts customer-supplied support reply authorship', async () => {
  const made = await mutation('customer', {
    action: 'create',
    entity: 'support',
    data: {
      title: 'A support question',
      message: 'Please review our engagement context.',
      replies: [{ author: 'HKGpipi', staff: true, message: 'Forged reply' }],
    },
  });
  expect(made.record.data.replies).toBeUndefined();
  const edited = await mutation('customer', {
    action: 'update',
    entity: 'support',
    id: made.record.id,
    version: made.record.version,
    data: { replies: [{ author: 'HKGpipi', staff: true, message: 'Forged reply' }] },
  });
  expect(edited.record.data.replies).toBeUndefined();
  const reply = await mutation('customer', {
    action: 'update',
    entity: 'support',
    id: edited.record.id,
    version: edited.record.version,
    data: { reply: 'Additional context from the customer.' },
  });
  expect((reply.record.data.replies as { staff: boolean; actorId: string }[])[0]).toMatchObject({
    staff: false,
    actorId: ids.customer,
  });
});
beforeAll(async () => {
  for (const [key, role] of [
    ['staff', 'admin'],
    ['customer', 'customer'],
    ['other', 'customer'],
  ] as const)
    await sql(
      'INSERT INTO "user"(id,name,email,"emailVerified",role,"twoFactorEnabled") VALUES($1,$2,$3,true,$4,true)',
      [ids[key], `Domain fixture ${key}`, `${ids[key]}@domain.test`, role],
    );
  await sql('INSERT INTO "organization"(id,name,slug) VALUES($1,$2,$1),($3,$4,$3)', [
    ids.org,
    'Domain integration company',
    ids.otherOrg,
    'Other company',
  ]);
  await sql(
    'INSERT INTO "member"(id,"organizationId","userId",role) VALUES($1,$2,$3,\'owner\'),($4,$5,$6,\'owner\')',
    [randomUUID(), ids.org, ids.customer, randomUUID(), ids.otherOrg, ids.other],
  );
  await sql(
    "INSERT INTO engagements(id,organisation_id,title,status,stage) VALUES($1,$2,'Savings Sprint','active','Find')",
    [ids.engagement, ids.org],
  );
});
afterAll(async () => {
  await sql('DELETE FROM orders WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM files WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql(
    'DELETE FROM record_revisions WHERE record_id IN (SELECT id FROM records WHERE organisation_id IN ($1,$2))',
    [ids.org, ids.otherOrg],
  );
  await sql('DELETE FROM records WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM audit_events WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM engagements WHERE organisation_id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM "member" WHERE "organizationId" IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql('DELETE FROM organisation_invitations WHERE organisation_id IN ($1,$2)', [
    ids.org,
    ids.otherOrg,
  ]);
  await sql('DELETE FROM "organization" WHERE id IN ($1,$2)', [ids.org, ids.otherOrg]);
  await sql("DELETE FROM mail_outbox WHERE to_email LIKE '%@domain.test'");
  await sql('DELETE FROM "user" WHERE id IN ($1,$2,$3)', [ids.staff, ids.customer, ids.other]);
  await pool.end();
});
describe('persistent tenant-isolated delivery workflow', () => {
  it('persists findings and prevents another organisation reading or updating them', async () => {
    opportunity = (
      await mutation('staff', {
        action: 'create',
        entity: 'opportunity',
        data: {
          title: 'Idle EC2',
          status: 'validated',
          service: 'EC2',
          monthlySaving: 200,
          currency: 'GBP',
          confidence: 'high',
          risk: 'low',
          recommendedAction: 'Rightsize the instance',
          evidence: '30 days of CPU and billing records',
        },
      })
    ).record;
    expect(opportunity.version).toBe(1);
    await expect(loadWorkspace(req('other'), ids.org)).rejects.toMatchObject({ status: 404 });
    await expect(
      mutation('other', {
        action: 'update',
        entity: 'opportunity',
        id: opportunity.id,
        version: 1,
        data: { title: 'Injected' },
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await loadWorkspace(req('customer'), ids.org)).records.some((r) => r.id === opportunity.id),
    ).toBe(true);
  });
  it('prevents lifecycle bypass through generic record creation', async () => {
    await expect(
      mutation('staff', {
        action: 'create',
        entity: 'remediation',
        data: { title: 'Bypass', status: 'approved', opportunityId: opportunity.id },
      }),
    ).rejects.toThrow('approval');
    await expect(
      mutation('staff', {
        action: 'create',
        entity: 'verification',
        data: { title: 'Fake result', status: 'published' },
      }),
    ).rejects.toThrow('draft');
    await expect(
      mutation('staff', {
        action: 'create',
        entity: 'deployment',
        data: { title: 'Fake deployment' },
      }),
    ).rejects.toThrow('workflow');
  });
  it('binds customer approval to the exact revision and invalidates it after edits', async () => {
    remediation = (
      await mutation('staff', {
        action: 'create',
        entity: 'remediation',
        data: {
          title: 'Rightsize change',
          status: 'in_review',
          opportunityId: opportunity.id,
          description: 'IaC instance type change',
          evidence: 'Reviewed Terraform plan',
        },
      })
    ).record;
    await expect(
      mutation('staff', {
        action: 'approve',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    remediation = (
      await mutation('customer', {
        action: 'approve',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
      })
    ).record;
    expect(remediation.data.approvedRevision).toBe(remediation.version);
    await expect(
      mutation('staff', {
        action: 'update',
        entity: 'remediation',
        id: remediation.id,
        version: 1,
        data: { description: 'Stale' },
      }),
    ).rejects.toMatchObject({ status: 409 });
    remediation = (
      await mutation('staff', {
        action: 'update',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
        data: { description: 'Revised IaC change' },
      })
    ).record;
    expect(remediation.status).toBe('in_review');
    expect(remediation.data.approvedRevision).toBeUndefined();
    await expect(
      mutation('customer', {
        action: 'deploy',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
        data: {
          deployedAt: '2026-08-31T00:00:00Z',
          evidence: 'CI evidence',
          customerControlled: true,
        },
      }),
    ).rejects.toThrow('Approve');
  });
  it('requires customer authority and creates traceable deployment evidence', async () => {
    remediation = (
      await mutation('customer', {
        action: 'approve',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
      })
    ).record;
    await expect(
      mutation('staff', {
        action: 'deploy',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
        data: {
          deployedAt: '2026-08-31T00:00:00Z',
          evidence: 'CI evidence',
          customerControlled: true,
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    remediation = (
      await mutation('customer', {
        action: 'deploy',
        entity: 'remediation',
        id: remediation.id,
        version: remediation.version,
        data: {
          deployedAt: '2026-08-31T00:00:00Z',
          evidence: 'Customer CI deployment 123',
          customerControlled: true,
        },
      })
    ).record;
    deployment = (await loadWorkspace(req('customer'), ids.org)).records.find(
      (r) => r.kind === 'deployment',
    )!;
    expect(deployment.data.confirmedBy).toBe(ids.customer);
  });
  it('verifies actual billing, publishes only reviewed results, and invalidates changed evidence', async () => {
    verification = (
      await mutation('staff', {
        action: 'create',
        entity: 'verification',
        data: {
          title: 'Observed saving',
          opportunityId: opportunity.id,
          deploymentId: deployment.id,
          baselineStart: '2026-08-01',
          baselineEnd: '2026-08-31',
          observationStart: '2026-09-01',
          observationEnd: '2026-10-01',
          baselineCost: 6000,
          observedCost: 4200,
          currency: 'GBP',
          adjustments: [],
          measurementBasis: 'Daily normalisation, 365-day annualisation',
          agreementEvidence: 'Accepted engagement scope v1',
          evidence: 'AWS billing exports 2026-08/09',
        },
      })
    ).record;
    await expect(
      mutation('staff', {
        action: 'publish',
        entity: 'verification',
        id: verification.id,
        version: verification.version,
      }),
    ).rejects.toThrow('Review');
    expect(
      (await loadWorkspace(req('customer'), ids.org)).records.find((r) => r.id === verification.id),
    ).toBeUndefined();
    verification = (
      await mutation('staff', {
        action: 'verify',
        entity: 'verification',
        id: verification.id,
        version: verification.version,
      })
    ).record;
    expect(verification.data.normalisedSaving).toBe(1800);
    verification = (
      await mutation('staff', {
        action: 'publish',
        entity: 'verification',
        id: verification.id,
        version: verification.version,
      })
    ).record;
    expect(
      (await loadWorkspace(req('customer'), ids.org)).records.find((r) => r.id === verification.id)
        ?.status,
    ).toBe('published');
    await mutation('staff', {
      action: 'update',
      entity: 'opportunity',
      id: opportunity.id,
      version: opportunity.version,
      data: { evidence: 'Revised billing evidence' },
    });
    const current = (
      await sql<{ status: string; data: Record<string, unknown> }>(
        'SELECT status,data FROM records WHERE id=$1',
        [verification.id],
      )
    )[0];
    expect(current.status).toBe('draft');
    expect(current.data.reviewedBy).toBeUndefined();
  });
  it('keeps customer scopes non-payable until authenticated acceptance', async () => {
    let proposal = (
      await mutation('staff', {
        action: 'create',
        entity: 'proposal',
        data: {
          title: 'Implementation scope',
          offer: 'implementation',
          amount: 1500000,
          currency: 'GBP',
          scope: 'Rightsize approved resources',
          termsVersion: 'approved-contract-v1',
        },
      })
    ).record;
    proposal = (
      await mutation('staff', {
        action: 'publish',
        entity: 'proposal',
        id: proposal.id,
        version: proposal.version,
      })
    ).record;
    await expect(
      mutation('staff', {
        action: 'accept',
        entity: 'proposal',
        id: proposal.id,
        version: proposal.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    proposal = (
      await mutation('customer', {
        action: 'accept',
        entity: 'proposal',
        id: proposal.id,
        version: proposal.version,
      })
    ).record;
    expect(proposal.status).toBe('accepted');
    expect(proposal.data.acceptedBy).toBe(ids.customer);
  });
  it('enforces owner, approver, member, viewer and billing permissions on persisted records', async () => {
    await sql(
      "INSERT INTO orders(id,organisation_id,email,company,name,amount,currency,status,offer,checkout_key,terms_version,legal_snapshot,tax_snapshot) VALUES($1,$2,$3,'Fixture company','Owner',500000,'gbp','pending','savings-sprint',$1,'test-only','{}','{}')",
      [randomUUID(), ids.org, `${ids.customer}@domain.test`],
    );
    for (const role of ['viewer', 'member', 'approver', 'billing', 'owner']) {
      await sql('UPDATE "member" SET role=$1 WHERE "userId"=$2 AND "organizationId"=$3', [
        role,
        ids.customer,
        ids.org,
      ]);
      const workspace = await loadWorkspace(req('customer'), ids.org);
      expect(workspace.capabilities.canBilling).toBe(['owner', 'billing'].includes(role));
      expect(workspace.orders.length).toBe(['owner', 'billing'].includes(role) ? 1 : 0);
      expect(workspace.capabilities.canSubmitOnboarding).toBe(
        ['owner', 'approver', 'member'].includes(role),
      );
      const create = () =>
        mutation('customer', {
          action: 'create',
          entity: 'onboarding',
          data: {
            title: `${role} onboarding`,
            status: 'draft',
            scope: 'Customer onboarding scope',
          },
        });
      if (['viewer', 'billing'].includes(role))
        await expect(create()).rejects.toMatchObject({ status: 403 });
      else expect((await create()).record.kind).toBe('onboarding');
      if (['member', 'viewer', 'billing'].includes(role))
        await expect(
          mutation('customer', {
            action: 'approve',
            entity: 'remediation',
            id: remediation.id,
            version: remediation.version,
          }),
        ).rejects.toMatchObject({ status: 403 });
    }
  });
  it('rejects cross-company or quarantined onboarding document references', async () => {
    const otherFile = randomUUID(),
      quarantineFile = randomUUID();
    for (const [id, org, status] of [
      [otherFile, ids.otherOrg, 'clean'],
      [quarantineFile, ids.org, 'quarantined'],
    ])
      await sql(
        "INSERT INTO files(id,organisation_id,object_key,filename,mime,size,sha256,status,provider,uploaded_by) VALUES($1,$2,$1,'evidence.txt','text/plain',10,$3,$4,'local',$5)",
        [id, org, '0'.repeat(64), status, ids.customer],
      );
    for (const fileId of [otherFile, quarantineFile])
      await expect(
        mutation('customer', {
          action: 'create',
          entity: 'onboarding',
          data: { title: 'Document onboarding', supportingFileId: fileId },
        }),
      ).rejects.toThrow('Supporting documents');
  });
});
