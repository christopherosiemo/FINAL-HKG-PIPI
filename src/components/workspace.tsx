'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  GitPullRequest,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { EntityKind, EntityRecord, Workspace } from '@/lib/contracts';
import { authClient } from '@/lib/auth-client';
import { ActionModal, EditorModal, type Editor, type Mutation } from './workspace-forms';
import {
  date,
  entityLabels,
  exportRecords,
  fields,
  groupMoney,
  human,
  latestVerifications,
  money,
  stages,
  type Field,
} from './workspace-config';
import { demoWorkspace } from './workspace-demo';
import { Brand } from './site-chrome';
import './portal.css';

type Props = {
  admin?: boolean;
  view?: string[];
  demo?: boolean;
  inviteToken?: string;
  initialOrganisationId?: string;
};
type Action = {
  title: string;
  description: string;
  fields: Field[];
  submit: (data: Record<string, unknown>) => Promise<boolean>;
};
const navigation = [
  {
    section: 'Workspace',
    items: [
      { href: '', label: 'Overview', icon: LayoutDashboard },
      { href: 'engagements', label: 'Engagements', icon: BriefcaseBusiness },
      { href: 'onboarding', label: 'Onboarding & access', icon: ShieldCheck },
    ],
  },
  {
    section: 'Delivery',
    items: [
      { href: 'ledger', label: 'Savings ledger', icon: ListChecks },
      { href: 'implementation', label: 'Implementation', icon: GitPullRequest },
      { href: 'deliverables', label: 'Deliverables', icon: FileText },
      { href: 'verification', label: 'Savings verification', icon: TrendingUp },
      { href: 'proposals', label: 'Engagement proposals', icon: BriefcaseBusiness },
    ],
  },
  {
    section: 'Organisation',
    items: [
      { href: 'billing', label: 'Orders & billing', icon: CreditCard },
      { href: 'members', label: 'People & access', icon: Users },
      { href: 'support', label: 'Support', icon: LifeBuoy },
      { href: 'settings', label: 'Settings', icon: Settings2 },
    ],
  },
];
const titles: Record<string, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Your cloud margin, in focus',
    title: 'Engagement overview',
    description: 'A clear view of your engagement, engineering progress and financial evidence.',
  },
  engagements: {
    eyebrow: 'Your engagements',
    title: 'From discovery to verified savings',
    description: 'Follow each engagement through the work, the decisions and the evidence.',
  },
  onboarding: {
    eyebrow: 'Secure by design',
    title: 'Onboarding & AWS access',
    description:
      'Give your engagement the right context. Keep infrastructure control with your engineering team.',
  },
  ledger: {
    eyebrow: 'Find. Validate. Prioritise.',
    title: 'Your savings ledger',
    description:
      'Ranked opportunities with the financial context and engineering evidence to act confidently.',
  },
  implementation: {
    eyebrow: 'Engineering in control',
    title: 'Changes, approvals & deployment',
    description:
      'Review the exact remediation, approve a revision and track customer-controlled deployment.',
  },
  deliverables: {
    eyebrow: 'The work, documented',
    title: 'Engagement deliverables',
    description: 'Access the technical and financial evidence produced throughout your engagement.',
  },
  verification: {
    eyebrow: 'Evidence before outcomes',
    title: 'Savings verification',
    description:
      'Expected savings and financially verified results are measured and displayed separately.',
  },
  proposals: {
    eyebrow: 'The next agreed step',
    title: 'Engagement proposals',
    description: 'Review implementation scope, commercial terms and the agreed verification basis.',
  },
  billing: {
    eyebrow: 'Commercial records',
    title: 'Orders & billing',
    description: 'Your orders, payment status and receipts in one place.',
  },
  members: {
    eyebrow: 'People & permissions',
    title: 'Organisation access',
    description: 'Keep the right people involved and make approval responsibilities explicit.',
  },
  support: {
    eyebrow: 'Work with us',
    title: 'Engagement support',
    description:
      'Ask a question, share context and keep the conversation connected to your engagement.',
  },
  settings: {
    eyebrow: 'Your workspace',
    title: 'Organisation settings',
    description: 'Manage organisation details, notifications and account security.',
  },
  customers: {
    eyebrow: 'Operations',
    title: 'Customers & organisations',
    description: 'Manage customer organisations, engagement ownership and fulfilment.',
  },
  audit: {
    eyebrow: 'Accountability',
    title: 'Audit trail',
    description: 'A traceable record of commercial, account and engagement activity.',
  },
  enquiries: {
    eyebrow: 'New conversations',
    title: 'Public enquiries',
    description:
      'Respond to prospective customers and track the conversation through a persistent operational inbox.',
  },
  operations: {
    eyebrow: 'Service reliability',
    title: 'Operational queues',
    description: 'Review transactional email, secure file processing and background work.',
  },
  updates: {
    eyebrow: 'Customer communication',
    title: 'Engagement updates',
    description: 'Prepare and publish clear updates on the work, decisions and next steps.',
  },
};
const kindByView: Record<string, EntityKind> = {
  ledger: 'opportunity',
  onboarding: 'onboarding',
  implementation: 'remediation',
  deliverables: 'deliverable',
  verification: 'verification',
  proposals: 'proposal',
  support: 'support',
  updates: 'update',
};

