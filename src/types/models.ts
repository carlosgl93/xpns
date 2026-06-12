import type { Timestamp } from 'firebase/firestore';

export interface Org {
  id?: string;
  name: string;
  ownerEmail: string;
  plan: string;
  createdAt: Timestamp;
  defaultCurrency: string;
}

export type MemberRole = 'admin' | 'employee';
export type MemberStatus = 'active' | 'invited';

export interface OrgMember {
  id?: string;
  email: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: Timestamp;
}

export interface Invite {
  id?: string;
  orgId: string;
  email?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt?: Timestamp;
  usedBy?: string;
}

export enum ExpenseCategory {
  Food = 'food',
  Lodging = 'lodging',
  Transport = 'transport',
  Entertainment = 'entertainment',
  Other = 'other',
}

export type ExpenseStatus = 'pending' | 'paid';

export interface Expense {
  id?: string;
  submittedBy: string;
  submitterName: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  receiptStoragePath: string;
  status: ExpenseStatus;
  date: Timestamp;
  createdAt: Timestamp;
  paidAt?: Timestamp;
}

export type ExpenseWrite = Omit<Expense, 'id' | 'createdAt'>;
export type OrgWrite = Omit<Org, 'id' | 'createdAt'>;
export type InviteWrite = Omit<Invite, 'id' | 'usedAt' | 'usedBy'>;
