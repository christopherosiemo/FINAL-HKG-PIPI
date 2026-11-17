import { sql } from './db';
type Data = Record<string, unknown>;
type Query = (text: string, values: unknown[]) => Promise<Data[]>;
export class OutcomeBillingError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
/** A settlement is a second, explicitly accepted proposal under an existing
 * outcome agreement. No fee is derived from estimated opportunity values. */
export async function outcomeSettlement(
  data: Data,
  organisationId: string,
  currentId?: string,
  query: Query = sql,
) {
  const parentId = String(data.parentProposalId || ''),
    verificationId = String(data.verificationId || '');
  if (!parentId || !verificationId || parentId === currentId)
    throw new OutcomeBillingError(
      'Select an accepted outcome agreement and published verification evidence.',
    );
  const [parent] = await query(
    "SELECT id,status,version,engagement_id,data FROM records WHERE id=$1 AND organisation_id=$2 AND kind='proposal'",
    [parentId, organisationId],
  );
  const contract = parent?.data as Data | undefined;
  if (
    !parent ||
    parent.status !== 'accepted' ||
    contract?.offer !== 'outcome' ||
    contract.parentProposalId ||
    !contract.acceptedBy ||
    !contract.acceptedAt ||
    !contract.measurementBasis
  )
    throw new OutcomeBillingError(
      'The underlying outcome agreement must be accepted by the customer owner.',
    );
  if (
    !['annualisedSaving', 'normalisedSaving'].includes(String(data.feeBasis)) ||
    data.feeBasis !== contract.feeBasis ||
    !data.feeAgreementEvidence
  )
    throw new OutcomeBillingError(
      'The fee base must match the accepted agreement, with explicit contractual evidence.',
    );
  const [verification] = await query(
    "SELECT id,status,version,engagement_id,data FROM records WHERE id=$1 AND organisation_id=$2 AND kind='verification'",
    [verificationId, organisationId],
  );
  const evidence = verification?.data as Data | undefined;
  if (parent.engagement_id && parent.engagement_id !== verification?.engagement_id)
    throw new OutcomeBillingError('The verification must belong to the agreed engagement.');
  if (
    !verification ||
    verification.status !== 'published' ||
    !evidence?.reviewedBy ||
    !evidence.reviewedAt ||
    String(evidence.currency).toUpperCase() !== 'GBP'
  )
    throw new OutcomeBillingError(
      'An outcome payment requires published, reviewed GBP verification evidence. No automatic currency conversion is performed.',
    );
  if (
    (data.verificationRevision &&
      Number(data.verificationRevision) !== Number(verification.version)) ||
    (data.parentRevision && Number(data.parentRevision) !== Number(parent.version))
  )
    throw new OutcomeBillingError(
      'Agreement or verification evidence changed. Reissue and accept the payment request.',
    );
  const feeBase = Number(evidence[String(data.feeBasis)]);
  const amount = Math.round(feeBase * 25); // major GBP × 100 pence × 25%.
  if (!Number.isFinite(feeBase) || feeBase <= 0 || !Number.isSafeInteger(amount) || amount < 1)
    throw new OutcomeBillingError(
      'The agreed verified fee base must support a positive, valid payment.',
    );
  return {
    amount,
    settlementAmount: amount,
    currency: 'GBP',
    percentage: 25,
    feeBase,
    feeBasis: data.feeBasis,
    parentProposalId: parentId,
    parentRevision: Number(parent.version),
    verificationId,
    verificationRevision: Number(verification.version),
  };
}
