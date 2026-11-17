import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/access', () => ({ requireAccess: vi.fn() }));
import { validateEntity, verificationCalculation } from '../src/lib/domain';
import { inspectUpload } from '../src/lib/storage';
import { accessTemplates, discoveryActions } from '../src/lib/aws';
const basis = {
  baselineStart: '2026-08-01',
  baselineEnd: '2026-08-31',
  observationStart: '2026-09-01',
  observationEnd: '2026-10-01',
  baselineCost: 6000,
  observedCost: 4200,
  currency: 'GBP',
  measurementBasis: 'Agreed daily normalisation × 365',
  agreementEvidence: 'Signed engagement scope reference 1',
  evidence: 'AWS AmortizedCost daily export',
  adjustments: [{ description: 'Workload-volume adjustment', amount: 200 }],
};
describe('financial verification invariants', () => {
  it('normalises unequal windows and preserves adjustment evidence', () => {
    const result = verificationCalculation(basis);
    expect(result.normalisedSaving).toBe(2000);
    expect(result.annualisedSaving).toBeCloseTo(24333.33333333);
    expect(result.observationDays).toBe(30);
  });
  it('does not manufacture positive savings when observed cost increases', () => {
    expect(
      verificationCalculation({ ...basis, observedCost: 7000, adjustments: [] }).normalisedSaving,
    ).toBe(-1000);
  });
  it('rejects invalid windows, invalid money and unlabelled adjustments', () => {
    expect(() => verificationCalculation({ ...basis, observationEnd: '2026-08-01' })).toThrow();
    expect(() => verificationCalculation({ ...basis, baselineCost: 'not-money' })).toThrow();
    expect(() => verificationCalculation({ ...basis, adjustments: [{ amount: 5 }] })).toThrow(
      'description',
    );
  });
  it('requires actual evidence and agreed measurement basis for signoff', () => {
    expect(() => validateEntity('verification', { ...basis, evidence: '' }, 'reviewed')).toThrow(
      'evidence',
    );
    expect(() =>
      validateEntity('verification', { ...basis, agreementEvidence: '' }, 'reviewed'),
    ).toThrow('agreement');
  });
  it('requires the default 30-day period, and supports explicitly agreed periods', () => {
    expect(() =>
      validateEntity('verification', { ...basis, observationEnd: '2026-09-15' }, 'reviewed'),
    ).toThrow('30');
    expect(() =>
      validateEntity(
        'verification',
        { ...basis, observationEnd: '2026-09-15', minimumObservationDays: 14 },
        'reviewed',
      ),
    ).not.toThrow();
  });
  it('enforces real offer prices and outcome terms', () => {
    expect(() =>
      validateEntity('proposal', { offer: 'implementation', amount: 1400000 }, 'draft'),
    ).toThrow('£15,000');
    expect(() =>
      validateEntity(
        'proposal',
        { offer: 'outcome', scope: 'Agreed remediation', termsVersion: 'v1' },
        'proposed',
      ),
    ).toThrow('measurement');
  });
});
describe('discovery trust and secure document policy', () => {
  it('uses a specific principal and unique external-ID condition without write permissions', () => {
    const template = accessTemplates(
      'customer-unique-external-id',
      'arn:aws:iam::123456789012:role/HKGDiscovery',
    );
    expect(template.ready).toBe(true);
    expect(template.trust.Statement[0].Condition.StringEquals['sts:ExternalId']).toBe(
      'customer-unique-external-id',
    );
    expect(
      discoveryActions.every(
        (action) => !/:Put|:Delete|:Create|:Update|:Modify|:Start|:Stop/.test(action),
      ),
    ).toBe(true);
    expect(template.cloudformation).toContain('AWS::IAM::Role');
  });
  it('makes unconfigured principal instructions explicitly unusable', () => {
    expect(accessTemplates('id', '').ready).toBe(false);
    expect(accessTemplates('id', '').notice).toContain('Do not deploy');
  });
  it('rejects executable uploads, disguised MIME and exposed credentials', () => {
    expect(() =>
      inspectUpload('run.exe', 'application/octet-stream', Buffer.from('MZ test')),
    ).toThrow();
    expect(() => inspectUpload('file.png', 'image/png', Buffer.from('not-an-image'))).toThrow();
    expect(() =>
      inspectUpload(
        'evidence.txt',
        'text/plain',
        Buffer.from('aws_secret_access_key=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      ),
    ).toThrow('credentials');
  });
  it('accepts safe plain evidence and checks JSON content', () => {
    expect(inspectUpload('evidence.csv', 'text/csv', Buffer.from('service,cost\nEC2,100'))).toBe(
      'text/csv',
    );
    expect(() => inspectUpload('bad.json', 'application/json', Buffer.from('{bad'))).toThrow(
      'invalid',
    );
  });
});
