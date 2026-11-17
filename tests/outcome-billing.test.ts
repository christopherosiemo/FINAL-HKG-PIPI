import { describe, it, expect } from 'vitest';
import { outcomeSettlement } from '../src/lib/outcome-billing';
const agreement = {
  id: 'agreement',
  version: 4,
  engagement_id: 'engagement',
  status: 'accepted',
  data: {
    offer: 'outcome',
    feeBasis: 'annualisedSaving',
    acceptedBy: 'customer-owner',
    acceptedAt: '2026-11-01',
    measurementBasis: 'Contractual annualised fee base',
  },
};
const verified = {
  id: 'verified',
  version: 3,
  engagement_id: 'engagement',
  status: 'published',
  data: {
    reviewedBy: 'reviewer',
    reviewedAt: '2026-11-10',
    currency: 'GBP',
    annualisedSaving: 21900,
    normalisedSaving: 1800,
  },
};
const request = {
  offer: 'outcome',
  parentProposalId: 'agreement',
  verificationId: 'verified',
  feeBasis: 'annualisedSaving',
  feeAgreementEvidence: 'Signed measurement and invoicing schedule',
};
const source =
  (parent = agreement, evidence = verified) =>
  async (_text: string, values: unknown[]) => [values[0] === 'agreement' ? parent : evidence];
describe('explicit verified outcome settlement', () => {
  it('calculates 25% only from the contractually selected verified metric', async () => {
    expect(await outcomeSettlement(request, 'org', 'invoice', source())).toMatchObject({
      amount: 547500,
      feeBase: 21900,
      percentage: 25,
      verificationRevision: 3,
      parentRevision: 4,
    });
  });
  it('refuses an original outcome agreement, unpublished evidence and missing contractual authority', async () => {
    await expect(
      outcomeSettlement({ offer: 'outcome' }, 'org', 'invoice', source()),
    ).rejects.toThrow('Select');
    await expect(
      outcomeSettlement(
        request,
        'org',
        'invoice',
        source(agreement, { ...verified, status: 'draft' }),
      ),
    ).rejects.toThrow('published');
    await expect(
      outcomeSettlement({ ...request, feeBasis: 'normalisedSaving' }, 'org', 'invoice', source()),
    ).rejects.toThrow('match');
  });
  it('does not convert currencies, bill negative savings or accept changed evidence', async () => {
    await expect(
      outcomeSettlement(
        request,
        'org',
        'invoice',
        source(agreement, { ...verified, engagement_id: 'another-engagement' }),
      ),
    ).rejects.toThrow('agreed engagement');
    await expect(
      outcomeSettlement(
        request,
        'org',
        'invoice',
        source(agreement, { ...verified, data: { ...verified.data, currency: 'USD' } }),
      ),
    ).rejects.toThrow('GBP');
    await expect(
      outcomeSettlement(
        request,
        'org',
        'invoice',
        source(agreement, { ...verified, data: { ...verified.data, annualisedSaving: -100 } }),
      ),
    ).rejects.toThrow('positive');
    await expect(
      outcomeSettlement({ ...request, verificationRevision: 2 }, 'org', 'invoice', source()),
    ).rejects.toThrow('changed');
  });
});
