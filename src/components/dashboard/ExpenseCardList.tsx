// Mobile/tablet card list for expenses. Each card has 3 rows per the design:
//   row-1: comercio (left) + monto (right)
//   row-2 (first): category · payment source
//   row-2 (second): date · submitter · status badge
// Tapping a card is a no-op for now (detail view is a follow-up).

import type { Expense, ExpenseStatus } from '../../types/models';
import { PaymentSource, ExpenseCategory } from '../../types/models';
import { PAYMENT_SOURCE_LABELS } from '../../lib/paymentSources';
import { formatCLPDense } from '../../lib/format';
import { Badge } from '../ui/Badge';

const CATEGORY_LABELS: Record<string, string> = {
  [ExpenseCategory.Food]: 'Comida',
  [ExpenseCategory.Lodging]: 'Alojamiento',
  [ExpenseCategory.Transport]: 'Transporte',
  [ExpenseCategory.Entertainment]: 'Entretenimiento',
  [ExpenseCategory.Other]: 'Otro',
};

function formatDate(ts: any): string {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function shortSubmitter(name: string): string {
  if (!name) return '';
  // "C. Pérez" style: take first letter of first whitespace-separated word + " " + last token.
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first[0]}. ${last}`;
}

function statusBadgeFor(status: ExpenseStatus) {
  if (status === 'paid') return { label: 'Pagado', variant: 'success' as const };
  return { label: 'A reembolsar', variant: 'accent' as const };
}

interface Props {
  expenses: Expense[];
}

export default function ExpenseCardList({ expenses }: Props) {
  if (expenses.length === 0) {
    return <p className="status-empty">Sin gastos</p>;
  }

  return (
    <div className="card-list">
      {expenses.map((e) => {
        const badge = statusBadgeFor(e.status);
        return (
          <a key={e.id} className="expense-card" href="#">
            <div className="row-1">
              <span className="comercio">{e.description || '—'}</span>
              <span className="monto">{formatCLPDense(e.amount, e.currency)}</span>
            </div>
            <div className="row-2">
              <span className="left">
                {CATEGORY_LABELS[e.category] ?? e.category} · {PAYMENT_SOURCE_LABELS[e.paymentSource as PaymentSource] ?? e.paymentSource}
              </span>
            </div>
            <div className="row-2">
              <span className="left mono" style={{ color: 'var(--ink-muted)', fontSize: 12 }}>
                {formatDate(e.date)} · {shortSubmitter(e.submitterName)}
              </span>
              <span className="right">
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
