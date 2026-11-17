'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { X, LoaderCircle, Upload, ShieldCheck } from 'lucide-react';
import type { EntityKind, EntityRecord, Workspace } from '@/lib/contracts';
import { defaultData, entityLabels, fields, statusOptions, type Field } from './workspace-config';

export type Mutation = (body: Record<string, unknown>) => Promise<boolean>;
export type Editor =
  | { kind: EntityKind; record?: EntityRecord; initial?: Record<string, unknown> }
  | {
      kind: 'organisation' | 'engagement' | 'invite' | 'settings';
      initial?: Record<string, unknown>;
      record?: never;
    };
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog className="ws-dialog" ref={dialog} aria-labelledby={titleId} onCancel={onClose}>
      <div className="ws-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="ws-icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EditorModal({
  editor,
  workspace,
  engagementId,
  mutate,
  onClose,
  errorMessage,
}: {
  editor: Editor;
  errorMessage?: string;
  workspace: Workspace;
  engagementId: string;
  mutate: Mutation;
  onClose: () => void;
}) {
  const domain = editor.kind in fields;
  const entity = domain ? (editor.kind as EntityKind) : null;
  const existing = editor.record;
  const initial: Record<string, unknown> = {
    ...(entity ? defaultData(entity) : {}),
    ...(editor.initial || {}),
    ...(existing ? { ...existing.data, title: existing.title, status: existing.status } : {}),
  };
  if (entity === 'verification' && Array.isArray(initial.adjustments)) {
    const adjustments = initial.adjustments as { amount: number; description: string }[];
    initial.adjustments = adjustments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    initial.adjustmentReason = adjustments.map((item) => item.description).join('; ');
  }
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedEngagement, setSelectedEngagement] = useState(
    existing?.engagementId || engagementId || workspace.engagements[0]?.id || '',
  );
  const formFields: Field[] = entity
    ? fields[entity]
    : editor.kind === 'organisation'
      ? [{ name: 'name', label: 'Organisation name', required: true }]
      : editor.kind === 'engagement'
        ? [
            { name: 'title', label: 'Engagement name', required: true },
            { name: 'description', label: 'Engagement scope', type: 'textarea' },
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
            },
            {
              name: 'stage',
              label: 'Stage',
              type: 'select',
              options: ['Find', 'Validate', 'Assign', 'Change', 'Approve', 'Deploy', 'Verify'],
            },
          ]
        : editor.kind === 'invite'
          ? [
              { name: 'name', label: 'Name' },
              { name: 'email', label: 'Work email address', type: 'email', required: true },
              {
                name: 'role',
                label: 'Organisation role',
                type: 'select',
                options: ['viewer', 'member', 'approver', 'billing', 'owner'],
              },
            ]
          : [
              { name: 'name', label: 'Organisation name', required: true },
              { name: 'notificationEmail', label: 'Notification email', type: 'email' },
            ];
  const editableStatuses = entity
    ? entity === 'onboarding' && !workspace.isStaff
      ? ['draft', 'submitted']
      : ['remediation'].includes(entity)
        ? ['draft', 'in_review']
        : ['deliverable', 'verification', 'proposal', 'update'].includes(entity)
          ? ['draft']
          : statusOptions[entity]
    : [];
  const linkedKind: Record<string, EntityKind> = {
    opportunityId: 'opportunity',
    parentProposalId: 'proposal',
    verificationId: 'verification',
    remediationId: 'remediation',
    deploymentId: 'deployment',
  };
  const title = entity
    ? `${existing ? 'Edit' : 'New'} ${entityLabels[entity].toLowerCase()}`
    : editor.kind === 'organisation'
      ? 'Create organisation'
      : editor.kind === 'engagement'
        ? 'Create engagement'
        : editor.kind === 'invite'
          ? 'Invite a colleague'
          : 'Organisation settings';
  const change = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = { ...values };
    formFields.forEach((f) => {
      if (f.type === 'number' && data[f.name] !== '' && data[f.name] !== undefined)
        data[f.name] = Number(data[f.name]);
      if (f.type === 'select' && !data[f.name]) data[f.name] = f.options?.[0];
    });
    if (entity === 'verification') {
      const amount = Number(data.adjustments || 0);
      data.adjustments = amount
        ? [{ description: String(data.adjustmentReason || data.measurementBasis || ''), amount }]
        : [];
      delete data.adjustmentReason;
    }
    let body: Record<string, unknown> = { data, organisationId: workspace.organisation?.id };
    if (entity) {
      data.status =
        values.status && editableStatuses.includes(String(values.status))
          ? values.status
          : editableStatuses[0];
      body = {
        ...body,
        action: existing ? 'update' : 'create',
        entity,
        id: existing?.id,
        version: existing?.version,
        engagementId: selectedEngagement || undefined,
      };
    } else
      body.action =
        editor.kind === 'organisation'
          ? 'createOrganisation'
          : editor.kind === 'engagement'
            ? 'createEngagement'
            : editor.kind === 'invite'
              ? 'invite'
              : 'settings';
    try {
      if (await mutate(body)) onClose();
      else setError('The change could not be saved. Check the message on the page and try again.');
    } catch {
      setError('The change could not be saved. Please try again.');
    }
    setBusy(false);
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('organisationId', workspace.organisation?.id || '');
      if (selectedEngagement) body.set('engagementId', selectedEngagement);
      const response = await fetch('/api/v1/files', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      change(entity === 'onboarding' ? 'supportingFileId' : 'fileId', result.file.id);
      setUploadMessage(
        `${result.file.filename} uploaded. File status: ${result.file.status}. Files remain restricted until security checks pass.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
    setBusy(false);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="ws-editor">
        <p className="ws-muted">
          {entity === 'onboarding'
            ? 'Save your progress, then submit it for review. Never provide AWS access keys, secret keys or credentials.'
            : entity === 'verification'
              ? 'Verification requires a traceable baseline, the agreed observation period (30 days by default) and supported normalisation. Every alternative period needs recorded agreement evidence.'
              : entity === 'proposal'
                ? 'Commercial scope and terms must be approved before implementation becomes payable. Outcome-based work is never charged automatically.'
                : 'All changes are saved securely and recorded in the engagement audit trail.'}
        </p>
        {entity && (
          <>
            <label className="ws-field">
              Title
              <input
                name="title"
                required
                value={String(values.title || '')}
                onChange={(e) => change('title', e.target.value)}
              />
            </label>
            <div className="ws-form-grid">
              <label className="ws-field">
                Engagement
                <select
                  value={selectedEngagement}
                  onChange={(e) => setSelectedEngagement(e.target.value)}
                  required={entity !== 'support'}
                >
                  <option value="">Select an engagement</option>
                  {workspace.engagements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ws-field">
                Status
                <select
                  value={String(
                    values.status && editableStatuses.includes(String(values.status))
                      ? values.status
                      : editableStatuses[0],
                  )}
                  onChange={(e) => change('status', e.target.value)}
                >
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {formFields.map((field) => (
          <label
            className={`ws-field ${field.type === 'textarea' ? 'ws-field-wide' : ''}`}
            key={field.name}
          >
            {field.label}
            {linkedKind[field.name] ? (
              <select
                name={field.name}
                aria-label={field.label}
                aria-describedby={field.help ? `${field.name}-help` : undefined}
                required={field.required}
                value={String(values[field.name] || '')}
                onChange={(e) => change(field.name, e.target.value)}
              >
                <option value="">Select a linked {linkedKind[field.name]}</option>
                {workspace.records
                  .filter(
                    (record) =>
                      record.kind === linkedKind[field.name] &&
                      (!selectedEngagement || record.engagementId === selectedEngagement),
                  )
                  .map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.title}
                    </option>
                  ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                name={field.name}
                aria-label={field.label}
                aria-describedby={field.help ? `${field.name}-help` : undefined}
                rows={4}
                required={field.required}
                value={String(values[field.name] || '')}
                onChange={(e) => change(field.name, e.target.value)}
              />
            ) : field.type === 'select' ? (
              <select
                name={field.name}
                aria-label={field.label}
                aria-describedby={field.help ? `${field.name}-help` : undefined}
                value={String(values[field.name] || field.options?.[0] || '')}
                onChange={(e) => change(field.name, e.target.value)}
              >
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.name}
                aria-label={field.label}
                aria-describedby={field.help ? `${field.name}-help` : undefined}
                type={field.type || 'text'}
                step={field.type === 'number' ? 'any' : undefined}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] === undefined ? '' : String(values[field.name])}
                onChange={(e) => change(field.name, e.target.value)}
              />
            )}
            {field.help && <small id={`${field.name}-help`}>{field.help}</small>}
          </label>
        ))}
        {(entity === 'deliverable' || entity === 'onboarding') && (
          <div className="ws-upload">
            <ShieldCheck size={20} />
            <div>
              <strong>Secure document upload</strong>
              <p>
                PDF, images, text, CSV and supported document formats. Never upload credentials.
              </p>
              <label className="ws-button ws-button-secondary">
                <Upload size={16} /> Choose file
                <input
                  type="file"
                  onChange={(e) => upload(e.target.files?.[0])}
                  disabled={busy}
                  accept=".pdf,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.json"
                  className="ws-visually-hidden"
                />
              </label>
              {uploadMessage && (
                <p className="ws-success" role="status">
                  {uploadMessage}
                </p>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="ws-alert ws-alert-error" role="alert">
            {errorMessage || error}
          </div>
        )}
        <footer className="ws-dialog-footer">
          <button type="button" className="ws-button ws-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ws-button" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="ws-spin" /> : null}
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Save record'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function ActionModal({
  title,
  description,
  fields: actionFields,
  onSubmit,
  onClose,
  errorMessage,
}: {
  title: string;
  description: string;
  errorMessage?: string;
  fields: Field[];
  onSubmit: (data: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (await onSubmit(data)) onClose();
    else setError('This action could not be completed. Review the page message and try again.');
    setBusy(false);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="ws-editor">
        <p className="ws-muted">{description}</p>
        {actionFields.map((f) => (
          <label className="ws-field" key={f.name}>
            {f.label}
            {f.type === 'select' ? (
              <select
                value={String(data[f.name] || '')}
                onChange={(e) => setData((v) => ({ ...v, [f.name]: e.target.value }))}
              >
                <option value="">Keep current value</option>
                {f.options?.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                required={f.required}
                rows={4}
                value={String(data[f.name] || '')}
                onChange={(e) => setData((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            ) : (
              <input
                type={f.type || 'text'}
                required={f.required}
                value={String(data[f.name] || '')}
                onChange={(e) => setData((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {error && (
          <div className="ws-alert ws-alert-error" role="alert">
            {errorMessage || error}
          </div>
        )}
        <footer className="ws-dialog-footer">
          <button type="button" className="ws-button ws-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="ws-button" disabled={busy}>
            {busy ? 'Working…' : title}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
