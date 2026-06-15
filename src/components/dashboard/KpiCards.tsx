// Admin-only KPI strip.
// Mobile: 1-col, stacked, sits between filter chips and card list.
// Desktop: 2-col, side-by-side.
// Values animate from 0 to target with useCountUp. Respects reduced motion.

import type { Expense } from '../../types/models';
import { useCountUp } from '../../hooks/useCountUp';
import { groupReimbursableTotal, groupCorporateTotal } from '../../lib/dashboardUtils';
import { formatCLP, formatCLPDense } from '../../lib/format';

interface Props {
  expenses: Expense[];
}

interface KpiDatum {
  currency: string;
  total: number;
  count: number;
}

function countByCurrency(expenses: Expense[], predicate: (e: Expense) => boolean): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.status !== 'pending') continue;
    if (!predicate(e)) continue;
    map.set(e.currency, (map.get(e.currency) ?? 0) + 1);
  }
  return map;
}

function formatTotals(items: KpiDatum[], formatter: (v: number, c: string) => string): string {
  if (items.length === 0) return '—';
  return items.map(({ currency, total }) => formatter(total, currency)).join(' · ');
}

function formatCount(items: KpiDatum[]): string {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return '0 gastos pendientes';
  return `${total} ${total === 1 ? 'gasto pendiente' : 'gastos pendientes'}`;
}

export default function KpiCards({ expenses }: Props) {
  const reimbursable = groupReimbursableTotal(expenses);
  const corporate = groupCorporateTotal(expenses);

  const reimbursableCounts = countByCurrency(
    expenses,
    (e) =>
      e.paymentSource === 'personal_credit' ||
      e.paymentSource === 'personal_debit' ||
      e.paymentSource === 'cash',
  );
  const corporateCounts = countByCurrency(
    expenses,
    (e) => e.paymentSource === 'corporate_credit' || e.paymentSource === 'corporate_debit',
  );

  const rData: KpiDatum[] = reimbursable.map(({ currency, total }) => ({
    currency,
    total,
    count: reimbursableCounts.get(currency) ?? 0,
  }));
  const cData: KpiDatum[] = corporate.map(({ currency, total }) => ({
    currency,
    total,
    count: corporateCounts.get(currency) ?? 0,
  }));

  // Animate the first (largest) total per group; sum across currencies if multiple.
  const rPrimary = rData[0]?.total ?? 0;
  const cPrimary = cData[0]?.total ?? 0;

  const rAnim = useCountUp(rPrimary);
  const cAnim = useCountUp(cPrimary);

  // For multi-currency totals we can't animate an aggregated string reliably, so
  // we render the dense formatted string (which doesn't animate) when there are
  // multiple currencies. The mono class gives tabular alignment either way.
  const rDisplay = rData.length === 1
    ? formatCLP(rAnim, rData[0]!.currency)
    : formatCLP(rPrimary, rData[0]?.currency ?? 'CLP');
  const cDisplay = cData.length === 1
    ? formatCLP(cAnim, cData[0]!.currency)
    : formatCLP(cPrimary, cData[0]?.currency ?? 'CLP');

  const rSubMulti = rData.length > 1 ? formatTotals(rData, formatCLPDense) : null;
  const cSubMulti = cData.length > 1 ? formatTotals(cData, formatCLPDense) : null;

  if (rData.length === 0 && cData.length === 0) {
    return (
      <div className="kpi-mobile mobile-only" aria-label="KPIs">
        <div className="kpi-label">A reembolsar</div>
        <div className="kpi-value">{formatCLP(0, 'CLP')}</div>
        <div className="kpi-sub">Sin gastos pendientes</div>
      </div>
    );
  }

  return (
    <>
      <div className="mobile-only">
        <div className="kpi-mobile" aria-label="KPI a reembolsar">
          <div className="kpi-label">A reembolsar</div>
          <div className="kpi-value">{rDisplay}</div>
          {rSubMulti ? (
            <div className="kpi-sub mono">{rSubMulti}</div>
          ) : (
            <div className="kpi-sub">{formatCount(rData)}</div>
          )}
        </div>
        <div className="kpi-mobile" aria-label="KPI tarjeta corporativa">
          <div className="kpi-label">Tarjeta corporativa</div>
          <div className="kpi-value">{cDisplay}</div>
          {cSubMulti ? (
            <div className="kpi-sub mono">{cSubMulti}</div>
          ) : (
            <div className="kpi-sub">{formatCount(cData)}</div>
          )}
        </div>
      </div>

      <div className="dashboard-kpis desktop-only">
        <div>
          <div className="kpi-label">A reembolsar</div>
          <div className="kpi-value">{rDisplay}</div>
          {rSubMulti ? (
            <div className="kpi-sub mono">{rSubMulti}</div>
          ) : (
            <div className="kpi-sub">{formatCount(rData)}</div>
          )}
        </div>
        <div>
          <div className="kpi-label">Saldo tarjeta corporativa usado</div>
          <div className="kpi-value">{cDisplay}</div>
          {cSubMulti ? (
            <div className="kpi-sub mono">{cSubMulti}</div>
          ) : (
            <div className="kpi-sub">{formatCount(cData)}</div>
          )}
        </div>
      </div>
    </>
  );
}
