import type { ComponentChildren } from 'preact';
import type { ExpenseStatus } from '../../types/models';

export type BadgeVariant = 'accent' | 'success' | 'warning' | 'error' | 'pending';

interface Props {
  variant: BadgeVariant;
  children: ComponentChildren;
}

export function Badge({ variant, children }: Props) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

const STATUS_MAP: Record<ExpenseStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pendiente', variant: 'pending' },
  paid: { label: 'Pagado', variant: 'success' },
};

export function statusBadge(status: ExpenseStatus): { label: string; variant: BadgeVariant } {
  return STATUS_MAP[status] ?? { label: 'Pendiente', variant: 'pending' };
}
