import { describe, it, expect } from 'vitest';
import { validateExpenseForm, localTodayString, parseLocalDate, type ExpenseFormFields } from '../../components/expenses/ExpenseForm';

function makeValid(): ExpenseFormFields {
  return {
    date: '2026-01-15',
    amount: 5000,
    currency: 'CLP',
    category: 'food',
    paymentSource: 'corporate_credit',
    description: 'Almuerzo',
    photo: new File(['bytes'], 'receipt.jpg', { type: 'image/jpeg' }),
  };
}

describe('validateExpenseForm', () => {
  it('returns no errors for a valid form', () => {
    const errors = validateExpenseForm(makeValid());
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires amount greater than zero', () => {
    const errors = validateExpenseForm({ ...makeValid(), amount: 0 });
    expect(errors.amount).toBeDefined();
  });

  it('rejects negative amounts', () => {
    const errors = validateExpenseForm({ ...makeValid(), amount: -1 });
    expect(errors.amount).toBeDefined();
  });

  it('requires currency to be selected', () => {
    const errors = validateExpenseForm({ ...makeValid(), currency: '' });
    expect(errors.currency).toBeDefined();
  });

  it('requires category to be selected', () => {
    const errors = validateExpenseForm({ ...makeValid(), category: '' });
    expect(errors.category).toBeDefined();
  });

  it('requires paymentSource to be selected', () => {
    const errors = validateExpenseForm({ ...makeValid(), paymentSource: '' });
    expect(errors.paymentSource).toBeDefined();
  });

  it('accepts any non-empty paymentSource value (enum membership enforced server-side)', () => {
    // Mirrors category: client only checks non-empty. Server rule rejects unknown values.
    const errors = validateExpenseForm({ ...makeValid(), paymentSource: 'banana' });
    expect(errors.paymentSource).toBeUndefined();
  });

  it('rejects future dates', () => {
    const errors = validateExpenseForm({ ...makeValid(), date: '2099-12-31' });
    expect(errors.date).toBeDefined();
  });

  it('accepts today as a valid date', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const errors = validateExpenseForm({ ...makeValid(), date: today });
    expect(errors.date).toBeUndefined();
  });

  it('requires a photo', () => {
    const errors = validateExpenseForm({ ...makeValid(), photo: null });
    expect(errors.photo).toBeDefined();
  });

  it('returns multiple errors when multiple fields invalid', () => {
    const errors = validateExpenseForm({ ...makeValid(), amount: 0, currency: '', paymentSource: '' });
    expect(errors.amount).toBeDefined();
    expect(errors.currency).toBeDefined();
    expect(errors.paymentSource).toBeDefined();
  });

  it('treats a blank currency as valid when a defaultCurrency is provided (org claim)', () => {
    const errors = validateExpenseForm({ ...makeValid(), currency: '' }, 'CLP');
    expect(errors.currency).toBeUndefined();
  });

  it('still flags missing currency when neither fields.currency nor defaultCurrency is set', () => {
    const errors = validateExpenseForm({ ...makeValid(), currency: '' });
    expect(errors.currency).toBeDefined();
  });
});

describe('localTodayString', () => {
  it('returns YYYY-MM-DD shape', () => {
    expect(localTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the current local calendar day', () => {
    const expected = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    expect(localTodayString()).toBe(expected);
  });
});

describe('parseLocalDate', () => {
  it('returns a Date anchored at local midnight', () => {
    const d = parseLocalDate('2026-06-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('round-trips with localTodayString for today', () => {
    const parsed = parseLocalDate(localTodayString());
    const now = new Date();
    expect(parsed.getFullYear()).toBe(now.getFullYear());
    expect(parsed.getMonth()).toBe(now.getMonth());
    expect(parsed.getDate()).toBe(now.getDate());
  });
});
