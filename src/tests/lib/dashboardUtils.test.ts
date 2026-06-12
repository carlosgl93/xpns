import { describe, it, expect } from 'vitest';
import {
  groupByCurrency,
  groupByEmployee,
  generateCsv,
} from '../../lib/dashboardUtils';
import type { Expense } from '../../types/models';
import { ExpenseCategory } from '../../types/models';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    submittedBy: 'user-1',
    submitterName: 'Ana',
    amount: 1000,
    currency: 'CLP',
    category: ExpenseCategory.Food,
    description: 'Almuerzo',
    receiptStoragePath: 'orgs/org-1/receipts/exp-1/r.jpg',
    status: 'pending',
    date: { seconds: 1700000000, nanoseconds: 0 } as any,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  };
}

// ─── groupByCurrency ───────────────────────────────────────────────────────

describe('groupByCurrency', () => {
  it('returns empty array for no expenses', () => {
    expect(groupByCurrency([])).toEqual([]);
  });

  it('sums amounts for a single currency', () => {
    const expenses = [
      makeExpense({ amount: 1000, currency: 'CLP' }),
      makeExpense({ amount: 2000, currency: 'CLP' }),
    ];
    expect(groupByCurrency(expenses)).toEqual([{ currency: 'CLP', total: 3000 }]);
  });

  it('keeps separate totals for different currencies', () => {
    const expenses = [
      makeExpense({ amount: 1000, currency: 'CLP' }),
      makeExpense({ amount: 100, currency: 'USD' }),
    ];
    const result = groupByCurrency(expenses);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ currency: 'CLP', total: 1000 });
    expect(result).toContainEqual({ currency: 'USD', total: 100 });
  });

  it('excludes paid expenses from totals', () => {
    const expenses = [
      makeExpense({ amount: 1000, currency: 'CLP', status: 'pending' }),
      makeExpense({ amount: 500, currency: 'CLP', status: 'paid' }),
    ];
    expect(groupByCurrency(expenses)).toEqual([{ currency: 'CLP', total: 1000 }]);
  });

  it('returns empty array when all expenses are paid', () => {
    const expenses = [makeExpense({ status: 'paid' })];
    expect(groupByCurrency(expenses)).toEqual([]);
  });
});

// ─── groupByEmployee ───────────────────────────────────────────────────────

describe('groupByEmployee', () => {
  it('returns empty array for no expenses', () => {
    expect(groupByEmployee([])).toEqual([]);
  });

  it('groups pending expenses by submittedBy uid', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, currency: 'CLP' }),
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 2000, currency: 'CLP' }),
    ];
    const result = groupByEmployee(expenses);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ uid: 'user-1', name: 'Ana' });
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 3000 });
  });

  it('returns separate entries for different employees', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, currency: 'CLP' }),
      makeExpense({ submittedBy: 'user-2', submitterName: 'Bruno', amount: 200, currency: 'USD' }),
    ];
    const result = groupByEmployee(expenses);
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.uid)).toContain('user-1');
    expect(result.map((e) => e.uid)).toContain('user-2');
  });

  it('excludes paid expenses from employee totals', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, status: 'pending' }),
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 500, status: 'paid' }),
    ];
    const result = groupByEmployee(expenses);
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 1000 });
  });

  it('groups by currency within an employee', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, currency: 'CLP' }),
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 50, currency: 'USD' }),
    ];
    const result = groupByEmployee(expenses);
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 1000 });
    expect(result[0]!.totals).toContainEqual({ currency: 'USD', total: 50 });
  });
});

// ─── generateCsv ─────────────────────────────────────────────────────────

describe('generateCsv', () => {
  it('returns header row when no expenses', () => {
    const csv = generateCsv([]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('fecha');
    expect(lines[0]).toContain('empleado');
    expect(lines[0]).toContain('categoria');
    expect(lines[0]).toContain('descripcion');
    expect(lines[0]).toContain('monto');
    expect(lines[0]).toContain('moneda');
    expect(lines[0]).toContain('estado');
  });

  it('has exactly one data row per expense', () => {
    const expenses = [makeExpense(), makeExpense({ id: 'exp-2' })];
    const csv = generateCsv(expenses);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('includes correct values in data row', () => {
    const expense = makeExpense({
      amount: 5000,
      currency: 'CLP',
      submitterName: 'Carlos',
      category: ExpenseCategory.Transport,
      description: 'Taxi aeropuerto',
      status: 'pending',
    });
    const csv = generateCsv([expense]);
    expect(csv).toContain('5000');
    expect(csv).toContain('CLP');
    expect(csv).toContain('Carlos');
    expect(csv).toContain('transport');
    expect(csv).toContain('Taxi aeropuerto');
    expect(csv).toContain('pending');
  });

  it('wraps description in quotes to handle commas', () => {
    const expense = makeExpense({ description: 'Taxi, ida y vuelta' });
    const csv = generateCsv([expense]);
    expect(csv).toContain('"Taxi, ida y vuelta"');
  });

  it('prefixes formula-starting cells with a single quote to prevent injection', () => {
    const expense = makeExpense({ description: '=SUM(A1:A10)', submitterName: '+malicious' });
    const csv = generateCsv([expense]);
    expect(csv).toContain("'=SUM(A1:A10)");
    expect(csv).toContain("'+malicious");
  });
});
