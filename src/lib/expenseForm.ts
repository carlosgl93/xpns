// Pure helpers for the expense entry form. No Preact, no Firebase — easy to
// unit-test in node. The form component composes these; the validator lives
// here too so client + tests share one source of truth.

export interface ExpenseFormFields {
  date: string;
  amount: number;
  currency: string;
  category: string;
  paymentSource: string;
  description: string;
  photo: File | null;
}

export type FormErrors = Partial<Record<keyof ExpenseFormFields, string>>;

/** Local-date YYYY-MM-DD string for "today" (avoids UTC- timezone drift). */
export function localTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function validateExpenseForm(fields: ExpenseFormFields): FormErrors {
  const errors: FormErrors = {};

  if (!fields.amount || fields.amount <= 0) {
    errors.amount = 'El monto debe ser mayor a 0';
  }
  if (!fields.currency) {
    errors.currency = 'Selecciona una moneda';
  }
  if (!fields.category) {
    errors.category = 'Selecciona una categoría';
  }
  if (!fields.paymentSource) {
    errors.paymentSource = 'Selecciona el origen del pago';
  }
  if (!fields.date) {
    errors.date = 'La fecha es requerida';
  } else if (fields.date > localTodayString()) {
    errors.date = 'La fecha no puede ser futura';
  }
  if (!fields.photo) {
    errors.photo = 'El comprobante es requerido';
  }

  return errors;
}
