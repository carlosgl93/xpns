import { useState } from 'preact/hooks';
import type { Expense, PaymentSource } from '../../types/models';
import { ExpenseCategory } from '../../types/models';
import type { ExpenseFilters } from '../../hooks/useExpenses';
import type { OrgMember } from '../../types/models';
import { PAYMENT_SOURCE_LABELS } from '../../lib/paymentSources';

interface Props {
  expenses: Expense[];
  members: OrgMember[];
  isAdmin: boolean;
  onMarkPaid: (expenseId: string) => Promise<void>;
  onFiltersChange: (filters: ExpenseFilters) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  [ExpenseCategory.Food]: 'Comida',
  [ExpenseCategory.Lodging]: 'Alojamiento',
  [ExpenseCategory.Transport]: 'Transporte',
  [ExpenseCategory.Entertainment]: 'Entretenimiento',
  [ExpenseCategory.Other]: 'Otro',
};

export default function ExpenseTable({ expenses, members, isAdmin, onMarkPaid, onFiltersChange }: Props) {
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  function updateFilter<K extends keyof ExpenseFilters>(key: K, value: ExpenseFilters[K]) {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    onFiltersChange(next);
  }

  async function handleMarkPaid(expenseId: string) {
    setMarkingPaid(expenseId);
    try {
      await onMarkPaid(expenseId);
    } finally {
      setMarkingPaid(null);
    }
  }

  function formatDate(ts: any): string {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleDateString('es-CL');
  }

  return (
    <div>
      <div aria-label="Filtros">
        {isAdmin && (
          <select
            aria-label="Filtrar por empleado"
            onChange={(e) => updateFilter('submittedBy', (e.target as HTMLSelectElement).value || undefined)}
          >
            <option value="">Todos los empleados</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        )}

        <select
          aria-label="Filtrar por categoría"
          onChange={(e) => updateFilter('category', (e.target as HTMLSelectElement).value || undefined)}
        >
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          aria-label="Filtrar por estado"
          onChange={(e) =>
            updateFilter('status', ((e.target as HTMLSelectElement).value || undefined) as any)
          }
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="paid">Pagado</option>
        </select>

        <select
          aria-label="Filtrar por origen de pago"
          onChange={(e) =>
            updateFilter('paymentSource', ((e.target as HTMLSelectElement).value || undefined) as any)
          }
        >
          <option value="">Todos los orígenes de pago</option>
          {Object.entries(PAYMENT_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            {isAdmin && <th>Empleado</th>}
            <th>Categoría</th>
            <th>Origen de pago</th>
            <th>Descripción</th>
            <th>Monto</th>
            <th>Estado</th>
            {isAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 8 : 6}>Sin gastos</td>
            </tr>
          ) : (
            expenses.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.date)}</td>
                {isAdmin && <td>{e.submitterName}</td>}
                <td>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                <td>{PAYMENT_SOURCE_LABELS[e.paymentSource as PaymentSource] ?? e.paymentSource}</td>
                <td>{e.description}</td>
                <td>
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: e.currency }).format(e.amount)}
                </td>
                <td>{e.status === 'pending' ? 'Pendiente' : 'Pagado'}</td>
                {isAdmin && (
                  <td>
                    {e.status === 'pending' && (
                      <button
                        type="button"
                        disabled={markingPaid === e.id}
                        onClick={() => handleMarkPaid(e.id!)}
                      >
                        {markingPaid === e.id ? 'Guardando...' : 'Marcar pagado'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
