import { randomBytes, randomUUID } from 'node:crypto';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetSavingsPlansCoverageCommand,
  GetSavingsPlansUtilizationCommand,
  GetReservationCoverageCommand,
  GetReservationUtilizationCommand,
} from '@aws-sdk/client-cost-explorer';
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DescribeAddressesCommand,
} from '@aws-sdk/client-ec2';
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { requireAccess } from './access';
import { sql, transaction } from './db';
import { DomainError } from './domain';

export type AwsConnection = {
  id: string;
  organisation_id: string;
  engagement_id: string | null;
  external_id: string;
  role_arn: string | null;
  account_id: string | null;
  status: string;
  last_error?: string | null;
};
export const discoveryActions = [
  'ce:GetCostAndUsage',
  'ce:GetDimensionValues',
  'ce:GetTags',
  'ce:GetSavingsPlansCoverage',
  'ce:GetSavingsPlansUtilization',
  'ce:GetReservationCoverage',
  'ce:GetReservationUtilization',
  'ec2:DescribeInstances',
  'ec2:DescribeVolumes',
  'ec2:DescribeAddresses',
  'rds:DescribeDBInstances',
  'cloudwatch:GetMetricData',
  'cloudwatch:ListMetrics',
];
const enabled = () => process.env.AWS_INTEGRATION_ENABLED === 'true';
const region = () => process.env.AWS_REGION ?? 'eu-west-2';
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'AWS request failed.');
export async function collectPages<T>(
  fetchPage: (token?: string) => Promise<{ items: T[]; nextToken?: string }>,
) {
  const items: T[] = [];
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await fetchPage(token);
    items.push(...page.items);
    token = page.nextToken;
    if (token && seen.has(token))
      throw new Error('AWS returned a repeated pagination token; collection is incomplete.');
    if (token) seen.add(token);
  } while (token);
  return items;
}
export function accessTemplates(
  externalId: string,
  principal = process.env.AWS_DISCOVERY_PRINCIPAL_ARN ?? '',
) {
  const ready = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\/-]+$/.test(principal);
  const trust = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ready ? principal : 'REQUIRES_HKGpipi_APPROVED_PRINCIPAL' },
        Action: 'sts:AssumeRole',
        Condition: { StringEquals: { 'sts:ExternalId': externalId } },
      },
    ],
  };
  const permissions = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'BillingAndInventoryReadOnly',
        Effect: 'Allow',
        Action: discoveryActions,
        Resource: '*',
      },
    ],
  };
  const cloudformation = JSON.stringify(
    {
      AWSTemplateFormatVersion: '2010-09-09',
      Description:
        'HKGpipi engagement-scoped read-only billing and inventory discovery. Review before deployment.',
      Resources: {
        HKGpipiDiscoveryRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            RoleName: 'HKGpipiDiscovery-' + externalId.slice(0, 12),
            MaxSessionDuration: 3600,
            AssumeRolePolicyDocument: trust,
            Policies: [{ PolicyName: 'HKGpipiDiscoveryReadOnly', PolicyDocument: permissions }],
          },
        },
      },
      Outputs: { RoleArn: { Value: { 'Fn::GetAtt': ['HKGpipiDiscoveryRole', 'Arn'] } } },
    },
    null,
    2,
  );
  const terraform = `# Review the trust principal, external ID, permitted accounts and duration before applying.\nresource "aws_iam_role" "hkgpipi_discovery" {\n  name = "HKGpipiDiscoveryReadOnly"\n  max_session_duration = 3600\n  assume_role_policy = jsonencode(${JSON.stringify(trust, null, 2)})\n}\nresource "aws_iam_role_policy" "hkgpipi_discovery" {\n  role = aws_iam_role.hkgpipi_discovery.id\n  policy = jsonencode(${JSON.stringify(permissions, null, 2)})\n}\noutput "hkgpipi_role_arn" { value = aws_iam_role.hkgpipi_discovery.arn }\n`;
  return {
    ready,
    trust,
    permissions,
    cloudformation,
    terraform,
    notice: ready
      ? 'Review this policy with your security team before deploying it in your AWS account.'
      : 'The HKGpipi trusted AWS principal has not been activated. Do not deploy the template until the approved principal is configured.',
  };
}
async function assume(connection: AwsConnection, externalId: string | undefined) {
  if (!connection.role_arn) throw new DomainError('Submit the approved role ARN first.');
  const result = await new STSClient({ region: region() }).send(
    new AssumeRoleCommand({
      RoleArn: connection.role_arn,
      ExternalId: externalId,
      RoleSessionName: `hkgpipi-${connection.id.slice(0, 8)}`,
      DurationSeconds: 900,
    }),
  );
  if (
    !result.Credentials?.AccessKeyId ||
    !result.Credentials.SecretAccessKey ||
    !result.Credentials.SessionToken
  )
    throw new Error('AWS did not return temporary role credentials.');
  return {
    accessKeyId: result.Credentials.AccessKeyId,
    secretAccessKey: result.Credentials.SecretAccessKey,
    sessionToken: result.Credentials.SessionToken,
    expiration: result.Credentials.Expiration,
  };
}
export async function verifyConnection(connection: AwsConnection) {
  if (!enabled())
    throw new DomainError(
      'AWS integration is awaiting account activation. No real connection has been tested.',
      503,
    );
  const credentials = await assume(connection, connection.external_id);
  const identity = await new STSClient({ region: region(), credentials }).send(
    new GetCallerIdentityCommand({}),
  );
  const account = connection.role_arn?.split(':')[4];
  if (identity.Account !== account)
    throw new DomainError('AWS returned an account that does not match the approved role.', 409);
  for (const externalId of [undefined, `invalid-${randomBytes(16).toString('hex')}`]) {
    try {
      await assume(connection, externalId);
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'AccessDenied' || name === 'AccessDeniedException') continue;
      throw new Error(`Unable to verify external ID protection: ${errorMessage(error)}`);
    }
    throw new DomainError(
      'Unsafe trust policy: the role can be assumed without the correct external ID. Correct the trust policy before connecting.',
      409,
    );
  }
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  await new CostExplorerClient({ region: 'us-east-1', credentials }).send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: start.toISOString().slice(0, 10), End: end.toISOString().slice(0, 10) },
      Granularity: 'DAILY',
      Metrics: ['AmortizedCost'],
    }),
  );
  return {
    accountId: identity.Account,
    callerArn: identity.Arn,
    externalIdProtection: true,
    billingRead: true,
    checkedAt: new Date().toISOString(),
  };
}
export async function syncBilling(connection: AwsConnection) {
  if (!enabled() || connection.status !== 'verified')
    throw new DomainError('A verified, authorised AWS connection is required.', 409);
  const credentials = () => assume(connection, connection.external_id);
  const ce = new CostExplorerClient({ region: 'us-east-1', credentials });
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  const period = { Start: start.toISOString().slice(0, 10), End: end.toISOString().slice(0, 10) };
  let token: string | undefined;
  let count = 0;
  do {
    const result = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: period,
        Granularity: 'DAILY',
        Metrics: ['AmortizedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        NextPageToken: token,
      }),
    );
    await transaction(async (c) => {
      for (const day of result.ResultsByTime ?? [])
        for (const group of day.Groups ?? []) {
          const cost = group.Metrics?.AmortizedCost;
          await c.query(
            'INSERT INTO billing_snapshots(id,organisation_id,connection_id,period_start,period_end,currency,cost,estimated,metric,service,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(connection_id,period_start,period_end,currency,metric,service) DO UPDATE SET cost=excluded.cost,estimated=excluded.estimated,source=excluded.source,collected_at=now()',
            [
              randomUUID(),
              connection.organisation_id,
              connection.id,
              day.TimePeriod?.Start,
              day.TimePeriod?.End,
              cost?.Unit ?? 'USD',
              cost?.Amount ?? '0',
              day.Estimated ?? true,
              'AmortizedCost',
              group.Keys?.[0] ?? 'Unknown',
              JSON.stringify({
                provider: 'AWS Cost Explorer',
                accountId: connection.account_id,
                period: day.TimePeriod,
                group,
              }),
            ],
          );
          count++;
        }
    });
    token = result.NextPageToken;
  } while (token);
  const inventoryRegions = (process.env.AWS_DISCOVERY_REGIONS ?? region())
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const inventory: Record<string, unknown> = {};
  const diagnostics: Record<string, string> = {};
  for (const currentRegion of inventoryRegions) {
    const ec2 = new EC2Client({ region: currentRegion, credentials }),
      rds = new RDSClient({ region: currentRegion, credentials });
    const collected: Record<string, unknown> = {};
    const collectors: [string, () => Promise<unknown>][] = [
      [
        'instances',
        async () => ({
          Reservations: await collectPages(async (token) => {
            const result = await ec2.send(
              new DescribeInstancesCommand({ NextToken: token, MaxResults: 100 }),
            );
            return { items: result.Reservations ?? [], nextToken: result.NextToken };
          }),
        }),
      ],
      [
        'volumes',
        async () => ({
          Volumes: await collectPages(async (token) => {
            const result = await ec2.send(
              new DescribeVolumesCommand({ NextToken: token, MaxResults: 100 }),
            );
            return { items: result.Volumes ?? [], nextToken: result.NextToken };
          }),
        }),
      ],
      ['addresses', () => ec2.send(new DescribeAddressesCommand({}))],
      [
        'databases',
        async () => ({
          DBInstances: await collectPages(async (token) => {
            const result = await rds.send(
              new DescribeDBInstancesCommand({ Marker: token, MaxRecords: 100 }),
            );
            return { items: result.DBInstances ?? [], nextToken: result.Marker };
          }),
        }),
      ],
    ];
    for (const [name, fn] of collectors) {
      try {
        collected[name] = await fn();
      } catch (e) {
        diagnostics[`${currentRegion}:${name}`] = errorMessage(e);
      }
    }
    inventory[currentRegion] = collected;
    const instances = collected.instances as
      { Reservations?: { Instances?: { InstanceId?: string }[] }[] } | undefined;
    const ids = (instances?.Reservations ?? [])
      .flatMap((r) => r.Instances ?? [])
      .map((i) => i.InstanceId)
      .filter((id): id is string => Boolean(id));
    const metrics: unknown[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      try {
        const cloudwatch = new CloudWatchClient({ region: currentRegion, credentials });
        metrics.push(
          ...(await collectPages(async (token) => {
            const result = await cloudwatch.send(
              new GetMetricDataCommand({
                StartTime: start,
                EndTime: end,
                NextToken: token,
                MetricDataQueries: batch.map((id, index) => ({
                  Id: `cpu${index}`,
                  MetricStat: {
                    Metric: {
                      Namespace: 'AWS/EC2',
                      MetricName: 'CPUUtilization',
                      Dimensions: [{ Name: 'InstanceId', Value: id }],
                    },
                    Period: 86400,
                    Stat: 'Average',
                  },
                  ReturnData: true,
                })),
              }),
            );
            return { items: [{ instanceIds: batch, ...result }], nextToken: result.NextToken };
          })),
        );
      } catch (e) {
        diagnostics[`${currentRegion}:metrics:${offset}`] = errorMessage(e);
      }
    }
    collected.cpuMetrics = metrics;
    collected.coverage = {
      region: currentRegion,
      instanceCount: ids.length,
      metricBatchCount: Math.ceil(ids.length / 100),
      allInventoryPagesRequested: true,
    };
  }
  const commitments: Record<string, unknown> = {};
  const commitmentCollectors: [string, () => Promise<unknown>][] = [
    [
      'savingsPlanCoverage',
      () =>
        collectPages(async (token) => {
          const result = await ce.send(
            new GetSavingsPlansCoverageCommand({ TimePeriod: period, NextToken: token }),
          );
          return { items: [result], nextToken: result.NextToken };
        }),
    ],
    [
      'savingsPlanUtilisation',
      () => ce.send(new GetSavingsPlansUtilizationCommand({ TimePeriod: period })),
    ],
    [
      'reservationCoverage',
      () =>
        collectPages(async (token) => {
          const result = await ce.send(
            new GetReservationCoverageCommand({ TimePeriod: period, NextPageToken: token }),
          );
          return { items: [result], nextToken: result.NextPageToken };
        }),
    ],
    [
      'reservationUtilisation',
      () =>
        collectPages(async (token) => {
          const result = await ce.send(
            new GetReservationUtilizationCommand({ TimePeriod: period, NextPageToken: token }),
          );
          return { items: [result], nextToken: result.NextPageToken };
        }),
    ],
  ];
  for (const [name, collect] of commitmentCollectors) {
    try {
      commitments[name] = await collect();
    } catch (e) {
      diagnostics[name] = errorMessage(e);
    }
  }
  await sql('UPDATE aws_connections SET last_synced_at=now(),last_error=$1 WHERE id=$2', [
    Object.keys(diagnostics).length ? JSON.stringify(diagnostics) : null,
    connection.id,
  ]);
  await sql('INSERT INTO aws_checks(id,connection_id,success,detail) VALUES($1,$2,true,$3)', [
    randomUUID(),
    connection.id,
    JSON.stringify({
      kind: 'ingestion',
      billingRows: count,
      inventory,
      commitments,
      diagnostics,
      collectedAt: new Date().toISOString(),
      note: 'Raw evidence only. Findings require engineering validation; no savings have been verified.',
    }),
  ]);
  return {
    billingRows: count,
    diagnostics,
    inventoryRegions,
    note: 'Read-only evidence collected. No infrastructure was changed and no savings have been verified.',
  };
}
export async function listConnections(request: Request, organisationId: string) {
  await requireAccess(request, { organisationId });
  return {
    connections: await sql(
      'SELECT id,organisation_id,engagement_id,external_id,role_arn,account_id,status,last_error,last_checked_at,last_synced_at FROM aws_connections WHERE organisation_id=$1 ORDER BY created_at DESC',
      [organisationId],
    ),
  };
}
export async function awsEvidence(
  request: Request,
  organisationId: string,
  connectionId: string,
  offset = 0,
) {
  await requireAccess(request, { organisationId });
  const connection = (
    await sql(
      'SELECT id,account_id,status,last_synced_at FROM aws_connections WHERE id=$1 AND organisation_id=$2',
      [connectionId, organisationId],
    )
  )[0];
  if (!connection) throw new DomainError('AWS connection not found.', 404);
  const limit = 200;
  offset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const [snapshots, count, checks] = await Promise.all([
    sql(
      'SELECT id,period_start,period_end,currency,cost,estimated,metric,service,collected_at FROM billing_snapshots WHERE connection_id=$1 AND organisation_id=$2 ORDER BY period_start DESC,service LIMIT $3 OFFSET $4',
      [connectionId, organisationId, limit, offset],
    ),
    sql<{ count: string }>(
      'SELECT count(*) FROM billing_snapshots WHERE connection_id=$1 AND organisation_id=$2',
      [connectionId, organisationId],
    ),
    sql(
      "SELECT id,success,created_at,detail - 'inventory' - 'commitments' AS detail FROM aws_checks WHERE connection_id=$1 ORDER BY created_at DESC LIMIT 20",
      [connectionId],
    ),
  ]);
  return {
    connection,
    snapshots,
    checks,
    total: Number(count[0].count),
    offset,
    limit,
    note: 'AWS read-only source evidence. Estimated billing is labelled; neither ingestion nor a connection check verifies savings.',
  };
}
export async function awsTechnicalEvidence(
  request: Request,
  organisationId: string,
  connectionId: string,
  checkId: string,
) {
  await requireAccess(request, { organisationId });
  const evidence = (
    await sql<{ detail: unknown }>(
      'SELECT c.detail FROM aws_checks c JOIN aws_connections a ON a.id=c.connection_id WHERE c.id=$1 AND a.id=$2 AND a.organisation_id=$3',
      [checkId, connectionId, organisationId],
    )
  )[0];
  if (!evidence) throw new DomainError('Evidence not found.', 404);
  return evidence.detail;
}
export async function awsAction(request: Request, input: Record<string, unknown>) {
  const org = String(input.organisationId ?? ''),
    action = String(input.action ?? ''),
    id = String(input.connectionId ?? '');
  const access = await requireAccess(request, { organisationId: org });
  if (!access.isStaff && !['owner', 'approver', 'member'].includes(access.organisationRole ?? ''))
    throw new DomainError('Company owners and approvers manage AWS access.', 403);
  if (action === 'instructions') {
    const engagement = input.engagementId ? String(input.engagementId) : null;
    if (
      engagement &&
      !(
        await sql('SELECT id FROM engagements WHERE id=$1 AND organisation_id=$2', [
          engagement,
          org,
        ])
      ).length
    )
      throw new DomainError('Engagement not found.', 404);
    let connection = (
      await sql<AwsConnection>(
        "SELECT * FROM aws_connections WHERE organisation_id=$1 AND engagement_id IS NOT DISTINCT FROM $2 AND status!='revoked' ORDER BY created_at DESC LIMIT 1",
        [org, engagement],
      )
    )[0];
    if (!connection)
      connection = (
        await sql<AwsConnection>(
          'INSERT INTO aws_connections(id,organisation_id,engagement_id,external_id) VALUES($1,$2,$3,$4) RETURNING *',
          [randomUUID(), org, engagement, randomBytes(32).toString('hex')],
        )
      )[0];
    return { connection, templates: accessTemplates(connection.external_id) };
  }
  const connection = (
    await sql<AwsConnection>('SELECT * FROM aws_connections WHERE id=$1 AND organisation_id=$2', [
      id,
      org,
    ])
  )[0];
  if (!connection) throw new DomainError('AWS connection not found.', 404);
  if (action === 'revoke') {
    await sql("UPDATE aws_connections SET status='revoked',last_error=null WHERE id=$1", [id]);
    return {
      ok: true,
      note: 'HKGpipi has disabled this connection. Remove the role or its trust policy in your AWS account to revoke AWS authority.',
    };
  }
  if (connection.status === 'revoked')
    throw new DomainError('This connection is revoked. Create a new onboarding connection.', 409);
  if (action === 'verify') {
    const roleArn = String(input.roleArn ?? connection.role_arn ?? '');
    if (!/^arn:aws:iam::\d{12}:role\/[\w+=,.@\/-]+$/.test(roleArn))
      throw new DomainError('Enter the approved commercial AWS IAM role ARN.');
    connection.role_arn = roleArn;
    await sql("UPDATE aws_connections SET role_arn=$1,status='submitted' WHERE id=$2", [
      roleArn,
      id,
    ]);
    try {
      const result = await verifyConnection(connection);
      await transaction(async (c) => {
        await c.query(
          "UPDATE aws_connections SET status='verified',account_id=$1,last_checked_at=now(),last_error=null WHERE id=$2",
          [result.accountId, id],
        );
        await c.query(
          'INSERT INTO aws_checks(id,connection_id,success,detail) VALUES($1,$2,true,$3)',
          [randomUUID(), id, JSON.stringify(result)],
        );
        await c.query(
          "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id,detail) VALUES($1,$2,$3,'aws.verified',$4,$5)",
          [randomUUID(), org, access.user.id, id, JSON.stringify({ accountId: result.accountId })],
        );
      });
      return {
        connection: { ...connection, status: 'verified', account_id: result.accountId },
        result,
      };
    } catch (e) {
      await sql(
        "UPDATE aws_connections SET status='failed',last_checked_at=now(),last_error=$1 WHERE id=$2",
        [errorMessage(e), id],
      );
      await sql('INSERT INTO aws_checks(id,connection_id,success,detail) VALUES($1,$2,false,$3)', [
        randomUUID(),
        id,
        JSON.stringify({ error: errorMessage(e) }),
      ]);
      throw e;
    }
  }
  if (action === 'sync') {
    if (!enabled())
      throw new DomainError(
        'AWS integration is awaiting activation; no collection has started.',
        503,
      );
    if (connection.status !== 'verified')
      throw new DomainError(
        'Verify the authorised AWS connection before collecting evidence.',
        409,
      );
    const { enqueueJob } = await import('./jobs');
    await enqueueJob('aws-sync', { connectionId: id });
    await sql(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,entity_id) VALUES($1,$2,$3,'aws.collection_queued',$4)",
      [randomUUID(), org, access.user.id, id],
    );
    return {
      ok: true,
      queued: true,
      note: 'Read-only evidence collection queued. Review connection status for completion.',
    };
  }
  throw new DomainError('Unsupported AWS action.');
}
