import { describe, it, expect } from 'vitest';
import { validateExpenseForm, type ExpenseFormFields } from '../../components/expenses/ExpenseForm';

function makeValid(): ExpenseFormFields {
  return {
    date: '2026-01-15',
    amount: 5000,
    currency: 'CLP',
    category: 'food',
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
    const errors = validateExpenseForm({ ...makeValid(), amount: 0, currency: '' });
    expect(errors.amount).toBeDefined();
    expect(errors.currency).toBeDefined();
  });
});
