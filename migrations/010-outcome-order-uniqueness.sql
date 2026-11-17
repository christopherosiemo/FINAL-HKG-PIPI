-- Commercial history survives proposal edits/archival. Protect the immutable
-- order snapshot as well as the currently active proposal record.
CREATE UNIQUE INDEX outcome_order_evidence_unique
ON orders (
  organisation_id,
  (legal_snapshot #>> '{proposalSnapshot,parentProposalId}'),
  (legal_snapshot #>> '{proposalSnapshot,verificationId}')
)
WHERE offer='outcome'
  AND status IN ('pending','paid','partial_refunded','disputed','refunded');
