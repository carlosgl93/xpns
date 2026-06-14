import type { Expense } from '../types/models';
import { PAYMENT_SOURCE_GROUP, PAYMENT_SOURCE_LABELS } from './paymentSources';

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

function groupPendingByEmployee(
  expenses: Expense[],
  group: 'corporate' | 'personal'
): EmployeeTotal[] {
  const byUid = new Map<string, { name: string; amounts: Map<string, number> }>();
  for (const e of expenses) {
    if (e.status !== 'pending') continue;
    if (PAYMENT_SOURCE_GROUP[e.paymentSource] !== group) continue;
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

export function groupByReimbursableByEmployee(expenses: Expense[]): EmployeeTotal[] {
  return groupPendingByEmployee(expenses, 'personal');
}

export function groupByCorporateByEmployee(expenses: Expense[]): EmployeeTotal[] {
  return groupPendingByEmployee(expenses, 'corporate');
}

function csvCell(value: string | number): string {
  let str = String(value);
  // Prevent formula injection in Excel/Sheets
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[,"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generateCsv(expenses: Expense[]): string {
  const header = ['fecha', 'empleado', 'categoria', 'origen_pago', 'descripcion', 'monto', 'moneda', 'estado'];
  const rows = expenses.map((e) => {
    const date = e.date
      ? new Date((e.date as any).seconds * 1000).toISOString().split('T')[0]
      : '';
    return [
      csvCell(date!),
      csvCell(e.submitterName),
      csvCell(e.category),
      csvCell(PAYMENT_SOURCE_LABELS[e.paymentSource] ?? e.paymentSource),
      csvCell(e.description),
      csvCell(e.amount),
      csvCell(e.currency),
      csvCell(e.status),
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}
