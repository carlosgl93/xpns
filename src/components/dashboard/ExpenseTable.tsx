// Desktop-only expense table. Sticky header, 44px rows, hover = surface-2.
// Columns: Fecha | Empleado (admin) | Categoría | Descripción | Origen | Monto | Estado | Acciones (admin)

import { useState } from 'preact/hooks';
import type { Expense, ExpenseStatus, PaymentSource } from '../../types/models';
import { ExpenseCategory } from '../../types/models';
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

const STATUS_SHORT_LABEL: Record<ExpenseStatus, string> = {
  pending: 'A reembolsar',
  paid: 'Pagado',
};

function formatDate(ts: any): string {
  if (!ts?.seconds) return '';
  const d = new Date(ts.seconds * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function statusBadge(status: ExpenseStatus) {
  if (status === 'paid') return { label: STATUS_SHORT_LABEL.paid, variant: 'success' as const };
  return { label: STATUS_SHORT_LABEL.pending, variant: 'accent' as const };
}

interface Props {
  expenses: Expense[];
  isAdmin: boolean;
  onMarkPaid: (expenseId: string) => Promise<void>;
}

export default function ExpenseTable({ expenses, isAdmin, onMarkPaid }: Props) {
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  async function handleMarkPaid(expenseId: string) {
    setMarkingPaid(expenseId);
    try {
      await onMarkPaid(expenseId);
    } finally {
      setMarkingPaid(null);
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="dashboard-table-wrap">
        <p className="status-empty">Sin gastos</p>
      </div>
    );
  }

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th className="mono">Fecha</th>
            {isAdmin && <th>Empleado</th>}
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Origen</th>
            <th className="r mono">Monto</th>
            <th>Estado</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => {
            const badge = statusBadge(e.status);
            return (
              <tr key={e.id}>
                <td className="mono">{formatDate(e.date)}</td>
                {isAdmin && <td>{e.submitterName}</td>}
                <td>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                <td className="comercio">{e.description}</td>
                <td>{PAYMENT_SOURCE_LABELS[e.paymentSource as PaymentSource] ?? e.paymentSource}</td>
                <td className="mono r">{formatCLPDense(e.amount, e.currency)}</td>
                <td>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
                {isAdmin && (
                  <td>
                    {e.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={markingPaid === e.id}
                        onClick={() => handleMarkPaid(e.id!)}
                      >
                        {markingPaid === e.id ? 'Guardando…' : 'Marcar pagado'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
