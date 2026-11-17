import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ArrowRight } from 'lucide-react';
import {
  Action,
  PageHero,
  MethodStrip,
  Ledger,
  OfferCards,
  SecurityBoundary,
  VerificationVisual,
  steps,
} from '@/components/marketing';
import { ContactForm } from '@/components/contact-form';
import { faq, deliverables, pageTitles } from '@/lib/content';
export function generateStaticParams() {
  return Object.keys(pageTitles).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: pageTitles[slug] || 'Page not found', alternates: { canonical: `/${slug}` } };
}
function Body({ children }: { children: React.ReactNode }) {
  return (
    <section className="content-section">
      <div className="wrap">{children}</div>
    </section>
  );
}
export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!pageTitles[slug]) notFound();
  // Approved document URLs are injected at deployment, after the image is built.
  if (['privacy', 'terms', 'checkout-policies'].includes(slug)) await connection();
  return (
    <main id="main-content">
      {slug === 'method' ? (
        <>
          <PageHero label="THE HKGpipi METHOD" title="One accountable path. Seven connected steps.">
            <p>
              Find the opportunity. Produce the approved engineering change. Verify the resulting
              reduction against your AWS bill.
            </p>
          </PageHero>
          <section className="section method-section">
            <div className="wrap">
              <MethodStrip />
            </div>
          </section>
          <Body>
            <div className="editorial-grid">
              <div>
                <div className="eyebrow">AN ENGINEERING WORKFLOW</div>
                <h2>
                  Evidence moves
                  <br />
                  with the work.
                </h2>
              </div>
              <div className="deliverable-list">
                {steps.map(([title, desc], i) => (
                  <div className="deliverable-row" key={title}>
                    <span className="mono">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>
                      {desc}{' '}
                      {
                        [
                          'Findings start as opportunities awaiting investigation.',
                          'An engineer reviews usage, expected impact, confidence and risk.',
                          'Ownership links the resource, service and engineering team.',
                          'Remediation includes the technical evidence and implementation context.',
                          'Approval is tied to the specific change revision.',
                          'Deployment evidence records the customer-authorised change.',
                          'Baseline, adjustments and post-change evidence support financial review.',
                        ][i]
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Body>
          <Body>
            <SecurityBoundary />
          </Body>
        </>
      ) : null}
      {slug === 'savings-sprint' ? (
        <>
          <PageHero
            label="14-DAY AWS SAVINGS SPRINT / £5,000 UPFRONT"
            title="Know what is worth changing."
          >
            <p>
              A focused, engineering-led engagement to find, validate and prioritise AWS
              cost-reduction opportunities — with the evidence to take the next step.
            </p>
            <Action>Start your Savings Sprint</Action>
          </PageHero>
          <Body>
            <div className="editorial-grid">
              <div>
                <div className="eyebrow">WHAT YOU RECEIVE</div>
                <h2>
                  A tangible
                  <br />
                  engineering brief.
                </h2>
                <p className="section-description">
                  A ranked ledger and practical roadmap, grounded in your AWS estate.
                </p>
              </div>
              <div className="deliverable-list">
                {deliverables.map(([title, desc], i) => (
                  <div className="deliverable-row" key={title}>
                    <span className="mono">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Body>
          <section className="section verification-section">
            <div className="wrap">
              <Ledger />
              <p className="fine-print">
                Illustrative interface only. Actual findings depend on the evidence available in
                your engagement.
              </p>
            </div>
          </section>
          <Body>
            <div className="split">
              <div>
                <h2>
                  A bounded first step.
                  <br />A useful next decision.
                </h2>
                <p className="section-description">
                  The Sprint is discovery and planning. It does not independently deploy changes or
                  guarantee a particular saving.
                </p>
              </div>
              <div className="prose">
                <h3>How the engagement begins</h3>
                <ol>
                  <li>Review the scope, price and approved terms.</li>
                  <li>Complete secure checkout and activate your account.</li>
                  <li>Confirm engagement contacts, AWS scope and access.</li>
                  <li>Follow progress and published deliverables in your portal.</li>
                </ol>
                <div className="callout">
                  Implementation follows separately agreed scope. Choose £15,000 fixed
                  implementation or discuss the outcome-based alternative.
                </div>
                <Action />
              </div>
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'implementation' ? (
        <>
          <PageHero
            label="IMPLEMENTATION ENGAGEMENTS"
            title="The engineering work behind the saving."
          >
            <p>
              Turn agreed opportunities into pull requests, tickets, infrastructure configuration
              changes and customer-approved remediation.
            </p>
          </PageHero>
          <Body>
            <div className="split">
              <div>
                <div className="eyebrow">YOUR DELIVERY PROCESS</div>
                <h2>
                  Ready for your
                  <br />
                  engineering team.
                </h2>
                <p className="section-description">
                  We work alongside your team through review, testing, CI/CD and deployment.
                  Production authority remains with you.
                </p>
                <Action href="/contact">Discuss implementation</Action>
              </div>
              <div className="prose">
                <h3>From validated finding to deployed change</h3>
                <ul>
                  <li>Agree the resources, risks, responsibilities and scope.</li>
                  <li>Prepare technical changes and supporting evidence.</li>
                  <li>Record reviews and approval against the change revision.</li>
                  <li>Follow your existing testing and deployment controls.</li>
                  <li>Capture deployment evidence and establish the verification baseline.</li>
                </ul>
                <div className="callout">
                  A changed remediation requires renewed approval. Discovery permissions cannot
                  execute infrastructure changes.
                </div>
              </div>
            </div>
          </Body>
          <section className="section pricing-section">
            <div className="wrap">
              <OfferCards />
              <p className="fine-print">
                Fixed and outcome-based implementation are alternative models. Each requires agreed
                scope and applicable terms before work or payment.
              </p>
            </div>
          </section>
        </>
      ) : null}
      {slug === 'verification' ? (
        <>
          <PageHero label="SAVINGS VERIFICATION" title="A reduction you can reconcile.">
            <p>
              Expected savings describe potential. Verified savings require deployed changes,
              billing evidence and an agreed measurement basis.
            </p>
          </PageHero>
          <Body>
            <div className="split">
              <div>
                <h2>
                  Three measures.
                  <br />
                  Three clear meanings.
                </h2>
                <p className="section-description">
                  The portal keeps estimates, observed results and reviewed outcomes separate, so an
                  opportunity cannot silently become a financial result.
                </p>
              </div>
              <VerificationVisual />
            </div>
          </Body>
          <section className="section verification-section">
            <div className="wrap editorial-grid">
              <div>
                <div className="eyebrow">THE MEASUREMENT RECORD</div>
                <h2>
                  Show the basis.
                  <br />
                  Explain the change.
                </h2>
              </div>
              <div className="prose">
                <h3>Every verification records</h3>
                <ul>
                  <li>The agreed scope, metric, currency and baseline period.</li>
                  <li>The deployed remediation and post-change observation window.</li>
                  <li>Source billing evidence and its completeness.</li>
                  <li>Relevant workload, pricing, commitment and unrelated-change adjustments.</li>
                  <li>The calculation revision, reviewer and signoff.</li>
                </ul>
                <h3>The 30-day observation view</h3>
                <p>
                  Post-change billing is observed for the agreed verification period, commonly
                  around 30 days. Billing availability and relevant workload variation may require
                  further evidence. This does not promise universal remediation within 30 days.
                </p>
                <div className="callout">
                  Annualisation and any outcome-based fee follow the specific agreed contractual
                  basis. Missing evidence remains pending.
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
      {slug === 'security' ? (
        <>
          <PageHero
            label="SECURITY & AWS ACCESS"
            title="Read-only discovery. Customer-controlled change."
          >
            <p>
              Access is scoped to the engagement. Your engineering reviews, approvals and deployment
              controls remain authoritative.
            </p>
          </PageHero>
          <Body>
            <SecurityBoundary />
          </Body>
          <Body>
            <div className="editorial-grid">
              <div>
                <div className="eyebrow">A CONTROLLED ONBOARDING</div>
                <h2>
                  Explicit scope.
                  <br />
                  Visible boundaries.
                </h2>
              </div>
              <div className="prose">
                <h3>Cross-account role onboarding</h3>
                <p>
                  Your portal provides engagement-specific instructions for a constrained AWS role
                  with a unique external ID. The exact policy, accounts, services, data categories
                  and duration are reviewed before access is granted.
                </p>
                <ul>
                  <li>No ordinary form asks for AWS access keys or secret keys.</li>
                  <li>No administrator role is required for discovery.</li>
                  <li>Role identity and required billing permissions are checked separately.</li>
                  <li>
                    Submitted, pending, verified, failed and revoked connections remain
                    distinguishable.
                  </li>
                  <li>Customers can revoke discovery access in their AWS account.</li>
                </ul>
                <h3>Implementation follows your controls</h3>
                <p>
                  Technical recommendations and remediation move through the customer’s
                  repositories, review, testing and deployment processes. A portal status is a
                  record of evidence, not proof that HKGpipi independently accessed or changed
                  infrastructure.
                </p>
                <h3>Discuss your security requirements</h3>
                <p>
                  Contact us to agree the engagement’s access scope and handling requirements.
                  Security certifications, residency commitments and contractual assurances are
                  stated only when approved and applicable.
                </p>
                <Action href="/contact" secondary>
                  Contact HKGpipi
                </Action>
              </div>
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'pricing' ? (
        <>
          <PageHero
            label="PRICING & ENGAGEMENT OPTIONS"
            title="A clear first step. Two ways to implement."
          >
            <p>
              Start with the £5,000 Savings Sprint. Once the work is defined, choose fixed
              implementation or an agreed verified-savings model.
            </p>
          </PageHero>
          <section className="section pricing-section">
            <div className="wrap">
              <OfferCards />
              <p className="fine-print">
                Applicable tax treatment and approved terms are presented before checkout.
                Implementation options are alternatives, not combined standard charges.
              </p>
            </div>
          </section>
          <Body>
            <div className="split">
              <h2>
                Agree the basis
                <br />
                before the work.
              </h2>
              <div className="prose">
                <p>
                  The outcome-based option uses a verification basis agreed before implementation.
                  Expected savings are estimates. Verified savings are measured against the agreed
                  baseline after deployed changes.
                </p>
                <p>
                  The contractual measurement period, adjustments, annualisation and invoicing
                  conditions must be agreed before this option becomes payable.
                </p>
                <Link href="/verification" className="text-link">
                  Read the verification method <ArrowRight size={17} />
                </Link>
              </div>
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'faq' ? (
        <>
          <PageHero label="FREQUENTLY ASKED QUESTIONS" title="The practical details.">
            <p>Clear answers about scope, security, implementation and financial verification.</p>
          </PageHero>
          <Body>
            <div className="faq-list">
              {faq.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'contact' ? (
        <>
          <PageHero label="CONTACT HKGpipi" title="Let’s talk about your AWS estate.">
            <p>Discuss an engagement, implementation scope or security requirement with HKGpipi.</p>
          </PageHero>
          <Body>
            <div className="contact-grid">
              <div className="contact-details">
                <div className="eyebrow">A DIRECT CONVERSATION</div>
                <h2>
                  Engineering context.
                  <br />
                  Commercial clarity.
                </h2>
                <a href="mailto:enquiries@hkgpipi.com">enquiries@hkgpipi.com</a>
                <p>
                  Tell us about the estate, the work you want to achieve and any access or delivery
                  constraints.
                </p>
                <p>Ready to begin the 14-Day Savings Sprint?</p>
                <Action>Start your Savings Sprint</Action>
              </div>
              <ContactForm />
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'privacy' ? (
        <>
          <PageHero label="PRIVACY INFORMATION" title="Your information. A clear purpose.">
            <p>Information about enquiries, accounts and engagement data.</p>
          </PageHero>
          <Body>
            <div className="prose">
              <h2>HKGpipi privacy contact</h2>
              <p>
                For privacy enquiries, contact{' '}
                <a href="mailto:privacy@hkgpipi.com">privacy@hkgpipi.com</a>. HKGpipi’s currently
                published business address is 14 Whitworth Rd, Woolwich, London, SE18 3QB.
              </p>
              <h2>Information used by this service</h2>
              <p>
                The application handles contact details, organisation membership, orders and payment
                references, onboarding information, engagement evidence, support messages and
                security/audit records. Payment card details are handled by the configured payment
                provider. Ordinary forms must not contain passwords, AWS access keys or secrets.
              </p>
              <h2>Engagement information</h2>
              <p>
                Customer technical and billing information is used for the agreed engagement. Access
                scope, handling instructions, retention, subprocessors and any
                international-transfer arrangements must be reflected in approved engagement and
                privacy documentation.
              </p>
              <h2>Cookies</h2>
              <p>
                Authentication and security functionality use necessary cookies. This application
                does not include advertising or nonessential analytics cookies by default.
              </p>
              {process.env.LEGAL_PRIVACY_URL ? (
                <p>
                  <a href={process.env.LEGAL_PRIVACY_URL}>Read the approved privacy notice</a>
                </p>
              ) : (
                <div className="callout">
                  The complete privacy notice for this replacement service is awaiting owner
                  approval. This information does not replace an approved legal notice. Live
                  commercial activation remains subject to the approved policies.
                </div>
              )}
            </div>
          </Body>
        </>
      ) : null}
      {slug === 'terms' || slug === 'checkout-policies' ? (
        <>
          <PageHero
            label="TERMS & CHECKOUT POLICIES"
            title="Agree the engagement before you begin."
          >
            <p>
              The applicable scope, commercial terms and measurement basis are presented before
              acceptance and payment.
            </p>
          </PageHero>
          <Body>
            <div className="prose">
              <h2>14-Day AWS Savings Sprint</h2>
              <p>
                The published engagement is £5,000 upfront. Discovery provides a ranked savings
                ledger and actionable implementation roadmap. Implementation is a separately scoped
                engagement.
              </p>
              <h2>Implementation options</h2>
              <p>
                £15,000 fixed implementation and 25% of verified savings are alternatives.
                Outcome-based work requires an agreed measurement and contractual basis before
                implementation. No estimate creates an automatic outcome-based charge.
              </p>
              <h2>Applicable policies</h2>
              <p>
                Approved terms must specify the seller’s legal identity, scope, tax treatment,
                commencement conditions, cancellation/refund policy and applicable data-handling
                arrangements. Acceptances are recorded against the exact document version.
              </p>
              {process.env.LEGAL_TERMS_URL && process.env.LEGAL_APPROVED === 'true' ? (
                <p>
                  <a href={process.env.LEGAL_TERMS_URL}>Read the approved service terms</a>
                </p>
              ) : (
                <div className="callout">
                  Service terms and checkout policies are awaiting owner approval. Live payment is
                  unavailable until approved terms and tax configuration are supplied. Local test
                  checkout uses explicitly labelled fixtures and creates no commercial engagement.
                </div>
              )}
              <h2>Local test configuration</h2>
              <p>
                Any checkout explicitly marked “test” exercises application workflows only. No money
                is collected, no service is purchased and no test acceptance establishes a contract.
              </p>
            </div>
          </Body>
        </>
      ) : null}
    </main>
  );
}
