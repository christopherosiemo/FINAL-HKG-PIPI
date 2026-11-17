-- A verified outcome cannot be invoiced twice under the same accepted agreement.
CREATE UNIQUE INDEX outcome_settlement_evidence_unique
ON records (organisation_id, (data->>'parentProposalId'), (data->>'verificationId'))
WHERE kind='proposal' AND status IN ('proposed','accepted')
  AND data->>'parentProposalId' IS NOT NULL;
