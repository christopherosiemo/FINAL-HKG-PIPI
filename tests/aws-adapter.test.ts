import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  allowWithout: false,
  networkError: false,
  account: '123456789012',
  billingDenied: false,
}));
vi.mock('../src/lib/access', () => ({ requireAccess: vi.fn() }));
vi.mock('@aws-sdk/client-sts', () => ({
  AssumeRoleCommand: class {
    kind = 'assume';
    constructor(public input: Record<string, unknown>) {}
  },
  GetCallerIdentityCommand: class {
    kind = 'identity';
  },
  STSClient: class {
    async send(command: { kind: string; input: Record<string, unknown> }) {
      if (command.kind === 'identity')
        return {
          Account: state.account,
          Arn: 'arn:aws:sts::123456789012:assumed-role/Discovery/session',
        };
      if (command.input.ExternalId !== 'unique-external-id' && !state.allowWithout) {
        throw Object.assign(new Error('Denied'), {
          name: state.networkError ? 'NetworkingError' : 'AccessDenied',
        });
      }
      return {
        Credentials: {
          AccessKeyId: 'offline-fixture-key',
          SecretAccessKey: 'offline-fixture-secret',
          SessionToken: 'offline-fixture-session',
          Expiration: new Date(Date.now() + 900000),
        },
      };
    }
  },
}));
vi.mock('@aws-sdk/client-cost-explorer', () => ({
  CostExplorerClient: class {
    async send() {
      if (state.billingDenied) throw new Error('Billing scope denied');
      return { ResultsByTime: [] };
    }
  },
  GetCostAndUsageCommand: class {},
  GetSavingsPlansCoverageCommand: class {},
  GetSavingsPlansUtilizationCommand: class {},
  GetReservationCoverageCommand: class {},
  GetReservationUtilizationCommand: class {},
}));
import { verifyConnection, collectPages, type AwsConnection } from '../src/lib/aws';
const original = process.env.AWS_INTEGRATION_ENABLED;
const connection: AwsConnection = {
  id: 'fixture-connection',
  organisation_id: 'fixture-org',
  engagement_id: 'fixture-engagement',
  external_id: 'unique-external-id',
  role_arn: 'arn:aws:iam::123456789012:role/Discovery',
  account_id: null,
  status: 'submitted',
};
beforeEach(() => {
  process.env.AWS_INTEGRATION_ENABLED = 'true';
  Object.assign(state, {
    allowWithout: false,
    networkError: false,
    account: '123456789012',
    billingDenied: false,
  });
});
afterAll(() => {
  if (original === undefined) delete process.env.AWS_INTEGRATION_ENABLED;
  else process.env.AWS_INTEGRATION_ENABLED = original;
});
describe('real AWS adapter request/security contract using offline SDK responses', () => {
  it('verifies account, external-ID protection and billing read before reporting connected', async () => {
    await expect(verifyConnection(connection)).resolves.toMatchObject({
      accountId: '123456789012',
      externalIdProtection: true,
      billingRead: true,
    });
  });
  it('rejects roles that can be assumed without the correct external ID', async () => {
    state.allowWithout = true;
    await expect(verifyConnection(connection)).rejects.toThrow('Unsafe trust');
  });
  it('does not interpret network failures as proof of access denial', async () => {
    state.networkError = true;
    await expect(verifyConnection(connection)).rejects.toThrow('Unable to verify');
  });
  it('rejects mismatching accounts and unavailable billing scope', async () => {
    state.account = '999999999999';
    await expect(verifyConnection(connection)).rejects.toThrow('does not match');
    state.account = '123456789012';
    state.billingDenied = true;
    await expect(verifyConnection(connection)).rejects.toThrow('Billing scope');
  });
  it('never claims a real connection when integration activation is absent', async () => {
    process.env.AWS_INTEGRATION_ENABLED = 'false';
    await expect(verifyConnection(connection)).rejects.toMatchObject({ status: 503 });
  });
  it('collects every page and rejects repeated provider pagination tokens', async () => {
    const calls: (string | undefined)[] = [];
    const items = await collectPages(async (token) => {
      calls.push(token);
      return token ? { items: [2] } : { items: [1], nextToken: 'next' };
    });
    expect(items).toEqual([1, 2]);
    expect(calls).toEqual([undefined, 'next']);
    await expect(collectPages(async () => ({ items: [1], nextToken: 'repeated' }))).rejects.toThrow(
      'incomplete',
    );
  });
});
