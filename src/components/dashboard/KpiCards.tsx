import type { Expense } from '../../types/models';
import { groupByReimbursableByEmployee, groupByCorporateByEmployee } from '../../lib/dashboardUtils';

interface Props {
  expenses: Expense[];
}

export default function KpiCards({ expenses }: Props) {
  const reimbursable = groupByReimbursableByEmployee(expenses);
  const corporate = groupByCorporateByEmployee(expenses);

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(amount);
  }

  const isEmpty = reimbursable.length === 0 && corporate.length === 0;

  return (
    <section aria-label="KPIs">
      {isEmpty && <p>Sin gastos pendientes</p>}

      <div>
        <h2>A reembolsar</h2>
        {reimbursable.length === 0 ? null : (
          <ul>
            {reimbursable.map(({ uid, name, totals }) => (
              <li key={uid}>
                <strong>{name}</strong>:{' '}
                {totals.map(({ currency, total }) => formatAmount(total, currency)).join(' · ')}
              </li>
            ))}
          </ul>
        )}
        <p><small>Pagos con tarjeta personal o efectivo — el admin debe reembolsar al empleado.</small></p>
      </div>

      <div>
        <h2>Saldo tarjeta corporativa usado</h2>
        {corporate.length === 0 ? null : (
          <ul>
            {corporate.map(({ uid, name, totals }) => (
              <li key={uid}>
                <strong>{name}</strong>:{' '}
                {totals.map(({ currency, total }) => formatAmount(total, currency)).join(' · ')}
              </li>
            ))}
          </ul>
        )}
        <p><small>Pagos con tarjeta corporativa — ya pagados por la empresa, no se reembolsan.</small></p>
      </div>
    </section>
  );
}