export function Status({ value }: { value: string }) {
  const positive = [
    'paid',
    'approved',
    'verified',
    'published',
    'completed',
    'accepted',
    'active',
    'clean',
    'validated',
  ];
  const warning = [
    'pending',
    'submitted',
    'in_review',
    'proposed',
    'investigating',
    'awaiting_approval',
    'awaiting_customer',
    'quarantined',
  ];
  return (
    <span
      className={`ws-status ${positive.includes(value) ? 'ws-status-positive' : warning.includes(value) ? 'ws-status-warning' : ['rejected', 'failed', 'revoked', 'changes_requested'].includes(value) ? 'ws-status-danger' : ''}`}
    >
      <span />
      {human(value)}
    </span>
  );
}
function Empty({
  icon: Icon = Inbox,
  title,
  children,
  action,
}: {
  icon?: typeof Inbox;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ws-empty">
      <div className="ws-empty-icon">
        <Icon size={26} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Panel({
  title,
  aside,
  children,
  className = '',
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ws-panel ${className}`}>
      {title && (
        <div className="ws-panel-heading">
          <h2>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon = Activity,
}: {
  label: string;
  value: string | number;
  note: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="ws-metric">
      <div>
        <span>{label}</span>
        <Icon size={17} strokeWidth={1.5} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

async function fetchWorkspace(
  organisationId: string,
  signal?: AbortSignal,
): Promise<Workspace | null> {
  const response = await fetch(
    `/api/v1/workspace${organisationId ? '?organisationId=' + encodeURIComponent(organisationId) : ''}`,
    { cache: 'no-store', signal },
  );
  const data = await response.json();
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(data.error || 'Your workspace could not be loaded.');
  return data.workspace || data;
}

export default function WorkspaceApp({
  admin = false,
  view = [],
  demo = false,
  inviteToken,
  initialOrganisationId = '',
}: Props) {
  const router = useRouter();
  const current = view[0] || 'dashboard';
  const detailId = view[1];
  const prefix = admin ? '/admin' : '/portal';
  const [workspace, setWorkspace] = useState<Workspace | null>(
    demo ? { ...demoWorkspace, isStaff: admin } : null,
  );
  const [organisationId, setOrganisationId] = useState(initialOrganisationId);
  const [engagementId, setEngagementId] = useState('');
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [mobile, setMobile] = useState(false);
  const [pending, setPending] = useState(false);
  const href = useCallback(
    (path: string) => {
      const query = new URLSearchParams();
      if (demo) query.set('demo', '1');
      else if (organisationId || workspace?.organisation?.id)
        query.set('organisationId', organisationId || workspace!.organisation!.id);
      return `${prefix}${path ? '/' + path : ''}${query.size ? '?' + query.toString() : ''}`;
    },
    [prefix, demo, organisationId, workspace],
  );
  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const data = await fetchWorkspace(organisationId);
      if (data) setWorkspace(data);
      else router.replace('/login?next=' + encodeURIComponent(prefix));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [demo, organisationId, prefix, router]);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetchWorkspace(organisationId, controller.signal)
      .then((data) => {
        if (data) {
          setWorkspace(data);
          setError('');
        } else router.replace('/login?next=' + encodeURIComponent(prefix));
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [demo, organisationId, prefix, router]);
  const mutate: Mutation = useCallback(
    async (body) => {
      if (demo) {
        setError(
          'This is an illustrative, read-only workspace. No customer data or infrastructure is connected.',
        );
        return false;
      }
      setPending(true);
      setError('');
      setMessage('');
      try {
        const response = await fetch('/api/v1/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            organisationId: body.organisationId || workspace?.organisation?.id,
            engagementId: body.engagementId || engagementId || undefined,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The change could not be saved.');
        await load();
        setMessage('Your change has been saved.');
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The change could not be saved.');
        return false;
      } finally {
        setPending(false);
      }
    },
    [demo, workspace, engagementId, load],
  );
  const signedInUserId = workspace?.user.id;
  useEffect(() => {
    if (!inviteToken || demo || !signedInUserId) return;
    fetch('/api/v1/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acceptInvite', data: { token: inviteToken } }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The invitation could not be accepted.');
        window.location.replace('/portal');
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'The invitation could not be accepted.'),
      );
  }, [inviteToken, demo, signedInUserId]);
  const selectedEngagement =
    workspace?.engagements.find((e) => e.id === engagementId) || workspace?.engagements[0];
  const relevant = workspace
    ? workspace.records.filter((r) => !engagementId || r.engagementId === engagementId)
    : [];
  const meta = titles[current] || titles.dashboard;
  const canEdit = !!workspace?.isStaff && !demo;
  const canBilling =
    !!workspace &&
    (workspace.isStaff ||
      (workspace.capabilities.canBilling ??
        ['owner', 'billing'].includes(workspace.organisation?.role || '')));
  const canSubmitOnboarding =
    !!workspace &&
    (workspace.isStaff ||
      (workspace.capabilities.canSubmitOnboarding ??
        ['owner', 'approver', 'member'].includes(workspace.organisation?.role || '')));
  const canApprove =
    !!workspace &&
    !workspace.isStaff &&
    (workspace.organisation?.role === 'owner' || workspace.organisation?.role === 'approver') &&
    !demo;
  const create = (kind: EntityKind, initial?: Record<string, unknown>) =>
    setEditor({ kind, initial });
  const act = (
    record: EntityRecord,
    actionName: string,
    title: string,
    description: string,
    actionFields: Field[] = [],
  ) =>
    setAction({
      title,
      description,
      fields: actionFields,
      submit: (data) =>
        mutate({
          action: actionName,
          entity: record.kind,
          id: record.id,
          version: record.version,
          data:
            actionName === 'deploy'
              ? { ...data, customerControlled: true }
              : actionName === 'update'
                ? { ...data, status: record.kind === 'onboarding' ? 'submitted' : 'in_review' }
                : data,
        }),
    });
  const openRecord = (record: EntityRecord) => {
    const path =
      Object.entries(kindByView).find(([, kind]) => kind === record.kind)?.[0] || 'implementation';
    router.push(href(`${path}/${record.id}`));
  };
  const selectedRecord = detailId ? relevant.find((r) => r.id === detailId) : undefined;
  const addButton = (kind: EntityKind, label?: string) => (
    <button className="ws-button" onClick={() => create(kind)} disabled={demo}>
      <Plus size={16} />
      {label || `New ${entityLabels[kind].toLowerCase()}`}
    </button>
  );
  const exportButton = (records: EntityRecord[]) => (
    <button
      className="ws-button ws-button-secondary"
      onClick={() => exportRecords(records, `hkgpipi-${current}.csv`)}
      disabled={!records.length}
    >
      <Download size={15} />
      Export
    </button>
  );
  async function signOut() {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }
  const content = () => {
    if (!workspace) return null;
    if (admin && !workspace.isStaff)
      return (
        <Panel>
          <Empty icon={LockKeyhole} title="Administrator access required">
            This account does not have access to HKGpipi administration.{' '}
            <Link href="/portal">Open your customer workspace.</Link>
          </Empty>
        </Panel>
      );
    if (detailId) {
      if (!selectedRecord)
        return (
          <Panel>
            <Empty title="Record not available">
              This record may have moved, or your account may not have access to it.
              <Link href={href(current)}>Return to {meta.title.toLowerCase()}</Link>
            </Empty>
          </Panel>
        );
      return (
        <RecordDetail
          record={selectedRecord}
          workspace={workspace}
          canEdit={canEdit}
          canApprove={canApprove}
          demo={demo}
          href={href}
          onEdit={() => setEditor({ kind: selectedRecord.kind, record: selectedRecord })}
          onAction={act}
          onCreate={create}
          mutate={mutate}
        />
      );
    }
    if (current === 'dashboard')
      return (
        <Dashboard
          records={relevant}
          href={href}
          admin={admin}
          engagement={selectedEngagement}
          onCreateEngagement={() => setEditor({ kind: 'engagement' })}
        />
      );
    if (current === 'engagements')
      return (
        <>
          <div className="ws-section-actions">
            <span>
              {workspace.engagements.length} engagement
              {workspace.engagements.length === 1 ? '' : 's'}
            </span>
            {canEdit && (
              <button className="ws-button" onClick={() => setEditor({ kind: 'engagement' })}>
                <Plus size={16} />
                Create engagement
              </button>
            )}
          </div>
          {workspace.engagements.length ? (
            <div className="ws-engagement-grid">
              {workspace.engagements.map((engagement) => (
                <Panel key={engagement.id} className="ws-engagement-card">
                  <div className="ws-card-top">
                    <BriefcaseBusiness size={22} strokeWidth={1.4} />
                    <Status value={engagement.status} />
                  </div>
                  <h2>{engagement.title}</h2>
                  <p>
                    {human(engagement.data.description) === '—'
                      ? 'Engineering-led AWS cloud margin recovery.'
                      : human(engagement.data.description)}
                  </p>
                  <small>Started {date(engagement.createdAt)}</small>
                  <Workflow stage={engagement.stage} />
                  <div className="ws-card-footer">
                    <button
                      className="ws-text-button"
                      onClick={() => {
                        setEngagementId(engagement.id);
                        router.push(href('ledger'));
                      }}
                    >
                      View savings ledger <ArrowRight size={16} />
                    </button>
                    {canEdit && (
                      <button
                        className="ws-icon-button"
                        aria-label={`Update ${engagement.title}`}
                        onClick={() =>
                          setAction({
                            title: 'Update engagement',
                            description:
                              'Keep the customer-visible stage and fulfilment status accurate.',
                            fields: [
                              { name: 'title', label: 'New engagement title (optional)' },
                              {
                                name: 'status',
                                label: 'Status',
                                type: 'select',
                                options: [
                                  'onboarding',
                                  'active',
                                  'implementation',
                                  'verification',
                                  'complete',
                                  'on_hold',
                                  'cancelled',
                                ],
                                required: true,
                              },
                              {
                                name: 'stage',
                                label: 'Stage',
                                type: 'select',
                                options: stages,
                                required: true,
                              },
                            ],
                            submit: (data) =>
                              mutate({
                                action: 'updateEngagement',
                                id: engagement.id,
                                data: {
                                  title: data.title || engagement.title,
                                  status: data.status || engagement.status,
                                  stage: data.stage || engagement.stage,
                                },
                              }),
                          })
                        }
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel>
              <Empty
                icon={BriefcaseBusiness}
                title="Your engagement starts here"
                action={
                  <Link className="ws-button" href="/start">
                    Start your Savings Sprint <ArrowRight size={15} />
                  </Link>
                }
              >
                Once your order is confirmed, your engagement, timeline and next steps will appear
                here.
              </Empty>
            </Panel>
          )}
        </>
      );
    if (current === 'customers')
      return (
        <Panel
          title="Customer organisations"
          aside={
            <button
              className="ws-button"
              disabled={demo}
              onClick={() => setEditor({ kind: 'organisation' })}
            >
              <Plus size={15} />
              Create organisation
            </button>
          }
        >
          {workspace.organisations.length ? (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Access</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {workspace.organisations.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <strong>{org.name}</strong>
                        <small>{org.id}</small>
                      </td>
                      <td>
                        <Status value={org.role} />
                      </td>
                      <td>
                        <button
                          className="ws-text-button"
                          onClick={() => setOrganisationId(org.id)}
                        >
                          Open workspace <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Building2} title="No customers yet">
              Organisations are created through paid orders or securely added by an administrator.
            </Empty>
          )}
        </Panel>
      );
    if (current === 'billing' && !canBilling)
      return (
        <Panel>
          <Empty icon={LockKeyhole} title="Billing access required">
            Organisation owners and billing members can view orders and payment records. Ask your
            organisation owner to review your access.
          </Empty>
        </Panel>
      );
    if (current === 'billing')
      return (
        <>
          <Billing workspace={workspace} />
          {admin && <PaymentOperations demo={demo} />}
        </>
      );
    if (current === 'members')
      return (
        <Members
          workspace={workspace}
          demo={demo}
          onInvite={() => setEditor({ kind: 'invite' })}
          mutate={mutate}
        />
      );
    if (current === 'settings')
      return (
        <Settings
          workspace={workspace}
          demo={demo}
          onEdit={() =>
            setEditor({
              kind: 'settings',
              initial: {
                name: workspace.organisation?.name || '',
                notificationEmail: workspace.settings.notificationEmail || '',
              },
            })
          }
        />
      );
    if (current === 'enquiries') return <Enquiries demo={demo} workspace={workspace} />;
    if (current === 'operations') return <Operations demo={demo} />;
    if (current === 'audit')
      return (
        <Panel title="Recorded activity">
          <Audit workspace={workspace} />
        </Panel>
      );
    if (current === 'onboarding')
      return (
        <>
          <OnboardingOverview
            workspace={workspace}
            records={relevant}
            demo={demo}
            create={() => create('onboarding')}
            onOpen={openRecord}
            canSubmit={canSubmitOnboarding}
          />
          <AWSAccess
            workspace={workspace}
            engagementId={engagementId || selectedEngagement?.id || ''}
            demo={demo}
            reload={load}
          />
        </>
      );
    if (current === 'implementation')
      return (
        <>
          <ImplementationOverview records={relevant} />
          <RecordsTable
            kind="remediation"
            records={relevant.filter((r) => r.kind === 'remediation')}
            workspace={workspace}
            title="Engineering changes"
            onOpen={openRecord}
            aside={
              <>
                {exportButton(relevant.filter((r) => r.kind === 'remediation'))}
                {canEdit && addButton('remediation', 'Create remediation')}
              </>
            }
          />
          <div className="ws-two-columns">
            <Panel title="Approval history">
              <CompactRecords
                records={relevant.filter((r) => r.kind === 'approval')}
                onOpen={openRecord}
                empty="No engineering approvals have been recorded."
              />
            </Panel>
            <Panel title="Customer-controlled deployments">
              <CompactRecords
                records={relevant.filter((r) => r.kind === 'deployment')}
                onOpen={openRecord}
                empty="Deployment evidence will appear here after an approved change is implemented."
              />
            </Panel>
          </div>
        </>
      );
    if (current === 'verification')
      return (
        <>
          <VerificationSummary records={relevant} />
          <div className="ws-alert ws-alert-info">
            <ShieldCheck size={20} />
            <p>
              Verification uses an agreed baseline and observation period, normally 30 days. The
              agreed period and billing availability govern verification. Normalisation adjustments
              and billing evidence remain visible alongside every result.
            </p>
          </div>
          <RecordsTable
            kind="verification"
            records={relevant.filter((r) => r.kind === 'verification')}
            workspace={workspace}
            title="Verification records"
            onOpen={openRecord}
            aside={
              <>
                {exportButton(relevant.filter((r) => r.kind === 'verification'))}
                {canEdit && addButton('verification')}
              </>
            }
          />
        </>
      );
    const kind = kindByView[current];
    if (kind) {
      const records = relevant.filter((r) => r.kind === kind);
      return (
        <>
          {current === 'ledger' && <LedgerSummary records={records} />}
          {current === 'proposals' && !workspace.isStaff && (
            <div className="ws-section-actions">
              <span>Every implementation starts with agreed scope.</span>
              <button
                className="ws-button ws-button-secondary"
                disabled={demo}
                onClick={() =>
                  create('support', {
                    title: 'Request an implementation engagement',
                    message:
                      'Please review the next implementation phase and prepare a scope for our engineering team.',
                  })
                }
              >
                Request implementation scope <ArrowRight size={14} />
              </button>
            </div>
          )}
          {current === 'proposals' && (
            <div className="ws-alert ws-alert-info">
              <BriefcaseBusiness size={20} />
              <p>
                Implementation Sprint: £15,000 against agreed scope. Outcome-based implementation:
                25% of verified savings against an agreed contractual and verification basis. No
                outcome-based automatic charges.
              </p>
            </div>
          )}
          {current === 'deliverables' && (
            <div className="ws-alert ws-alert-info">
              <LockKeyhole size={19} />
              <p>
                Engagement files are private to your organisation. Only published customer-facing
                deliverables are available here.
              </p>
            </div>
          )}
          <RecordsTable
            kind={kind}
            records={records}
            workspace={workspace}
            title={kind === 'opportunity' ? 'Prioritised opportunities' : meta.title}
            onOpen={openRecord}
            aside={
              <>
                {exportButton(records)}
                {(canEdit || kind === 'support') &&
                  addButton(kind, kind === 'support' ? 'Ask a question' : undefined)}
              </>
            }
          />
        </>
      );
    }
    return (
      <Panel>
        <Empty title="Page not found">Choose a page from your workspace navigation.</Empty>
      </Panel>
    );
  };
  return (
    <div className="workspace">
      <a href="#workspace-content" className="ws-skip">
        Skip to workspace content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="ws-mobile-backdrop"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`ws-sidebar ${mobile ? 'ws-sidebar-open' : ''}`}>
        <div className="ws-brand">
          <Brand />
          <small>{admin ? 'OPERATIONS' : 'CUSTOMER WORKSPACE'}</small>
        </div>
        <button
          className="ws-sidebar-close ws-icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="ws-org-label">
          <div className="ws-org-icon">
            <Building2 size={18} />
          </div>
          <div>
            <strong>{workspace?.organisation?.name || 'Your organisation'}</strong>
            <span>{admin ? 'Administrator workspace' : 'Private engagement workspace'}</span>
          </div>
        </div>
        <nav aria-label="Workspace navigation">
          {navigation.map((section) => (
            <div className="ws-nav-section" key={section.section}>
              <span className="ws-nav-label">{section.section}</span>
              {section.items
                .filter((item) => item.href !== 'billing' || canBilling)
                .map((item) => {
                  const Icon = item.icon;
                  const active = current === (item.href || 'dashboard');
                  return (
                    <Link
                      key={item.href}
                      href={href(item.href)}
                      className={`ws-nav-link ${active ? 'ws-nav-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobile(false)}
                    >
                      <Icon size={18} strokeWidth={1.6} />
                      {item.label}
                      {active && <span className="ws-nav-dot" />}
                    </Link>
                  );
                })}
            </div>
          ))}
          {admin && (
            <div className="ws-nav-section">
              <span className="ws-nav-label">Administration</span>
              {[
                { href: 'customers', label: 'Customers', icon: Building2 },
                { href: 'enquiries', label: 'Public enquiries', icon: Inbox },
                { href: 'updates', label: 'Status updates', icon: Send },
                { href: 'audit', label: 'Audit trail', icon: Activity },
                { href: 'operations', label: 'Operational queues', icon: Activity },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={href(item.href)}
                  className={`ws-nav-link ${current === item.href ? 'ws-nav-active' : ''}`}
                >
                  <item.icon size={18} strokeWidth={1.6} />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-security-note">
            <ShieldCheck size={16} />
            <span>Customer approval. Always.</span>
          </div>
          <Link href="/security" className="ws-sidebar-help">
            Our security model <ArrowUpRight size={13} />
          </Link>
          <div className="ws-user">
            <div className="ws-avatar">{workspace?.user.name?.slice(0, 1) || 'H'}</div>
            <div>
              <strong>{workspace?.user.name || 'Your account'}</strong>
              <span>{workspace?.user.email || 'Secure customer access'}</span>
            </div>
            {!demo && (
              <button className="ws-icon-button" aria-label="Sign out" onClick={signOut}>
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="ws-main">
        <header className="ws-topbar">
          <div className="ws-topbar-left">
            <button
              className="ws-mobile-toggle ws-icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>{admin ? 'HKGpipi operations' : 'Your workspace'}</span>
            <ChevronRight size={14} />
            <strong>{detailId ? 'Record detail' : meta.title}</strong>
          </div>
          <div className="ws-topbar-right">
            {workspace && workspace.organisations.length > 0 && (
              <label className="ws-select-label">
                <span className="ws-visually-hidden">Select organisation</span>
                <select
                  value={organisationId || workspace.organisation?.id || ''}
                  onChange={(e) => {
                    setOrganisationId(e.target.value);
                    setEngagementId('');
                    router.replace(
                      `${prefix}${view.length ? '/' + view.join('/') : ''}?organisationId=${encodeURIComponent(e.target.value)}`,
                    );
                  }}
                >
                  {workspace.organisations.map((org) => (
                    <option value={org.id} key={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="ws-icon-button"
              onClick={load}
              disabled={loading || demo}
              aria-label="Refresh workspace"
            >
              <RefreshCw size={17} className={loading ? 'ws-spin' : ''} />
            </button>
            <Link className="ws-icon-button" href="/account-security" aria-label="Account security">
              <ShieldCheck size={18} />
            </Link>
          </div>
        </header>
        {demo && (
          <div className="ws-demo-banner">
            <ShieldCheck size={16} />
            <strong>Illustrative workspace</strong>
            <span>
              Example data only. No real customer results, AWS connection or payments. Changes are
              disabled.
            </span>
            <Link href="/start">
              Start your Savings Sprint <ArrowRight size={14} />
            </Link>
          </div>
        )}
        {!demo && workspace?.capabilities.localTest && (
          <div className="ws-demo-banner">
            <ShieldCheck size={16} />
            <strong>Local test environment</strong>
            <span>
              Test checkout charges no money. AWS connections retain their own validation state.
            </span>
          </div>
        )}
        <main className="ws-content" id="workspace-content">
          <div className="ws-page-heading">
            <div>
              <p className="ws-eyebrow">
                {admin ? 'HKGpipi operations / ' : ''}
                {meta.eyebrow}
              </p>
              <h1>{detailId ? selectedRecord?.title || 'Record detail' : meta.title}</h1>
              <p>{meta.description}</p>
            </div>
            {workspace && workspace.engagements.length > 0 && (
              <label className="ws-engagement-filter">
                <span>Engagement</span>
                <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
                  <option value="">All engagements</option>
                  {workspace.engagements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {message && (
            <div className="ws-alert ws-alert-success" role="status">
              <CheckCircle2 size={18} />
              <p>{message}</p>
              <button
                className="ws-icon-button"
                aria-label="Dismiss notification"
                onClick={() => setMessage('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="ws-alert ws-alert-error" role="alert">
              <p>{error}</p>
              <button className="ws-button ws-button-secondary" onClick={load}>
                Try again
              </button>
            </div>
          )}
          {loading && !workspace ? (
            <div className="ws-loading" role="status">
              <LoaderCircle className="ws-spin" size={25} />
              <h2>Opening your workspace</h2>
              <p>Loading your engagement and secure records.</p>
            </div>
          ) : (
            content()
          )}
          {pending && (
            <div className="ws-saving" role="status">
              <LoaderCircle className="ws-spin" size={15} />
              Saving securely…
            </div>
          )}
          <footer className="ws-footer">
            <span>HKGpipi · Engineering-led cloud margin recovery</span>
            <div>
              <Link href="/privacy">Privacy</Link>
              <Link href="/security">Security</Link>
              <Link href={href('support')}>Get support</Link>
            </div>
          </footer>
        </main>
      </div>
      {editor && workspace && (
        <EditorModal
          errorMessage={error}
          editor={editor}
          workspace={workspace}
          engagementId={engagementId}
          mutate={mutate}
          onClose={() => setEditor(null)}
        />
      )}
      {action && (
        <ActionModal
          errorMessage={error}
          title={action.title}
          description={action.description}
          fields={action.fields}
          onSubmit={action.submit}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

function Workflow({ stage }: { stage: string }) {
  const active = stages.findIndex((s) => s.toLowerCase() === stage.toLowerCase());
  return (
    <ol className="ws-workflow" aria-label="Engagement progress">
      {stages.map((s, i) => (
        <li
          className={i < active ? 'ws-stage-done' : i === active ? 'ws-stage-current' : ''}
          key={s}
        >
          <span>{i < active ? <Check size={10} /> : i + 1}</span>
          <small>{s}</small>
        </li>
      ))}
    </ol>
  );
}
function Dashboard({
  records,
  href,
  admin,
  engagement,
  onCreateEngagement,
}: {
  records: EntityRecord[];
  href: (s: string) => string;
  admin: boolean;
  engagement: Workspace['engagements'][number] | undefined;
  onCreateEngagement: () => void;
}) {
  const opportunities = records.filter(
    (r) => r.kind === 'opportunity' && r.status !== 'superseded',
  );
  const verified = latestVerifications(records);
  const approvals = records.filter(
    (r) => r.kind === 'remediation' && ['in_review', 'awaiting_approval'].includes(r.status),
  );
  return (
    <>
      <div className="ws-welcome">
        <div>
          <span className="ws-eyebrow">Visibility. Optimisation. Impact.</span>
          <h2>Clarity at every step.</h2>
          <p>
            Your savings journey connects financial opportunities to controlled engineering changes
            and verified outcomes.
          </p>
          <Link href={href('ledger')} className="ws-button ws-button-light">
            Explore your savings ledger <ArrowRight size={16} />
          </Link>
        </div>
        <div className="ws-welcome-mark">
          <span>FIND</span>
          <span>CHANGE</span>
          <span>VERIFY</span>
          <div className="ws-welcome-line" />
        </div>
      </div>
      <div className="ws-metrics">
        <Metric
          label="Identified opportunities"
          value={opportunities.length}
          note="Subject to validation and engineering review"
          icon={ListChecks}
        />
        <Metric
          label="Expected monthly saving"
          value={groupMoney(opportunities, 'monthlySaving').join(' / ') || '—'}
          note="Conservative candidate total; not realised savings"
          icon={TrendingUp}
        />
        <Metric
          label="Awaiting engineering approval"
          value={approvals.length}
          note="Customer approval remains authoritative"
          icon={GitPullRequest}
        />
        <Metric
          label="Verified annualised saving"
          value={groupMoney(verified, 'annualisedSaving').join(' / ') || '—'}
          note="Latest published result per opportunity; overlaps excluded"
          icon={ShieldCheck}
        />
      </div>
      <div className="ws-two-columns ws-dashboard-columns">
        <Panel
          title="Your engagement"
          aside={
            <Link href={href('engagements')} className="ws-text-button">
              View all <ArrowUpRight size={15} />
            </Link>
          }
        >
          {engagement ? (
            <div className="ws-engagement-overview">
              <div className="ws-card-top">
                <h3>{engagement.title}</h3>
                <Status value={engagement.status} />
              </div>
              <p>
                Started {date(engagement.createdAt)} · Your engineering controls remain
                authoritative.
              </p>
              <Workflow stage={engagement.stage} />
              <div className="ws-inline-next">
                <div className="ws-round-icon">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <strong>Keep the work moving</strong>
                  <p>
                    {approvals.length
                      ? `${approvals.length} engineering change${approvals.length === 1 ? ' is' : 's are'} ready for your review.`
                      : 'Review your engagement records and next steps.'}
                  </p>
                </div>
                <Link
                  href={href(approvals.length ? 'implementation' : 'onboarding')}
                  className="ws-text-button"
                >
                  {approvals.length ? 'Review changes' : 'View onboarding'} <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <Empty
              icon={BriefcaseBusiness}
              title="Ready to start your first sprint?"
              action={
                admin ? (
                  <button className="ws-button" onClick={onCreateEngagement}>
                    <Plus size={16} />
                    Create engagement
                  </button>
                ) : (
                  <Link href="/start" className="ws-button">
                    Start your Savings Sprint <ArrowRight size={15} />
                  </Link>
                )
              }
            >
              Your engagement timeline will appear here after your order is confirmed.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Latest engagement updates"
          aside={
            <Link href={href(admin ? 'updates' : 'engagements')} className="ws-text-button">
              View engagement <ArrowUpRight size={15} />
            </Link>
          }
        >
          {records.filter((r) => r.kind === 'update' && r.status === 'published').length ? (
            <div className="ws-updates">
              {records
                .filter((r) => r.kind === 'update' && r.status === 'published')
                .slice(0, 4)
                .map((update) => (
                  <article key={update.id}>
                    <span className="ws-update-dot" />
                    <div>
                      <small>{date(update.updatedAt)}</small>
                      <h3>{update.title}</h3>
                      <p>{human(update.data.message)}</p>
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty icon={Activity} title="Your progress will be recorded here">
              Engagement updates appear when your HKGpipi team publishes them. No progress or
              financial results are implied before evidence is available.
            </Empty>
          )}
        </Panel>
      </div>
      <Panel
        title="Priority savings opportunities"
        aside={
          <Link href={href('ledger')} className="ws-text-button">
            Open savings ledger <ArrowRight size={15} />
          </Link>
        }
      >
        {opportunities.length ? (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>AWS service</th>
                  <th>Expected / month</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...opportunities]
                  .sort(
                    (a, b) => Number(b.data.monthlySaving || 0) - Number(a.data.monthlySaving || 0),
                  )
                  .slice(0, 5)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={href(`ledger/${r.id}`)} className="ws-record-link">
                          {r.title}
                          <ArrowUpRight size={14} />
                        </Link>
                        <small>{human(r.data.owner)}</small>
                      </td>
                      <td>{human(r.data.service)}</td>
                      <td className="ws-number">
                        {money(r.data.monthlySaving, String(r.data.currency || 'GBP'))}
                      </td>
                      <td>
                        <span className="ws-confidence">
                          <i className={`ws-confidence-${r.data.confidence}`} />
                          {human(r.data.confidence)}
                        </span>
                      </td>
                      <td>
                        <Status value={r.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={ListChecks} title="Evidence comes before estimates">
            Your savings ledger will be populated as opportunities are investigated. No illustrative
            data is included in your actual engagement.
          </Empty>
        )}
      </Panel>
    </>
  );
}

function LedgerSummary({ records }: { records: EntityRecord[] }) {
  return (
    <div className="ws-metrics ws-metrics-three">
      <Metric
        label="Expected monthly saving"
        value={
          groupMoney(
            records.filter((r) => r.status !== 'superseded'),
            'monthlySaving',
          ).join(' / ') || '—'
        }
        note="Resource overlaps counted once; currencies separate"
        icon={TrendingUp}
      />
      <Metric
        label="Validated opportunities"
        value={records.filter((r) => ['validated', 'assigned'].includes(r.status)).length}
        note={`${records.length} opportunities in your ledger`}
        icon={ShieldCheck}
      />
      <Metric
        label="High-confidence findings"
        value={records.filter((r) => r.data.confidence === 'high').length}
        note="Confidence and engineering risk are distinct"
        icon={ListChecks}
      />
    </div>
  );
}
function VerificationSummary({ records }: { records: EntityRecord[] }) {
  const published = latestVerifications(records);
  return (
    <div className="ws-metrics ws-metrics-three">
      <Metric
        label="Expected monthly saving"
        value={
          groupMoney(
            records.filter((r) => r.kind === 'opportunity'),
            'monthlySaving',
          ).join(' / ') || '—'
        }
        note="Projected value from the opportunity ledger"
        icon={TrendingUp}
      />
      <Metric
        label="Normalised observed saving"
        value={groupMoney(published, 'normalisedSaving').join(' / ') || '—'}
        note="Latest published observation periods; overlaps excluded"
        icon={Activity}
      />
      <Metric
        label="Verified annualised saving"
        value={groupMoney(published, 'annualisedSaving').join(' / ') || '—'}
        note="Annualised using each agreed measurement basis"
        icon={ShieldCheck}
      />
    </div>
  );
}
function ImplementationOverview({ records }: { records: EntityRecord[] }) {
  const remediations = records.filter((r) => r.kind === 'remediation');
  return (
    <div className="ws-metrics ws-metrics-three">
      <Metric
        label="Engineering changes"
        value={remediations.length}
        note="Specific remediation with linked evidence"
        icon={GitPullRequest}
      />
      <Metric
        label="Awaiting approval"
        value={
          remediations.filter((r) => ['in_review', 'awaiting_approval'].includes(r.status)).length
        }
        note="Approval applies to an exact change revision"
        icon={Clock3}
      />
      <Metric
        label="Deployment records"
        value={records.filter((r) => r.kind === 'deployment').length}
        note="Customer-controlled, evidence-backed changes"
        icon={CheckCircle2}
      />
    </div>
  );
}

function RecordsTable({
  kind,
  records,
  workspace,
  title,
  onOpen,
  aside,
}: {
  kind: EntityKind;
  records: EntityRecord[];
  workspace: Workspace;
  title: string;
  onOpen: (r: EntityRecord) => void;
  aside?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('updated');
  const statuses = [...new Set(records.map((r) => r.status))];
  const result = useMemo(
    () =>
      records
        .filter(
          (r) =>
            (!status || r.status === status) &&
            `${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : sort === 'saving'
              ? Number(b.data.monthlySaving || 0) - Number(a.data.monthlySaving || 0)
              : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [records, status, search, sort],
  );
  const empty: Record<EntityKind, { title: string; text: string }> = {
    opportunity: {
      title: 'Your ledger is ready for real findings',
      text: 'Opportunities appear as your AWS estate is investigated. Each finding will include evidence, expected value, confidence and engineering risk.',
    },
    remediation: {
      title: 'No engineering changes yet',
      text: 'Validated opportunities become specific engineering work, subject to your existing approval and deployment processes.',
    },
    onboarding: {
      title: 'No onboarding submission yet',
      text: 'Complete the structured onboarding to give your engagement the right context.',
    },
    deliverable: {
      title: 'Your deliverables will appear here',
      text: 'Published reports, technical recommendations and financial evidence will be available for secure access.',
    },
    verification: {
      title: 'No verified financial results yet',
      text: 'Verification follows deployment and the agreed billing observation period, normally 30 days. Estimates are never presented as realised savings.',
    },
    proposal: {
      title: 'No implementation proposals yet',
      text: 'When the Savings Sprint identifies agreed engineering work, you can review the next engagement scope and terms here.',
    },
    support: {
      title: 'How can we help?',
      text: 'Open a support request to keep your question and the response connected to your engagement.',
    },
    update: {
      title: 'No updates published yet',
      text: 'Create an engagement update, review it, then publish it to the customer workspace.',
    },
    approval: {
      title: 'No approvals recorded',
      text: 'Approval decisions will be recorded against the relevant engineering revision.',
    },
    deployment: {
      title: 'No deployments recorded',
      text: 'Customer-authorised deployments and supporting evidence will appear here.',
    },
  };
  return (
    <Panel title={title} aside={<div className="ws-actions">{aside}</div>}>
      <div className="ws-table-tools">
        <label className="ws-search">
          <Search size={16} />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder="Search records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option value={s} key={s}>
                {human(s)}
              </option>
            ))}
          </select>
          <select aria-label="Sort records" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
            {kind === 'opportunity' && <option value="saving">Highest expected saving</option>}
          </select>
        </div>
      </div>
      {result.length ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>{kind === 'opportunity' ? 'Savings opportunity' : 'Record'}</th>
                {kind === 'opportunity' ? (
                  <>
                    <th>AWS service</th>
                    <th>Expected / month</th>
                    <th>Confidence / risk</th>
                  </>
                ) : (
                  <>
                    <th>Engagement</th>
                    {kind === 'verification' && <th>Verified annualised</th>}
                    {kind === 'proposal' && <th>Commercial option</th>}
                    <th>Updated</th>
                  </>
                )}
                <th>Status</th>
                <th>
                  <span className="ws-visually-hidden">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.map((record) => (
                <tr key={record.id}>
                  <td>
                    <button className="ws-record-link" onClick={() => onOpen(record)}>
                      {record.title}
                    </button>
                    <small>
                      {kind === 'opportunity'
                        ? human(record.data.owner)
                        : `Revision ${record.version}`}
                    </small>
                  </td>
                  {kind === 'opportunity' ? (
                    <>
                      <td>{human(record.data.service)}</td>
                      <td className="ws-number">
                        {money(record.data.monthlySaving, String(record.data.currency || 'GBP'))}
                      </td>
                      <td>
                        <span className="ws-confidence">
                          <i className={`ws-confidence-${record.data.confidence}`} />
                          {human(record.data.confidence)}
                        </span>
                        <small>{human(record.data.risk)} risk</small>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        {workspace.engagements.find((e) => e.id === record.engagementId)?.title ||
                          'Organisation'}
                      </td>
                      {kind === 'verification' && (
                        <td className="ws-number">
                          {record.status === 'published'
                            ? money(
                                record.data.annualisedSaving,
                                String(record.data.currency || 'GBP'),
                              )
                            : 'Pending verification'}
                        </td>
                      )}
                      {kind === 'proposal' && (
                        <td>
                          {record.data.offer === 'outcome'
                            ? '25% of verified savings'
                            : money(
                                record.data.amount,
                                String(record.data.currency || 'GBP'),
                                true,
                              )}
                        </td>
                      )}
                      <td>{date(record.updatedAt)}</td>
                    </>
                  )}
                  <td>
                    <Status value={record.status} />
                  </td>
                  <td>
                    <button
                      className="ws-icon-button"
                      aria-label={`Open ${record.title}`}
                      onClick={() => onOpen(record)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={search || status ? 'No matching records' : empty[kind].title}
          icon={kind === 'opportunity' ? ListChecks : kind === 'verification' ? ShieldCheck : Inbox}
        >
          {search || status ? 'Try another search or clear the filters.' : empty[kind].text}
        </Empty>
      )}
      <div className="ws-table-footer">
        <span>
          {result.length} of {records.length} records
        </span>
        <span>{kind === 'opportunity' ? 'Expected savings are estimates.' : ''}</span>
      </div>
    </Panel>
  );
}

function CompactRecords({
  records,
  onOpen,
  empty,
}: {
  records: EntityRecord[];
  onOpen: (r: EntityRecord) => void;
  empty: string;
}) {
  return records.length ? (
    <div className="ws-compact-records">
      {records.map((r) => (
        <button key={r.id} onClick={() => onOpen(r)}>
          <div>
            <strong>{r.title}</strong>
            <small>
              {date(r.updatedAt)} · {human(r.data.reason || r.data.evidence)}
            </small>
          </div>
          <Status value={r.status} />
          <ChevronRight size={15} />
        </button>
      ))}
    </div>
  ) : (
    <p className="ws-quiet-empty">{empty}</p>
  );
}

function RecordDetail({
  record,
  workspace,
  canEdit,
  canApprove,
  demo,
  href,
  onEdit,
  onAction,
  onCreate,
  mutate,
}: {
  record: EntityRecord;
  workspace: Workspace;
  canEdit: boolean;
  canApprove: boolean;
  demo: boolean;
  href: (s: string) => string;
  onEdit: () => void;
  onAction: (
    record: EntityRecord,
    action: string,
    title: string,
    description: string,
    fields?: Field[],
  ) => void;
  onCreate: (kind: EntityKind, initial?: Record<string, unknown>) => void;
  mutate: Mutation;
}) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const view =
    Object.entries(kindByView).find(([, kind]) => kind === record.kind)?.[0] || 'implementation';
  const related = workspace.records.filter(
    (r) =>
      r.id !== record.id &&
      (r.data.opportunityId === record.id ||
        r.data.remediationId === record.id ||
        r.data.deploymentId === record.id),
  );
  const currency = String(record.data.currency || 'GBP');
  const canSubmitOnboarding =
    workspace.isStaff ||
    (workspace.capabilities.canSubmitOnboarding ??
      ['owner', 'approver', 'member'].includes(workspace.organisation?.role || ''));
  const displayFields = fields[record.kind].filter(
    (f) =>
      record.data[f.name] !== undefined &&
      record.data[f.name] !== '' &&
      f.name !== 'fileId' &&
      f.name !== 'supportingFileId',
  );
  const actionButton = (
    action: string,
    label: string,
    description: string,
    formFields: Field[] = [],
  ) => (
    <button
      className="ws-button"
      disabled={demo}
      onClick={() => onAction(record, action, label, description, formFields)}
    >
      {label}
    </button>
  );
  return (
    <>
      <Link href={href(view)} className="ws-back-link">
        ← Back to {titles[view]?.title.toLowerCase() || 'records'}
      </Link>
      <Panel>
        <div className="ws-detail-heading">
          <div>
            <span className="ws-eyebrow">
              {entityLabels[record.kind]} · Revision {record.version}
            </span>
            <h2>{record.title}</h2>
            <p>
              Updated {date(record.updatedAt)} ·{' '}
              {workspace.engagements.find((e) => e.id === record.engagementId)?.title ||
                'Organisation record'}
            </p>
          </div>
          <div className="ws-actions">
            <Status value={record.status} />
            {(canEdit ||
              (!demo &&
                (record.kind === 'support' ||
                  (record.kind === 'onboarding' &&
                    canSubmitOnboarding &&
                    ['draft', 'changes_requested'].includes(record.status))))) && (
              <button className="ws-button ws-button-secondary" onClick={onEdit}>
                <Pencil size={15} />
                Edit record
              </button>
            )}
          </div>
        </div>
        {record.kind === 'opportunity' && (
          <div className="ws-detail-metrics">
            <Metric
              label="Expected monthly saving"
              value={money(record.data.monthlySaving, currency)}
              note="Estimated; not a realised financial result"
              icon={TrendingUp}
            />
            <Metric
              label="Confidence"
              value={human(record.data.confidence)}
              note={`${human(record.data.risk)} engineering risk`}
              icon={ShieldCheck}
            />
          </div>
        )}
        {record.kind === 'verification' && (
          <div className="ws-detail-metrics">
            <Metric
              label="Normalised observed saving"
              value={
                record.data.normalisedSaving === undefined
                  ? 'Pending'
                  : money(record.data.normalisedSaving, currency)
              }
              note="For the recorded observation period"
            />
            <Metric
              label="Annualised saving"
              value={
                record.status === 'published'
                  ? money(record.data.annualisedSaving, currency)
                  : 'Pending verification'
              }
              note="Published only after evidence review"
              icon={ShieldCheck}
            />
          </div>
        )}
        <dl className="ws-detail-fields">
          {displayFields.map((field) => (
            <div key={field.name} className={field.type === 'textarea' ? 'ws-detail-wide' : ''}>
              <dt>{field.label}</dt>
              <dd>
                {field.type === 'url' &&
                typeof record.data[field.name] === 'string' &&
                /^https?:\/\//.test(String(record.data[field.name])) ? (
                  <a
                    href={String(record.data[field.name])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ws-text-button"
                  >
                    Open reference <ExternalLink size={14} />
                  </a>
                ) : field.name === 'currency' ? (
                  currency
                ) : field.type === 'date' ? (
                  date(String(record.data[field.name]))
                ) : (
                  human(record.data[field.name])
                )}
              </dd>
            </div>
          ))}
        </dl>
        {!!(record.data.fileId || record.data.supportingFileId) && (
          <div className="ws-detail-actions">
            <a
              className="ws-button"
              href={`/api/v1/files?id=${encodeURIComponent(String(record.data.fileId || record.data.supportingFileId))}`}
            >
              <Download size={16} />
              Download securely
            </a>
            <span className="ws-muted">Access is verified before every download.</span>
          </div>
        )}
        <div className="ws-detail-actions">
          {record.kind === 'onboarding' &&
            canSubmitOnboarding &&
            ['draft', 'changes_requested'].includes(record.status) &&
            !demo &&
            actionButton(
              'update',
              'Submit for review',
              'Confirm the onboarding information is accurate and approved for sharing. This does not verify an AWS connection.',
              [],
            )}
          {record.kind === 'onboarding' && canEdit && record.status === 'submitted' && (
            <>
              {actionButton(
                'approve',
                'Approve onboarding',
                'Record your review of the customer onboarding submission. AWS connectivity has its own verification state.',
              )}
              {actionButton(
                'reject',
                'Request changes',
                'Explain what information needs to be corrected.',
                [{ name: 'reason', label: 'Required changes', type: 'textarea', required: true }],
              )}
            </>
          )}
          {record.kind === 'opportunity' && canEdit && (
            <button
              className="ws-button"
              onClick={() =>
                onCreate('remediation', {
                  opportunityId: record.id,
                  title: `Remediation: ${record.title}`,
                })
              }
            >
              <GitPullRequest size={16} />
              Create engineering change
            </button>
          )}
          {record.kind === 'remediation' &&
            ['draft', 'in_review', 'awaiting_approval', 'changes_requested'].includes(
              record.status,
            ) &&
            canApprove && (
              <>
                {actionButton(
                  'approve',
                  'Approve this revision',
                  'You are approving the exact engineering revision shown. Your existing engineering review and deployment controls remain authoritative.',
                  [{ name: 'reason', label: 'Approval note', type: 'textarea', required: true }],
                )}
                {actionButton(
                  'reject',
                  'Request changes',
                  'Explain what must change before this engineering work can be approved.',
                  [{ name: 'reason', label: 'Required changes', type: 'textarea', required: true }],
                )}
              </>
            )}
          {record.kind === 'remediation' &&
            record.status === 'approved' &&
            canApprove &&
            actionButton(
              'deploy',
              'Record deployment',
              'Record an authorised customer-controlled deployment. This action does not execute infrastructure changes.',
              [
                { name: 'deployedAt', label: 'Deployment date', type: 'date', required: true },
                {
                  name: 'evidence',
                  label: 'Deployment evidence and reference',
                  type: 'textarea',
                  required: true,
                },
              ],
            )}
          {record.kind === 'remediation' &&
            canEdit &&
            record.status === 'draft' &&
            actionButton(
              'update',
              'Request engineering approval',
              'Mark this revision ready for customer review.',
            )}
          {record.kind === 'deployment' &&
            record.status === 'deployed' &&
            canApprove &&
            actionButton(
              'rollback',
              'Record rollback',
              'Record customer-controlled rollback evidence. Dependent verification must be reassessed.',
              [
                { name: 'reason', label: 'Reason for rollback', type: 'textarea', required: true },
                { name: 'evidence', label: 'Rollback evidence', type: 'textarea', required: true },
              ],
            )}
          {record.kind === 'proposal' &&
            record.status === 'proposed' &&
            canApprove &&
            workspace.organisation?.role === 'owner' && (
              <>
                {actionButton(
                  'accept',
                  record.data.parentProposalId ? 'Approve outcome payment' : 'Accept proposal',
                  'Confirm that your organisation accepts this exact scope, commercial terms, verification evidence and any explicit payment request.',
                  [{ name: 'reason', label: 'Acceptance note', type: 'textarea' }],
                )}
                {actionButton(
                  'reject',
                  'Decline proposal',
                  'Tell us what needs to change in this proposal.',
                  [{ name: 'reason', label: 'Reason', type: 'textarea', required: true }],
                )}
              </>
            )}
          {record.kind === 'proposal' &&
            record.status === 'accepted' &&
            (record.data.offer === 'implementation' ||
              (record.data.offer === 'outcome' && !!record.data.settlementAmount)) &&
            !demo && (
              <Link className="ws-button" href={`/start?proposal=${encodeURIComponent(record.id)}`}>
                Review order & pay <ArrowRight size={16} />
              </Link>
            )}
          {canEdit &&
            record.kind === 'proposal' &&
            record.status === 'accepted' &&
            record.data.offer === 'outcome' &&
            !record.data.parentProposalId && (
              <button
                className="ws-button"
                onClick={() =>
                  onCreate('proposal', {
                    title: 'Outcome payment request: ' + record.title,
                    offer: 'outcome',
                    scope: record.data.scope,
                    termsVersion: record.data.termsVersion,
                    measurementBasis: record.data.measurementBasis,
                    feeBasis: record.data.feeBasis,
                    parentProposalId: record.id,
                  })
                }
              >
                Prepare outcome payment request
              </button>
            )}
          {record.kind === 'proposal' && record.data.offer === 'outcome' && (
            <p className="ws-muted">
              Outcome-based fees follow the agreed verified measurement and invoicing basis. No
              automatic checkout or charge is created.
            </p>
          )}
          {canEdit &&
            record.kind === 'verification' &&
            record.status === 'draft' &&
            actionButton(
              'verify',
              'Review verification',
              'Validate the billing windows, normalisation evidence and agreed measurement basis before publication.',
            )}
          {canEdit &&
            ['deliverable', 'verification', 'update'].includes(record.kind) &&
            record.status !== 'published' &&
            actionButton(
              'publish',
              'Publish to customer',
              'Publish this reviewed record to the customer workspace. Only evidence-backed verification may be presented as verified savings.',
            )}
          {canEdit &&
            record.kind === 'proposal' &&
            record.status === 'draft' &&
            actionButton(
              'publish',
              'Send proposal',
              'Make the scoped commercial proposal available for customer acceptance.',
            )}
          {canEdit && (
            <button
              className="ws-text-button ws-danger"
              onClick={() =>
                onAction(
                  record,
                  'delete',
                  'Delete record',
                  'This removes the record from the active workspace. Relevant audit history is retained. Confirm this record is no longer required.',
                  [
                    {
                      name: 'reason',
                      label: 'Reason for deletion',
                      type: 'textarea',
                      required: true,
                    },
                  ],
                )
              }
            >
              <Trash2 size={14} />
              Delete record
            </button>
          )}
        </div>
      </Panel>
      {record.kind === 'support' && (
        <Panel title="Conversation">
          <div className="ws-conversation">
            <article>
              <div className="ws-avatar">
                <LifeBuoy size={17} />
              </div>
              <div>
                <strong>Original request</strong>
                <small>{date(record.createdAt)}</small>
                <p>{human(record.data.message)}</p>
              </div>
            </article>
            {Array.isArray(record.data.replies) &&
              record.data.replies.map((item, index) => {
                const reply = item as Record<string, unknown>;
                return (
                  <article key={index}>
                    <div className="ws-avatar">{String(reply.author || 'H').slice(0, 1)}</div>
                    <div>
                      <strong>{human(reply.author)}</strong>
                      <small>{date(String(reply.at || ''))}</small>
                      <p>{human(reply.message)}</p>
                    </div>
                  </article>
                );
              })}
            {!demo && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  if (
                    await mutate({
                      action: 'update',
                      entity: 'support',
                      id: record.id,
                      version: record.version,
                      data: { reply },
                    })
                  )
                    setReply('');
                  setBusy(false);
                }}
              >
                <label className="ws-field">
                  Reply
                  <textarea
                    required
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add context or ask a follow-up question…"
                  />
                </label>
                <button className="ws-button" disabled={busy}>
                  <Send size={15} />
                  {busy ? 'Sending…' : 'Send reply'}
                </button>
              </form>
            )}
          </div>
        </Panel>
      )}
      {related.length > 0 && (
        <Panel title="Related evidence & workflow">
          <div className="ws-compact-records">
            {related.map((item) => (
              <Link
                key={item.id}
                href={href(
                  `${Object.entries(kindByView).find(([, kind]) => kind === item.kind)?.[0] || 'implementation'}/${item.id}`,
                )}
              >
                <div>
                  <small>{entityLabels[item.kind]}</small>
                  <strong>{item.title}</strong>
                </div>
                <Status value={item.status} />
              </Link>
            ))}
          </div>
        </Panel>
      )}
      <div className="ws-record-meta">
        <span>Record ID: {record.id}</span>
        <span>
          Created {date(record.createdAt)} · Revision {record.version}
        </span>
      </div>
    </>
  );
}

function OnboardingOverview({
  workspace,
  records,
  demo,
  create,
  onOpen,
  canSubmit,
}: {
  workspace: Workspace;
  records: EntityRecord[];
  demo: boolean;
  create: () => void;
  onOpen: (r: EntityRecord) => void;
  canSubmit: boolean;
}) {
  const onboarding = records.filter((r) => r.kind === 'onboarding');
  const approved = onboarding.some((r) => r.status === 'approved');
  const submitted = onboarding.some((r) => r.status === 'submitted');
  const steps = [
    {
      title: 'Confirm your engagement',
      text: 'Review the engagement scope and nominate technical and finance contacts.',
      complete: workspace.engagements.length > 0,
    },
    {
      title: 'Share your estate context',
      text: 'Submit account references, engineering context and the agreed scope.',
      complete: onboarding.length > 0,
    },
    {
      title: 'Configure read-only discovery',
      text: 'Create a narrowly scoped cross-account role with your unique external ID.',
      complete:
        Array.isArray(workspace.settings.awsConnections) &&
        (workspace.settings.awsConnections as Record<string, unknown>[]).some(
          (connection) => connection.status === 'verified',
        ),
    },
    {
      title: 'Review and start discovery',
      text: 'We review your submission and separately verify the authorised connection.',
      complete: approved,
    },
  ];
  return (
    <>
      <div className="ws-onboarding-intro">
        <div>
          <span className="ws-eyebrow">A controlled start</span>
          <h2>
            Your infrastructure.
            <br />
            Your approval boundaries.
          </h2>
          <p>
            Discovery uses constrained read-only AWS access. We never ask for access keys, secret
            keys or administrator permissions through this portal.
          </p>
          <div className="ws-actions">
            <button
              className="ws-button"
              onClick={create}
              disabled={demo || !workspace.organisation || !canSubmit}
            >
              <Plus size={16} />
              {onboarding.length ? 'New onboarding submission' : 'Complete onboarding'}
            </button>
            <Link className="ws-text-button" href="/security">
              Read our access model <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        <ShieldCheck size={90} strokeWidth={0.7} />
      </div>
      <Panel
        title="Your onboarding checklist"
        aside={<Status value={approved ? 'approved' : submitted ? 'submitted' : 'pending'} />}
      >
        <ol className="ws-onboarding-steps">
          {steps.map((step, i) => (
            <li key={step.title}>
              <span className={step.complete ? 'ws-step-complete' : ''}>
                {step.complete ? <Check size={15} /> : String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
      {onboarding.length > 0 && (
        <Panel title="Onboarding submissions">
          <div className="ws-compact-records">
            {onboarding.map((record) => (
              <button key={record.id} onClick={() => onOpen(record)}>
                <div>
                  <strong>{record.title}</strong>
                  <small>Updated {date(record.updatedAt)}</small>
                </div>
                <Status value={record.status} />
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function AWSAccess({
  workspace,
  engagementId,
  demo,
  reload,
}: {
  workspace: Workspace;
  engagementId: string;
  demo: boolean;
  reload: () => Promise<void>;
}) {
  const [roleArn, setRoleArn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [evidence, setEvidence] = useState<{
    snapshots: Record<string, unknown>[];
    checks: Record<string, unknown>[];
  } | null>(null);
  const connections = Array.isArray(workspace.settings.awsConnections)
    ? (workspace.settings.awsConnections as Record<string, unknown>[])
    : [];
  async function request(action: string, connectionId?: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/aws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          organisationId: workspace.organisation?.id,
          engagementId,
          roleArn: roleArn || undefined,
          connectionId:
            connectionId ||
            String(
              (result?.connection as Record<string, unknown> | undefined)?.id ||
                connections.find(
                  (connection) => !engagementId || connection.engagement_id === engagementId,
                )?.id ||
                '',
            ),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The AWS request could not be completed.');
      setResult(data);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AWS request could not be completed.');
    } finally {
      setBusy(false);
    }
  }
  async function viewEvidence(connectionId: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        '/api/v1/aws?' +
          new URLSearchParams({
            organisationId: workspace.organisation?.id || '',
            connectionId,
            view: 'evidence',
          }),
        { cache: 'no-store' },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Collected evidence could not be loaded.');
      setEvidence(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Collected evidence could not be loaded.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="AWS discovery connection"
      aside={
        <span className="ws-security-chip">
          <LockKeyhole size={13} />
          Read-only discovery
        </span>
      }
    >
      <div className="ws-aws-content">
        <div className="ws-alert ws-alert-info">
          <Cloud size={20} />
          <p>
            Instructions, submitted role details and a verified connection are different states. A
            connection is marked verified only after a real authorised AWS validation succeeds.
          </p>
        </div>
        <div className="ws-aws-columns">
          <div>
            <h3>1. Generate scoped access instructions</h3>
            <p>
              Create an engagement-specific external ID and review the role policy with your AWS
              administrator. No infrastructure is changed by HKGpipi.
            </p>
            <button
              className="ws-button ws-button-secondary"
              disabled={demo || busy || !engagementId}
              onClick={() => request('instructions')}
            >
              {busy ? <LoaderCircle size={15} className="ws-spin" /> : <FileText size={15} />}Get
              access instructions
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request('verify');
            }}
          >
            <h3>2. Validate the authorised role</h3>
            <label className="ws-field">
              Discovery role ARN
              <input
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/HKGpipiDiscovery"
                required
                pattern="arn:aws[^:]*:iam::[0-9]{12}:role/.+"
                disabled={demo}
              />
            </label>
            <button className="ws-button" disabled={demo || busy || !engagementId}>
              <ShieldCheck size={15} />
              {busy ? 'Validating…' : 'Validate connection'}
            </button>
          </form>
        </div>
        {error && (
          <div className="ws-alert ws-alert-error" role="alert">
            {error}
          </div>
        )}
        {result && (
          <div className="ws-aws-result" role="status">
            <h3>Connection instructions & result</h3>
            {Object.entries(result).map(([key, value]) => (
              <details key={key} open={typeof value === 'string'}>
                <summary>{human(key)}</summary>
                <pre>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
              </details>
            ))}
            <p>
              Review the permission boundaries before creating or updating a role in your AWS
              account.
            </p>
          </div>
        )}
        {connections.length > 0 && (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Role / account</th>
                  <th>Connection state</th>
                  <th>Last verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((connection, i) => (
                  <tr key={String(connection.id || i)}>
                    <td>
                      <strong>
                        {human(
                          connection.roleArn ||
                            connection.role_arn ||
                            connection.accountId ||
                            connection.account_id,
                        )}
                      </strong>
                      <small>{human(connection.id)}</small>
                    </td>
                    <td>
                      <Status value={String(connection.status || 'pending')} />
                    </td>
                    <td>
                      {date(
                        String(
                          connection.verifiedAt ||
                            connection.last_checked_at ||
                            connection.updatedAt ||
                            '',
                        ),
                      )}
                    </td>
                    <td>
                      <div className="ws-actions">
                        <button
                          className="ws-text-button"
                          disabled={demo || busy || connection.status !== 'verified'}
                          onClick={() => request('sync', String(connection.id))}
                        >
                          Retrieve billing data
                        </button>
                        <button
                          className="ws-text-button"
                          disabled={demo || busy}
                          onClick={() => viewEvidence(String(connection.id))}
                        >
                          Review collected evidence
                        </button>
                        <button
                          className="ws-text-button ws-danger"
                          disabled={demo || busy}
                          onClick={() => request('revoke', String(connection.id))}
                        >
                          Revoke connection
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {evidence && (
          <div className="ws-aws-evidence">
            <h3>Collected AWS evidence</h3>
            <p className="ws-operational-note">
              Read-only provider evidence. Engineering review is required before creating or
              validating an opportunity. No infrastructure changes or verified savings are implied.
            </p>
            {evidence.snapshots?.length ? (
              <div className="ws-table-wrap">
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Billing period</th>
                      <th>AWS service</th>
                      <th>Cost</th>
                      <th>Data state</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.snapshots.map((snapshot, index) => (
                      <tr key={String(snapshot.id || index)}>
                        <td>
                          {date(String(snapshot.period_start))} –{' '}
                          {date(String(snapshot.period_end))}
                        </td>
                        <td>{human(snapshot.service)}</td>
                        <td className="ws-number">
                          {money(snapshot.cost, String(snapshot.currency || 'USD'))}
                        </td>
                        <td>
                          <Status value={snapshot.estimated ? 'estimated' : 'final'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ws-quiet-empty">
                No billing snapshots have been collected for this connection.
              </p>
            )}
            <details className="ws-evidence-detail">
              <summary>
                Technical collection and inventory evidence ({evidence.checks?.length || 0})
              </summary>
              {evidence.checks?.map((check, index) => (
                <details key={String(check.id || index)}>
                  <summary>
                    {date(String(check.created_at || check.checked_at || ''))} ·{' '}
                    {check.success ? 'Collection record' : 'Validation diagnostic'}
                  </summary>
                  <pre>{JSON.stringify(check.detail, null, 2)}</pre>
                </details>
              ))}
            </details>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Billing({ workspace }: { workspace: Workspace }) {
  const paid = workspace.orders.filter((o) => o.status === 'paid');
  const totals = new Map<string, number>();
  paid.forEach((o) => totals.set(o.currency, (totals.get(o.currency) || 0) + o.amount));
  return (
    <>
      <div className="ws-metrics ws-metrics-three">
        <Metric
          label="Orders"
          value={workspace.orders.length}
          note="Persistent commercial order records"
          icon={CreditCard}
        />
        <Metric
          label="Paid orders"
          value={paid.length}
          note="Confirmed by verified provider events"
          icon={CheckCircle2}
        />
        <Metric
          label="Total paid"
          value={[...totals].map(([c, v]) => money(v, c, true)).join(' / ') || '—'}
          note="Currencies displayed separately"
          icon={TrendingUp}
        />
      </div>
      <Panel title="Order history">
        {workspace.orders.length ? (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Company</th>
                  <th>Amount</th>
                  <th>Ordered</th>
                  <th>Payment status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {workspace.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>
                        {order.offer === 'savings'
                          ? '14-Day AWS Savings Sprint'
                          : human(order.offer)}
                      </strong>
                      <small>{order.id}</small>
                    </td>
                    <td>
                      {order.company}
                      <small>{order.email}</small>
                    </td>
                    <td className="ws-number">{money(order.amount, order.currency, true)}</td>
                    <td>{date(order.createdAt)}</td>
                    <td>
                      <Status value={order.status} />
                    </td>
                    <td>
                      {order.receiptUrl ? (
                        <a
                          className="ws-text-button"
                          href={order.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View receipt <ArrowUpRight size={14} />
                        </a>
                      ) : (
                        <span className="ws-muted">
                          {order.status === 'paid'
                            ? 'Receipt processing'
                            : 'Available after payment'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={CreditCard}
            title="No orders yet"
            action={
              <Link href="/start" className="ws-button">
                Start your Savings Sprint <ArrowRight size={15} />
              </Link>
            }
          >
            Order confirmations and payment receipts will appear here after you place an order.
          </Empty>
        )}
      </Panel>
      <div className="ws-alert ws-alert-info">
        <LockKeyhole size={18} />
        <p>
          Payment details are handled by the payment provider. HKGpipi does not store card numbers.
          A redirect from checkout alone is never treated as payment confirmation.
        </p>
      </div>
    </>
  );
}

function Members({
  workspace,
  demo,
  onInvite,
  mutate,
}: {
  workspace: Workspace;
  demo: boolean;
  onInvite: () => void;
  mutate: Mutation;
}) {
  const canManage = workspace.isStaff || workspace.organisation?.role === 'owner';
  const [removing, setRemoving] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove(id: string) {
    setBusy(true);
    if (await mutate({ action: 'removeMember', id, data: {} })) setRemoving('');
    setBusy(false);
  }
  return (
    <>
      <Panel
        title="Organisation members"
        aside={
          canManage && (
            <button className="ws-button" onClick={onInvite} disabled={demo}>
              <Plus size={15} />
              Invite colleague
            </button>
          )
        }
      >
        {workspace.members.length ? (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  {canManage && <th>Access management</th>}
                </tr>
              </thead>
              <tbody>
                {workspace.members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="ws-member">
                        <span className="ws-avatar">{member.name.slice(0, 1)}</span>
                        <strong>{member.name}</strong>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>
                      <Status value={member.role} />
                    </td>
                    {canManage && (
                      <td>
                        {member.id !== workspace.user.id &&
                          (removing === member.id ? (
                            <div className="ws-actions">
                              <button
                                className="ws-text-button ws-danger"
                                disabled={busy}
                                onClick={() => remove(member.id)}
                              >
                                Confirm removal
                              </button>
                              <button className="ws-text-button" onClick={() => setRemoving('')}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="ws-text-button ws-danger"
                              disabled={demo || busy}
                              onClick={() => setRemoving(member.id)}
                            >
                              Remove access
                            </button>
                          ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Users} title="No members to display">
            Verified organisation members will be shown here.
          </Empty>
        )}
      </Panel>
      <div className="ws-permission-grid">
        <Panel>
          <h3>Organisation owner</h3>
          <p>
            Manages organisation settings and invitations, accepts engagement proposals and records
            approval decisions.
          </p>
        </Panel>
        <Panel>
          <h3>Engineering approver</h3>
          <p>
            Reviews specific remediation revisions and records customer-controlled approvals and
            deployments.
          </p>
        </Panel>
        <Panel>
          <h3>Viewer</h3>
          <p>
            Follows engagement progress, reviews published deliverables and participates in support.
          </p>
        </Panel>
        <Panel>
          <h3>Member</h3>
          <p>
            Contributes approved onboarding context and supporting documents, reviews delivery and
            works with support.
          </p>
        </Panel>
        <Panel>
          <h3>Billing</h3>
          <p>
            Reviews delivery and commercial records without engineering approval or onboarding write
            authority.
          </p>
        </Panel>
      </div>
      <div className="ws-alert ws-alert-info">
        <ShieldCheck size={18} />
        <p>
          Access is enforced on the server for every organisation record. Invitations require secure
          acceptance; knowing an engagement ID never grants access.
        </p>
      </div>
    </>
  );
}

function Settings({
  workspace,
  demo,
  onEdit,
}: {
  workspace: Workspace;
  demo: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      <div className="ws-two-columns">
        <Panel
          title="Organisation details"
          aside={
            (workspace.isStaff || workspace.organisation?.role === 'owner') && (
              <button className="ws-button ws-button-secondary" disabled={demo} onClick={onEdit}>
                <Pencil size={14} />
                Edit
              </button>
            )
          }
        >
          <dl className="ws-settings-list">
            <div>
              <dt>Organisation</dt>
              <dd>{workspace.organisation?.name || 'No organisation selected'}</dd>
            </div>
            <div>
              <dt>Notification email</dt>
              <dd>{human(workspace.settings.notificationEmail)}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>{human(workspace.organisation?.role)}</dd>
            </div>
            <div>
              <dt>Organisation ID</dt>
              <dd className="ws-mono">{workspace.organisation?.id || '—'}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Account security">
          <div className="ws-security-settings">
            <div className="ws-round-icon">
              <ShieldCheck size={25} />
            </div>
            <h3>Protect your account</h3>
            <p>
              Manage authenticator-based two-factor authentication and recovery codes. Administrator
              access requires two-factor authentication.
            </p>
            <Status value={workspace.user.twoFactorEnabled ? 'active' : 'pending'} />
            <Link className="ws-button ws-button-secondary" href="/account-security">
              Manage account security <ArrowUpRight size={15} />
            </Link>
            <small>Signed in as {workspace.user.email}</small>
          </div>
        </Panel>
      </div>
      <ProfileSettings workspace={workspace} demo={demo} />
      {workspace.isStaff && (
        <Panel title="Integration configuration">
          <div className="ws-integration-list">
            {Object.entries(workspace.capabilities).map(([capability, configured]) => (
              <div key={capability}>
                <strong>{human(capability)}</strong>
                <Status value={configured ? 'configured' : 'pending'} />
              </div>
            ))}
          </div>
          <p className="ws-operational-note">
            Configuration indicators do not certify provider connectivity. Real payment, AWS, email
            and secure file activity is verified by the corresponding workflow and operational
            records.
          </p>
        </Panel>
      )}
    </>
  );
}
function ProfileSettings({ workspace, demo }: { workspace: Workspace; demo: boolean }) {
  const [name, setName] = useState(workspace.user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return (
    <Panel title="Your account profile">
      <form
        className="ws-profile-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const result = await authClient.updateUser({ name });
            if (result.error) throw new Error(result.error.message);
            setMessage('Your display name has been updated.');
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Your profile could not be updated.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="ws-form-grid">
          <label className="ws-field">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
              disabled={demo}
            />
          </label>
          <label className="ws-field">
            Verified email
            <input value={workspace.user.email} readOnly />
            <small>Your verified sign-in email identifies your account.</small>
          </label>
        </div>
        {error && (
          <p className="ws-alert ws-alert-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="ws-alert ws-alert-success" role="status">
            {message}
          </p>
        )}
        <div className="ws-actions">
          <button className="ws-button" disabled={demo || busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <Link href="/forgot-password" className="ws-text-button">
            Reset your password <ArrowUpRight size={14} />
          </Link>
        </div>
      </form>
    </Panel>
  );
}
function Audit({ workspace }: { workspace: Workspace }) {
  return workspace.audit.length ? (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Actor</th>
            <th>When</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {workspace.audit.map((event) => (
            <tr key={event.id}>
              <td>
                <strong>{human(event.action)}</strong>
              </td>
              <td>{event.actor}</td>
              <td>{date(event.createdAt)}</td>
              <td>
                <details>
                  <summary>View details</summary>
                  <pre>{human(event.detail)}</pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty icon={Activity} title="No audit events to display">
      Account, commercial and engagement events are recorded as activity occurs.
    </Empty>
  );
}

type Enquiry = {
  id: string;
  name: string;
  email: string;
  company: string;
  message: string;
  status: string;
  version: number;
  assignee_id: string | null;
  created_at: string;
  messages: { id: string; body: string; author_name: string; created_at: string }[];
};
function Enquiries({ demo, workspace }: { demo: boolean; workspace: Workspace }) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(demo);
  const load = useCallback(async () => {
    const response = await fetch('/api/v1/enquiries', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Enquiries could not be loaded.');
    setEnquiries(data.enquiries);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (demo) return;
    let active = true;
    fetch('/api/v1/enquiries', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Enquiries could not be loaded.');
        if (active) {
          setEnquiries(data.enquiries);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (active)
          setError(error instanceof Error ? error.message : 'Enquiries could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [demo]);
  const enquiry = enquiries.find((e) => e.id === selected);
  const shown = enquiries.filter((e) =>
    `${e.name} ${e.email} ${e.company} ${e.message}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function update(action: 'reply' | 'status', data: Record<string, unknown>) {
    if (!enquiry) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: enquiry.id, version: enquiry.version, ...data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The enquiry could not be updated.');
      await load();
      if (action === 'reply') {
        setReply('');
        setMessage('Your reply has been saved and queued for email delivery.');
      } else setMessage('Enquiry status updated.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The enquiry could not be updated.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="ws-alert ws-alert-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="ws-alert ws-alert-success" role="status">
          {message}
        </div>
      )}
      {enquiry ? (
        <>
          <button className="ws-back-link ws-text-button" onClick={() => setSelected('')}>
            ← Back to enquiries
          </button>
          <Panel title={enquiry.company || enquiry.name} aside={<Status value={enquiry.status} />}>
            <div className="ws-enquiry-heading">
              <div>
                <strong>{enquiry.name}</strong>
                <span>{enquiry.email}</span>
                <small>Received {date(enquiry.created_at)}</small>
              </div>
              <div className="ws-actions">
                <label className="ws-field">
                  Enquiry status
                  <select
                    value={enquiry.status}
                    disabled={busy}
                    onChange={(e) => update('status', { status: e.target.value })}
                  >
                    {['new', 'in_progress', 'responded', 'resolved', 'spam'].map((status) => (
                      <option key={status} value={status}>
                        {human(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="ws-button ws-button-secondary"
                  disabled={busy || enquiry.assignee_id === workspace.user.id}
                  onClick={() =>
                    update('status', { status: enquiry.status, assigneeId: workspace.user.id })
                  }
                >
                  {enquiry.assignee_id === workspace.user.id ? 'Assigned to you' : 'Assign to me'}
                </button>
              </div>
            </div>
            <div className="ws-conversation">
              <article>
                <div className="ws-avatar">{enquiry.name.slice(0, 1)}</div>
                <div>
                  <strong>Original enquiry</strong>
                  <p>{enquiry.message}</p>
                </div>
              </article>
              {enquiry.messages.map((item) => (
                <article key={item.id}>
                  <div className="ws-avatar">{item.author_name?.slice(0, 1) || 'H'}</div>
                  <div>
                    <strong>{item.author_name || 'HKGpipi team'}</strong>
                    <small>{date(item.created_at)}</small>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void update('reply', { message: reply });
                }}
              >
                <label className="ws-field">
                  Reply to {enquiry.name}
                  <textarea
                    rows={5}
                    required
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a clear response. Your reply is saved and sent through the transactional email service."
                  />
                </label>
                <button className="ws-button" disabled={busy}>
                  <Send size={15} />
                  {busy ? 'Sending…' : 'Send enquiry reply'}
                </button>
              </form>
            </div>
          </Panel>
        </>
      ) : (
        <Panel
          title="Customer enquiry inbox"
          aside={<span className="ws-muted">{enquiries.length} enquiries</span>}
        >
          <div className="ws-table-tools">
            <label className="ws-search">
              <Search size={16} />
              <input
                aria-label="Search public enquiries"
                placeholder="Search name, company or message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {shown.length ? (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Contact / company</th>
                    <th>Enquiry</th>
                    <th>Received</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.company}</small>
                        <small>{item.email}</small>
                      </td>
                      <td>
                        <button className="ws-record-link" onClick={() => setSelected(item.id)}>
                          {item.message.slice(0, 100)}
                          {item.message.length > 100 ? '…' : ''}
                        </button>
                      </td>
                      <td>{date(item.created_at)}</td>
                      <td>
                        <Status value={item.status} />
                      </td>
                      <td>
                        <button
                          className="ws-icon-button"
                          aria-label={`Open enquiry from ${item.name}`}
                          onClick={() => setSelected(item.id)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={Inbox}
              title={
                demo
                  ? 'Enquiries remain private'
                  : loaded
                    ? 'No enquiries to display'
                    : 'Loading enquiries'
              }
            >
              {demo
                ? 'Illustrative previews do not expose prospective customer messages.'
                : loaded
                  ? 'New contact enquiries are persisted here with their message and operational state.'
                  : 'Loading persisted contact records.'}
            </Empty>
          )}
        </Panel>
      )}
    </>
  );
}

function Operations({ demo }: { demo: boolean }) {
  const [data, setData] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/v1/operations', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Operational queues could not be loaded.');
    setData(result);
  }, []);
  useEffect(() => {
    if (demo) return;
    let active = true;
    fetch('/api/v1/operations', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Operational queues could not be loaded.');
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Operational queues could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [demo]);
  async function retry(action: string, id: string, name?: string) {
    setBusy(id);
    setError('');
    try {
      const response = await fetch('/api/v1/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'This item could not be retried.');
      setMessage('The item has been queued for retry.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This item could not be retried.');
    } finally {
      setBusy('');
    }
  }
  const queues = [
    {
      key: 'mail',
      title: 'Transactional email',
      action: 'retryMail',
      description:
        'Undelivered messages remain visible until the configured mail service accepts them.',
    },
    {
      key: 'files',
      title: 'Secure file processing',
      action: 'retryScan',
      description: 'Quarantined files remain inaccessible until configured security checks pass.',
    },
    {
      key: 'jobs',
      title: 'Background jobs',
      action: 'retryJob',
      description:
        'Review failed work and retry it after resolving the underlying configuration or provider issue.',
    },
  ];
  return (
    <>
      {message && (
        <div className="ws-alert ws-alert-success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="ws-alert ws-alert-error" role="alert">
          {error}
        </div>
      )}
      {queues.map((queue) => (
        <Panel title={queue.title} key={queue.key}>
          <p className="ws-operational-note">{queue.description}</p>
          {!demo && data?.[queue.key]?.length ? (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>State</th>
                    <th>Last issue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data[queue.key].map((item) => (
                    <tr key={String(item.id)}>
                      <td>
                        <strong>
                          {human(item.subject || item.filename || item.name || item.id)}
                        </strong>
                        <small>
                          {human(item.to_email || item.organisation_id || item.created_at)}
                        </small>
                      </td>
                      <td>
                        <Status value={String(item.status || item.state || 'pending')} />
                      </td>
                      <td>
                        {human(
                          item.last_error ||
                            item.error ||
                            item.output ||
                            'Awaiting worker processing',
                        )}
                      </td>
                      <td>
                        <button
                          className="ws-text-button"
                          disabled={!!busy}
                          onClick={() =>
                            retry(queue.action, String(item.id), String(item.name || ''))
                          }
                        >
                          <RefreshCw size={13} className={busy === item.id ? 'ws-spin' : ''} />
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={CheckCircle2}
              title={
                demo
                  ? 'Operational data stays private'
                  : data
                    ? 'No items need review'
                    : 'Loading operational queue'
              }
            >
              {demo
                ? 'No real operational queues are connected to the illustrative workspace.'
                : data
                  ? 'Failures and work awaiting operational attention will appear here.'
                  : 'Checking persisted processing state.'}
            </Empty>
          )}
        </Panel>
      ))}
    </>
  );
}

function PaymentOperations({ demo }: { demo: boolean }) {
  const [data, setData] = useState<{
    orders: Record<string, unknown>[];
    events: Record<string, unknown>[];
    reconciliations: Record<string, unknown>[];
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch('/api/payments/reconcile', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment operations could not be loaded.');
      setData(result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment operations could not be loaded.');
    }
  }, [demo]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    fetch('/api/payments/reconcile', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Payment operations could not be loaded.');
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Payment operations could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [demo]);
  async function reconcile(orderId?: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Reconciliation failed.');
      setMessage(
        `Checked ${result.checked} payment record${result.checked === 1 ? '' : 's'}; ${result.failed} require follow-up. ${result.mode === 'local-test' ? 'Local test provider; no real payments.' : 'Provider payment states reconciled.'}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reconciliation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Payment operations & reconciliation"
      aside={
        <button
          className="ws-button ws-button-secondary"
          disabled={demo || busy}
          onClick={() => reconcile()}
        >
          <RefreshCw size={14} className={busy ? 'ws-spin' : ''} />
          {busy ? 'Reconciling…' : 'Reconcile payments'}
        </button>
      }
    >
      {message && (
        <div className="ws-alert ws-alert-success" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="ws-alert ws-alert-error" role="alert">
          {error}
        </div>
      )}
      {demo ? (
        <Empty icon={CreditCard} title="Live operational data stays separate">
          This illustrative workspace does not contain real payment events or reconciliation
          records.
        </Empty>
      ) : data ? (
        <>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Order / customer</th>
                  <th>Amount</th>
                  <th>Provider state</th>
                  <th>Last reconciled</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={String(order.id)}>
                    <td>
                      <strong>{human(order.company)}</strong>
                      <small>{human(order.email)}</small>
                      <small>{human(order.id)}</small>
                    </td>
                    <td className="ws-number">
                      {money(order.amount, String(order.currency || 'GBP'), true)}
                    </td>
                    <td>
                      <Status value={String(order.status)} />
                      {!!order.reconciliation_error && (
                        <small>{human(order.reconciliation_error)}</small>
                      )}
                    </td>
                    <td>{date(String(order.last_reconciled_at || ''))}</td>
                    <td>
                      <button
                        className="ws-text-button"
                        disabled={busy}
                        onClick={() => reconcile(String(order.id))}
                      >
                        Reconcile order <RefreshCw size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.orders.length && (
              <p className="ws-quiet-empty">No payment records require operational review.</p>
            )}
          </div>
          <details className="ws-payment-events">
            <summary>Provider event history ({data.events.length})</summary>
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Order</th>
                    <th>Received</th>
                    <th>Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={String(event.id)}>
                      <td>
                        <strong>{human(event.type)}</strong>
                        <small>{human(event.id)}</small>
                      </td>
                      <td>{human(event.order_id)}</td>
                      <td>{date(String(event.received_at || ''))}</td>
                      <td>{date(String(event.processed_at || ''))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="ws-operational-note">
            Reconciliation reads provider state and repairs missed updates. It does not create
            refunds or charges. Refunds and disputes follow the provider’s authorised operational
            controls.
          </p>
        </>
      ) : (
        <p className="ws-quiet-empty">Loading payment operations…</p>
      )}
    </Panel>
  );
}
