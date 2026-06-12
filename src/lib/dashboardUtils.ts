import type { Expense } from '../types/models';

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface EmployeeTotal {
  uid: string;
  name: string;
  totals: CurrencyTotal[];
}

export function groupByCurrency(expenses: Expense[]): CurrencyTotal[] {
  const pending = expenses.filter((e) => e.status === 'pending');
  const map = new Map<string, number>();
  for (const e of pending) {
    map.set(e.currency, (map.get(e.currency) ?? 0) + e.amount);
  }
  return Array.from(map.entries()).map(([currency, total]) => ({ currency, total }));
}

export function groupByEmployee(expenses: Expense[]): EmployeeTotal[] {
  const pending = expenses.filter((e) => e.status === 'pending');
  const byUid = new Map<string, { name: string; amounts: Map<string, number> }>();
  for (const e of pending) {
    if (!byUid.has(e.submittedBy)) {
      byUid.set(e.submittedBy, { name: e.submitterName, amounts: new Map() });
    }
    const entry = byUid.get(e.submittedBy)!;
    entry.amounts.set(e.currency, (entry.amounts.get(e.currency) ?? 0) + e.amount);
  }
  return Array.from(byUid.entries()).map(([uid, { name, amounts }]) => ({
    uid,
    name,
    totals: Array.from(amounts.entries()).map(([currency, total]) => ({ currency, total })),
  }));
}

function csvCell(value: string | number): string {
  const str = String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

export function generateCsv(expenses: Expense[]): string {
  const header = ['fecha', 'empleado', 'categoria', 'descripcion', 'monto', 'moneda', 'estado'];
  const rows = expenses.map((e) => {
    const date = e.date
      ? new Date((e.date as any).seconds * 1000).toISOString().split('T')[0]
      : '';
    return [
      csvCell(date!),
      csvCell(e.submitterName),
      csvCell(e.category),
      csvCell(e.description),
      csvCell(e.amount),
      csvCell(e.currency),
      csvCell(e.status),
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}
