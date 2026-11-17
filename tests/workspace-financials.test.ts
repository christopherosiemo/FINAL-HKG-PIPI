import { describe, it, expect } from 'vitest';
import type { EntityRecord } from '../src/lib/contracts';
import {
  conservativeOpportunities,
  groupMoney,
  latestVerifications,
} from '../src/components/workspace-config';
function record(
  id: string,
  data: Record<string, unknown>,
  kind: EntityRecord['kind'] = 'opportunity',
  status = 'validated',
  updatedAt = '2026-10-01T00:00:00Z',
): EntityRecord {
  return {
    id,
    organisationId: 'company',
    engagementId: 'sprint',
    kind,
    title: id,
    status,
    version: 1,
    data,
    createdAt: updatedAt,
    updatedAt,
  };
}
describe('customer financial summaries preserve estimate and evidence boundaries', () => {
  it('counts alternative candidates for the same resource once, conservatively', () => {
    const rows = [
      record('size', {
        resourceId: 'db1',
        accountId: '1',
        service: 'RDS',
        monthlySaving: 200,
        currency: 'GBP',
      }),
      record('retire', {
        resourceId: 'db1',
        accountId: '1',
        service: 'RDS',
        monthlySaving: 300,
        currency: 'GBP',
      }),
      record('other', {
        resourceId: 'db2',
        accountId: '1',
        service: 'RDS',
        monthlySaving: 100,
        currency: 'GBP',
      }),
    ];
    expect(conservativeOpportunities(rows).map((r) => r.id)).toEqual(['retire', 'other']);
    expect(groupMoney(rows, 'monthlySaving')).toEqual(['£400']);
  });
  it('respects explicit mutually exclusive groups and excludes superseded findings', () => {
    const rows = [
      record('A', { overlapGroup: 'choice', monthlySaving: 100, currency: 'GBP' }),
      record('B', { overlapGroup: 'choice', monthlySaving: 150, currency: 'GBP' }),
      record('old', { monthlySaving: 900, currency: 'GBP' }, 'opportunity', 'superseded'),
      record('archived', { monthlySaving: 800, currency: 'GBP', archived: true }),
    ];
    expect(groupMoney(rows, 'monthlySaving')).toEqual(['£150']);
  });
  it('keeps financial currencies separate rather than adding unlike amounts', () => {
    const rows = [
      record('gbp', { resourceId: 'db', monthlySaving: 100, currency: 'GBP' }),
      record('usd', { resourceId: 'db', monthlySaving: 200, currency: 'USD' }),
    ];
    expect(groupMoney(rows, 'monthlySaving')).toEqual(['£100', 'US$200']);
  });
  it('uses only the latest published financial evidence per opportunity', () => {
    const opportunity = record('opp', { monthlySaving: 100, currency: 'GBP' });
    const previous = record(
      'old',
      { opportunityId: 'opp', annualisedSaving: 1000, currency: 'GBP' },
      'verification',
      'published',
      '2026-10-01T00:00:00Z',
    );
    const latest = record(
      'new',
      { opportunityId: 'opp', annualisedSaving: 2000, currency: 'GBP' },
      'verification',
      'published',
      '2026-11-01T00:00:00Z',
    );
    const draft = record(
      'draft',
      { opportunityId: 'opp', annualisedSaving: 9000, currency: 'GBP' },
      'verification',
      'draft',
      '2026-11-02T00:00:00Z',
    );
    expect(latestVerifications([opportunity, previous, latest, draft]).map((r) => r.id)).toEqual([
      'new',
    ]);
    expect(
      groupMoney(latestVerifications([opportunity, previous, latest, draft]), 'annualisedSaving'),
    ).toEqual(['£2,000']);
  });
});
