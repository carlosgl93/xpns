// new tests for groupReimbursableTotal / groupCorporateTotal go at the end
import { describe, it, expect } from 'vitest';
import {
  groupByCurrency,
  groupByEmployee,
  groupByReimbursableByEmployee,
  groupByCorporateByEmployee,
  generateCsv,
  groupReimbursableTotal,
  groupCorporateTotal,
} from '../../lib/dashboardUtils';
import type { Expense, PaymentSource } from '../../types/models';
import { ExpenseCategory, PaymentSource as PS } from '../../types/models';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    submittedBy: 'user-1',
    submitterName: 'Ana',
    amount: 1000,
    currency: 'CLP',
    category: ExpenseCategory.Food,
    paymentSource: PS.CorporateCredit,
    description: 'Almuerzo',
    receiptStoragePath: 'orgs/org-1/receipts/exp-1/r.jpg',
    status: 'pending',
    date: { seconds: 1700000000, nanoseconds: 0 } as any,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as any,
    ...overrides,
  };
}

// (existing tests preserved — copy from prior file content)
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

describe('groupByReimbursableByEmployee', () => {
  it('returns empty array for no expenses', () => {
    expect(groupByReimbursableByEmployee([])).toEqual([]);
  });

  it('groups personal + cash pending expenses, excludes corporate', () => {
    const expenses = [
      makeExpense({ id: 'c', submittedBy: 'user-1', submitterName: 'Ana', amount: 5000, paymentSource: PS.CorporateCredit }),
      makeExpense({ id: 'pc', submittedBy: 'user-1', submitterName: 'Ana', amount: 2000, paymentSource: PS.PersonalCredit }),
      makeExpense({ id: 'ca', submittedBy: 'user-1', submitterName: 'Ana', amount: 800, paymentSource: PS.Cash }),
    ];
    const result = groupByReimbursableByEmployee(expenses);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ uid: 'user-1', name: 'Ana' });
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 2800 });
  });

  it('excludes paid expenses', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, paymentSource: PS.PersonalCredit }),
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 500, paymentSource: PS.PersonalCredit, status: 'paid' }),
    ];
    const result = groupByReimbursableByEmployee(expenses);
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 1000 });
  });
});

describe('groupByCorporateByEmployee', () => {
  it('returns empty array for no expenses', () => {
    expect(groupByCorporateByEmployee([])).toEqual([]);
  });

  it('groups corporate pending expenses, excludes personal and cash', () => {
    const expenses = [
      makeExpense({ id: 'cc', submittedBy: 'user-1', submitterName: 'Ana', amount: 5000, paymentSource: PS.CorporateCredit }),
      makeExpense({ id: 'cd', submittedBy: 'user-1', submitterName: 'Ana', amount: 3000, paymentSource: PS.CorporateDebit }),
      makeExpense({ id: 'pc', submittedBy: 'user-1', submitterName: 'Ana', amount: 2000, paymentSource: PS.PersonalCredit }),
      makeExpense({ id: 'ca', submittedBy: 'user-1', submitterName: 'Ana', amount: 800, paymentSource: PS.Cash }),
    ];
    const result = groupByCorporateByEmployee(expenses);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ uid: 'user-1', name: 'Ana' });
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 8000 });
  });

  it('excludes paid expenses', () => {
    const expenses = [
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 1000, paymentSource: PS.CorporateCredit }),
      makeExpense({ submittedBy: 'user-1', submitterName: 'Ana', amount: 500, paymentSource: PS.CorporateCredit, status: 'paid' }),
    ];
    const result = groupByCorporateByEmployee(expenses);
    expect(result[0]!.totals).toContainEqual({ currency: 'CLP', total: 1000 });
  });
});

