export const faq = [
  [
    'What does the £5,000 Savings Sprint include?',
    'A 14-day engagement to identify, validate and rank AWS savings opportunities. You receive a savings ledger, commitment and waste analysis, specific remediation recommendations, technical evidence and an implementation roadmap.',
  ],
  [
    'Will you change our AWS infrastructure during discovery?',
    'No. Discovery uses an engagement-specific, constrained read-only role. Implementation proceeds through separately agreed scope and your existing engineering approval and deployment controls.',
  ],
  [
    'Does the 14-day Sprint include implementation?',
    'The initial Sprint establishes what is worth changing and how. Implementation is a subsequent engagement: £15,000 fixed implementation or an agreed outcome-based alternative.',
  ],
  [
    'Are the two implementation prices combined?',
    'No. Fixed implementation and 25% of verified savings are alternative commercial models. The scope and applicable contractual basis are agreed before implementation.',
  ],
  [
    'What does 25% of verified savings mean?',
    'The fee is based on verified savings under the commercial and measurement basis agreed before implementation. Estimated savings do not establish a fee. The contract defines the relevant period, adjustments and payment conditions.',
  ],
  [
    'Does verification guarantee results in 30 days?',
    'No. A post-change observation period supports verification. Workload variation, billing availability and the agreed methodology affect timing. Thirty days does not guarantee that a complex estate will be fully remediated.',
  ],
  [
    'How are normalised savings calculated?',
    'We compare the agreed baseline with post-change billing evidence and document relevant adjustments, such as workload volume, unrelated changes, pricing and commitments. The agreed measurement basis governs annualisation and signoff.',
  ],
  [
    'Do we need to send AWS access keys?',
    'No. The onboarding flow provides cross-account role instructions with a unique external ID. Do not submit access keys, secret keys, passwords or customer production data through ordinary forms.',
  ],
  [
    'What happens after payment?',
    'You receive an order confirmation and secure account activation instructions. Your portal contains the onboarding checklist, engagement timeline, deliverables and savings ledger as the engagement progresses.',
  ],
  [
    'Can our engineering team retain deployment control?',
    'Yes. HKGpipi produces actionable engineering work and supports implementation. Your repositories, reviews, tests, approvals and deployment process remain authoritative.',
  ],
  [
    'What if we cannot grant AWS access immediately?',
    'Your onboarding can be saved and resumed. Access remains pending until the agreed configuration is validated. We do not present a submitted role as a verified connection.',
  ],
  [
    'Are the examples real customer results?',
    'No. Public interface demonstrations are prominently labelled illustrative. Customer portal financial results come from the actual engagement evidence and review process.',
  ],
] as const;
export const deliverables = [
  [
    'A ranked savings ledger',
    'Opportunities prioritised by monetary value, confidence and engineering risk, with responsible teams and resource context.',
  ],
  [
    'Commitment exposure analysis',
    'Savings Plans and other commitment exposure considered alongside usage, coverage and the proposed change.',
  ],
  [
    'Waste and architecture findings',
    'Idle resources, unused capacity and expensive architectural patterns investigated with supporting evidence.',
  ],
  [
    'Specific remediation',
    'A practical recommended action, relevant infrastructure-as-code location where identifiable, and implementation guidance.',
  ],
  [
    'An actionable roadmap',
    'A considered sequence of engineering work, review dependencies and risk, ready for scope discussion.',
  ],
  [
    'Technical and financial evidence',
    'The assumptions, source information and expected financial impact behind each validated finding.',
  ],
] as const;
export const pageTitles: Record<string, string> = {
  method: 'Our Method',
  'savings-sprint': '14-Day AWS Savings Sprint',
  implementation: 'Implementation Sprint',
  verification: 'Savings Verification',
  security: 'Security & AWS Access',
  pricing: 'Pricing & Engagement Options',
  contact: 'Contact',
  faq: 'Frequently Asked Questions',
  privacy: 'Privacy',
  terms: 'Terms & Checkout Policies',
  'checkout-policies': 'Checkout Policies',
};
