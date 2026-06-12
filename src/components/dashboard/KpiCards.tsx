import type { Expense } from '../../types/models';
import { groupByCurrency, groupByEmployee } from '../../lib/dashboardUtils';

interface Props {
  expenses: Expense[];
}

export default function KpiCards({ expenses }: Props) {
  const byCurrency = groupByCurrency(expenses);
  const byEmployee = groupByEmployee(expenses);

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(amount);
  }

  return (
    <section aria-label="KPIs">
      <div>
        <h2>Total pendiente</h2>
        {byCurrency.length === 0 ? (
          <p>Sin gastos pendientes</p>
        ) : (
          <ul>
            {byCurrency.map(({ currency, total }) => (
              <li key={currency}>{formatAmount(total, currency)}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2>Por empleado</h2>
        {byEmployee.length === 0 ? (
          <p>Sin gastos pendientes</p>
        ) : (
          <ul>
            {byEmployee.map(({ uid, name, totals }) => (
              <li key={uid}>
                <strong>{name}</strong>:{' '}
                {totals.map(({ currency, total }) => formatAmount(total, currency)).join(' · ')}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