describe('generateCsv', () => {
  it('returns header row when no expenses', () => {
    const csv = generateCsv([]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('fecha');
    expect(lines[0]).toContain('empleado');
    expect(lines[0]).toContain('categoria');
    expect(lines[0]).toContain('origen_pago');
    expect(lines[0]).toContain('descripcion');
    expect(lines[0]).toContain('monto');
    expect(lines[0]).toContain('moneda');
    expect(lines[0]).toContain('estado');
  });

  it('has exactly one data row per expense', () => {
    const expenses = [makeExpense(), makeExpense({ id: 'exp-2' })];
    const csv = generateCsv(expenses);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3);
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

  it('header column order places origen_pago between categoria and descripcion', () => {
    const csv = generateCsv([]);
    const header = csv.split('\n')[0]!;
    const catIdx = header.split(',').indexOf('categoria');
    const origenIdx = header.split(',').indexOf('origen_pago');
    const descIdx = header.split(',').indexOf('descripcion');
    expect(catIdx).toBeGreaterThanOrEqual(0);
    expect(origenIdx).toBe(catIdx + 1);
    expect(descIdx).toBe(origenIdx + 1);
  });

  it('renders the Spanish label for paymentSource in the row', () => {
    const expense = makeExpense({ paymentSource: PS.CorporateCredit });
    const csv = generateCsv([expense]);
    expect(csv).toContain('Tarjeta de crédito corporativa');
  });

  it('origen_pago cell survives the formula-injection guard', () => {
    const expense = makeExpense({ paymentSource: '=EVIL()' as PaymentSource });
    const csv = generateCsv([expense]);
    expect(csv).toContain("'=EVIL()");
  });
});

// ─── groupReimbursableTotal ─────────────────────────────────────────────────

describe('groupReimbursableTotal', () => {
  it('sums all pending personal + cash expenses across all employees', () => {
    const expenses = [
      makeExpense({ id: 'a', amount: 1000, paymentSource: PS.PersonalCredit }),
      makeExpense({ id: 'b', submittedBy: 'u2', submitterName: 'B', amount: 2000, paymentSource: PS.Cash, currency: 'CLP' }),
      makeExpense({ id: 'c', amount: 5000, paymentSource: PS.CorporateCredit }),
    ];
    expect(groupReimbursableTotal(expenses)).toEqual([{ currency: 'CLP', total: 3000 }]);
  });

  it('returns one entry per currency', () => {
    const expenses = [
      makeExpense({ amount: 1000, paymentSource: PS.PersonalCredit, currency: 'CLP' }),
      makeExpense({ amount: 50, paymentSource: PS.Cash, currency: 'USD' }),
      makeExpense({ amount: 200, paymentSource: PS.Cash, currency: 'USD' }),
    ];
    const result = groupReimbursableTotal(expenses);
    expect(result).toContainEqual({ currency: 'CLP', total: 1000 });
    expect(result).toContainEqual({ currency: 'USD', total: 250 });
  });

  it('excludes paid expenses', () => {
    const expenses = [
      makeExpense({ amount: 1000, paymentSource: PS.PersonalCredit }),
      makeExpense({ amount: 500, paymentSource: PS.PersonalCredit, status: 'paid' }),
    ];
    expect(groupReimbursableTotal(expenses)).toEqual([{ currency: 'CLP', total: 1000 }]);
  });

  it('returns empty array when there are no reimbursable expenses', () => {
    expect(groupReimbursableTotal([])).toEqual([]);
  });
});

// ─── groupCorporateTotal ────────────────────────────────────────────────────

describe('groupCorporateTotal', () => {
  it('sums all pending corporate expenses across all employees', () => {
    const expenses = [
      makeExpense({ id: 'a', amount: 5000, paymentSource: PS.CorporateCredit }),
      makeExpense({ id: 'b', submittedBy: 'u2', submitterName: 'B', amount: 3000, paymentSource: PS.CorporateDebit, currency: 'CLP' }),
      makeExpense({ id: 'c', amount: 2000, paymentSource: PS.PersonalCredit }),
    ];
    expect(groupCorporateTotal(expenses)).toEqual([{ currency: 'CLP', total: 8000 }]);
  });

  it('excludes paid and non-corporate expenses', () => {
    const expenses = [
      makeExpense({ amount: 1000, paymentSource: PS.CorporateCredit }),
      makeExpense({ amount: 500, paymentSource: PS.CorporateCredit, status: 'paid' }),
      makeExpense({ amount: 2000, paymentSource: PS.Cash }),
    ];
    expect(groupCorporateTotal(expenses)).toEqual([{ currency: 'CLP', total: 1000 }]);
  });
});
