import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  GitPullRequest,
  ArrowUpRight,
  LockKeyhole,
} from 'lucide-react';
export const steps = [
  ['Find', 'Locate economically meaningful AWS waste.'],
  ['Validate', 'Test the evidence, confidence and engineering risk.'],
  ['Assign', 'Connect the finding to an accountable owner.'],
  ['Change', 'Prepare the remediation, patch or pull request.'],
  ['Approve', 'Follow your engineering review and controls.'],
  ['Deploy', 'Your team controls production deployment.'],
  ['Verify', 'Reconcile the change against billing evidence.'],
];
export function Action({
  children = 'Start a Savings Sprint',
  href = '/start',
  secondary = false,
}: {
  children?: React.ReactNode;
  href?: string;
  secondary?: boolean;
}) {
  return (
    <Link href={href} className={secondary ? 'button button-secondary' : 'button'}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function PageHero({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <div className="eyebrow">{label}</div>
        <h1>{title}</h1>
        <div className="page-lead">{children}</div>
      </div>
    </section>
  );
}
const examples = [
  ['RDS rightsizing', 'payments-api', 'Platform', '£4,820', 'High', 'Validated'],
  ['NAT architecture', 'shared-network', 'Core infrastructure', '£2,140', 'Medium', 'Change ready'],
  [
    'Idle EC2 capacity',
    'analytics-sandbox',
    'Data engineering',
    '£980',
    'High',
    'Awaiting approval',
  ],
  ['Unattached EBS', 'ci-builders', 'Developer experience', '£360', 'High', 'Under review'],
];
export function Ledger({ compact = false }: { compact?: boolean }) {
  return (
    <div className={'ledger-visual ' + (compact ? 'compact' : '')}>
      <div className="ledger-heading">
        <div>
          <span className="eyebrow">ILLUSTRATIVE ENGAGEMENT</span>
          <h2>The savings ledger</h2>
        </div>
        <span className="live-dot">Evidence, then action</span>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Illustrative opportunities, not customer results</caption>
          <thead>
            <tr>
              <th>Opportunity / service</th>
              <th>Owner</th>
              <th>Expected / month</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {examples.map(([name, ref, owner, amount, , status], i) => (
              <tr key={name}>
                <td>
                  <span className="service-icon">{['RDS', 'VPC', 'EC2', 'EBS'][i]}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>{ref}</small>
                  </div>
                </td>
                <td>{owner}</td>
                <td className="mono">
                  {amount}
                  <span className="estimate-marker"> est.</span>
                </td>
                <td>
                  <span className={'badge ' + (i === 0 ? 'blue' : '')}>{status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ledger-foot">
        <span>
          <span className="blue-dot" />
          Ranked by value, confidence and engineering risk
        </span>
        <span className="mono">01—04</span>
      </div>
    </div>
  );
}
export function MethodStrip() {
  return (
    <div className="method-strip">
      {steps.map(([name, description], i) => (
        <div key={name}>
          <span className="mono">0{i + 1}</span>
          <h3>{name}</h3>
          <p>{description}</p>
          {i === 4 ? <small className="control-note">Customer controls</small> : null}
        </div>
      ))}
    </div>
  );
}
export function OfferCards() {
  return (
    <div className="offer-grid">
      <article className="offer primary-offer">
        <div className="eyebrow">01 / START HERE</div>
        <h3>
          14-Day AWS
          <br />
          Savings Sprint
        </h3>
        <div className="offer-price">
          £5,000 <small>upfront</small>
        </div>
        <p>A bounded, evidence-led engagement to establish what is worth changing.</p>
        <ul>
          {[
            'Ranked savings ledger',
            'Commitment & waste analysis',
            'Specific remediation roadmap',
            'Technical and financial evidence',
          ].map((x) => (
            <li key={x}>
              <Check size={15} />
              {x}
            </li>
          ))}
        </ul>
        <Action>Start your Sprint</Action>
      </article>
      <article className="offer">
        <div className="eyebrow">02 / FIXED IMPLEMENTATION</div>
        <h3>
          Implementation
          <br />
          Sprint
        </h3>
        <div className="offer-price">£15,000</div>
        <p>
          Turn agreed recommendations into engineering work, through your approval and deployment
          processes.
        </p>
        <ul>
          {[
            'Agreed scope before work begins',
            'PRs, tickets & configuration changes',
            'Customer-controlled deployment',
            'Baseline & verification support',
          ].map((x) => (
            <li key={x}>
              <Check size={15} />
              {x}
            </li>
          ))}
        </ul>
        <Action href="/implementation" secondary>
          Explore implementation
        </Action>
      </article>
      <article className="offer">
        <div className="eyebrow">03 / ALTERNATIVE MODEL</div>
        <h3>
          Outcome-based
          <br />
          implementation
        </h3>
        <div className="offer-price">
          25% <small>of verified savings</small>
        </div>
        <p>
          An alternative to fixed implementation, based on the commercial and verification basis
          agreed with you.
        </p>
        <ul>
          {[
            'Agreed measurement basis',
            'Evidence-backed verification',
            'Estimates never treated as outcomes',
            'No automatic outcome charges',
          ].map((x) => (
            <li key={x}>
              <Check size={15} />
              {x}
            </li>
          ))}
        </ul>
        <Action href="/contact" secondary>
          Discuss the model
        </Action>
      </article>
    </div>
  );
}
export function SecurityBoundary() {
  return (
    <div className="boundary">
      <div>
        <LockKeyhole size={24} />
        <span className="eyebrow">DISCOVERY ACCESS</span>
        <h3>
          Read what is needed.
          <br />
          Change nothing.
        </h3>
        <p>
          Engagement-specific, tightly constrained read-only AWS access. No secret keys submitted
          through forms.
        </p>
      </div>
      <div>
        <GitPullRequest size={24} />
        <span className="eyebrow">IMPLEMENTATION AUTHORITY</span>
        <h3>
          Your infrastructure.
          <br />
          Your controls.
        </h3>
        <p>Your repositories, reviews, approvals and deployment process remain authoritative.</p>
      </div>
    </div>
  );
}
export function VerificationVisual() {
  return (
    <div className="verification-visual">
      <div className="eyebrow">THREE DIFFERENT MEASURES</div>
      <div className="measure-row">
        <span>01</span>
        <div>
          <h3>Expected saving</h3>
          <p>A validated estimate before deployment.</p>
        </div>
        <span className="badge">Estimated</span>
      </div>
      <div className="measure-row">
        <span>02</span>
        <div>
          <h3>Actual normalised saving</h3>
          <p>Post-change observation, with documented adjustments.</p>
        </div>
        <span className="badge">Observed</span>
      </div>
      <div className="measure-row">
        <span>03</span>
        <div>
          <h3>Verified annualised saving</h3>
          <p>Reviewed evidence, annualised on the agreed basis.</p>
        </div>
        <span className="badge blue">Verified</span>
      </div>
      <p className="fine-print">
        Verification follows the agreed baseline, observation period and relevant workload
        adjustments. No customer outcome is implied by this diagram.
      </p>
    </div>
  );
}
export function HomePage() {
  return (
    <main id="main-content">
      <section className="home-hero">
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="wrap hero-content">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="blue-dot" />
              AWS CLOUD MARGIN RECOVERY
            </div>
            <h1>
              Find the waste.
              <br />
              Make the change.
              <br />
              <em>Recover the margin.</em>
            </h1>
            <p>
              We turn AWS savings opportunities into approved engineering changes — and verify the
              reduction against your bill.
            </p>
            <div className="hero-actions">
              <Action />
              <Link href="/method" className="text-link">
                Explore our method <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-contract">
              <span>14 days</span>
              <i />
              <span>£5,000 upfront</span>
              <i />
              <span>Read-only discovery</span>
            </div>
          </div>
          <div className="hero-evidence">
            <div className="evidence-topline">
              <span>HKG / ENGINEERING → FINANCE</span>
              <ShieldCheck size={17} />
            </div>
            <Ledger compact />
            <div className="hero-flow">
              <span>Opportunity</span>
              <ArrowRight size={14} />
              <span>Approved change</span>
              <ArrowRight size={14} />
              <strong>Verified outcome</strong>
            </div>
            <div className="hero-caption">
              <span>AN ACCOUNTABLE PATH TO SAVINGS</span>
              <span>NOT ANOTHER REPORT.</span>
            </div>
          </div>
        </div>
        <div className="wrap hero-bottom">
          <span>For engineering, finance and FinOps leaders.</span>
          <span>Evidence-led. Engineering-owned. Financially accountable.</span>
        </div>
      </section>
      <section className="section intro-section">
        <div className="wrap split">
          <div>
            <div className="eyebrow">THE GAP WE CLOSE</div>
            <h2>
              Identified value
              <br />
              isn’t realised value.
            </h2>
          </div>
          <div className="large-copy">
            <p>
              A recommendation does not change your AWS bill. An approved, deployed engineering
              change can.
            </p>
            <p className="muted">
              HKGpipi connects the finding to the owner, the remediation to your delivery process,
              and the outcome to financial evidence.
            </p>
            <Link href="/method" className="text-link">
              One accountable method <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section method-section">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">01 / THE OPERATING METHOD</div>
              <h2>
                From opportunity
                <br />
                to the AWS bill.
              </h2>
            </div>
            <p>
              Seven connected steps.
              <br />
              Your engineering controls throughout.
            </p>
          </div>
          <MethodStrip />
        </div>
      </section>
      <section className="section">
        <div className="wrap evidence-layout">
          <div>
            <div className="eyebrow">02 / ENGINEERING EVIDENCE</div>
            <h2>
              Specific enough
              <br />
              to act on.
            </h2>
            <p className="section-description">
              Know what to change, why it matters, who owns it and what risk it carries.
            </p>
            <ul className="feature-list">
              <li>
                <Check />
                Resource and service context
              </li>
              <li>
                <Check />
                Expected impact and confidence
              </li>
              <li>
                <Check />
                Remediation and IaC references
              </li>
              <li>
                <Check />
                Approval and deployment evidence
              </li>
            </ul>
            <Action href="/savings-sprint" secondary>
              Inside the Savings Sprint
            </Action>
          </div>
          <div className="code-evidence">
            <div className="code-title">
              <GitPullRequest size={18} />
              <span>Remediation evidence</span>
              <span className="badge">Illustrative</span>
            </div>
            <div className="code-meta">
              <div>
                <small>OPPORTUNITY</small>
                <strong>Right-size the payments database</strong>
              </div>
              <div>
                <small>OWNER</small>
                <strong>Platform engineering</strong>
              </div>
            </div>
            <div className="code-file">infra / production / database.tf</div>
            <pre>
              <code>
                {'resource "aws_db_instance" "payments" {\n'}
                <span className="code-remove">{'− instance_class = "db.r6g.4xlarge"\n'}</span>
                <span className="code-add">{'+ instance_class = "db.r6g.2xlarge"\n'}</span>
                {'  # Reviewed against utilisation evidence\n}'}
              </code>
            </pre>
            <div className="code-bottom">
              <ShieldCheck size={16} />
              Review → test → approve → customer deploys
            </div>
          </div>
        </div>
      </section>
      <section className="section verification-section">
        <div className="wrap split">
          <div>
            <div className="eyebrow">03 / FINANCIAL ACCOUNTABILITY</div>
            <h2>
              Projected is a start.
              <br />
              Verified is the result.
            </h2>
            <p className="section-description">
              After deployment, we compare billing evidence with the agreed baseline and account for
              relevant changes in workload, pricing and commitments.
            </p>
            <Action href="/verification" secondary>
              How verification works
            </Action>
          </div>
          <VerificationVisual />
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">04 / SECURITY BY BOUNDARY</div>
              <h2>
                Built around
                <br />
                your authority.
              </h2>
            </div>
            <Link href="/security" className="text-link">
              Review the access model <ArrowRight size={17} />
            </Link>
          </div>
          <SecurityBoundary />
        </div>
      </section>
      <section className="section pricing-section">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <div className="eyebrow">05 / ENGAGEMENT OPTIONS</div>
              <h2>
                A clear first step.
                <br />A practical path forward.
              </h2>
            </div>
            <p>
              Start with discovery.
              <br />
              Choose implementation after scope is agreed.
            </p>
          </div>
          <OfferCards />
          <p className="fine-print">
            Fixed and outcome-based implementation are alternatives. Applicable taxes and approved
            contractual conditions are shown before payment.
          </p>
        </div>
      </section>
    </main>
  );
}
