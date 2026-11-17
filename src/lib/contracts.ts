export const entityKinds = [
  'onboarding',
  'opportunity',
  'remediation',
  'approval',
  'deployment',
  'deliverable',
  'verification',
  'proposal',
  'support',
  'update',
] as const;
export type EntityKind = (typeof entityKinds)[number];
export type EntityRecord = {
  id: string;
  organisationId: string;
  engagementId: string | null;
  kind: EntityKind;
  title: string;
  status: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
export type Engagement = {
  id: string;
  organisationId: string;
  title: string;
  status: string;
  stage: string;
  createdAt: string;
  data: Record<string, unknown>;
};
export type Order = {
  id: string;
  organisationId: string | null;
  email: string;
  company: string;
  name: string;
  amount: number;
  currency: string;
  status: string;
  offer: string;
  createdAt: string;
  receiptUrl?: string | null;
};
export type Workspace = {
  user: { id: string; name: string; email: string; role: string; twoFactorEnabled?: boolean };
  organisation: { id: string; name: string; role: string } | null;
  organisations: { id: string; name: string; role: string }[];
  engagements: Engagement[];
  records: EntityRecord[];
  orders: Order[];
  members: { id: string; name: string; email: string; role: string }[];
  audit: { id: string; action: string; createdAt: string; actor: string; detail: unknown }[];
  settings: Record<string, unknown>;
  isStaff: boolean;
  capabilities: Record<string, boolean>;
};
