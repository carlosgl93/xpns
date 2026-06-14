import { useState } from 'preact/hooks';
import { addExpense } from '../../hooks/useExpenses';
import { ExpenseCategory, PaymentSource } from '../../types/models';
import { PAYMENT_SOURCE_LABELS } from '../../lib/paymentSources';
import type { Timestamp } from 'firebase/firestore';

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
  } else {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (fields.date > todayStr) {
      errors.date = 'La fecha no puede ser futura';
    }
  }
  if (!fields.photo) {
    errors.photo = 'El comprobante es requerido';
  }

  return errors;
}

const CURRENCIES = ['CLP', 'ARS', 'COP', 'MXN', 'PEN', 'BRL', 'USD', 'EUR'];

const INITIAL: ExpenseFormFields = {
  date: '',
  amount: 0,
  currency: '',
  category: '',
  paymentSource: '',
  description: '',
  photo: null,
};

export default function ExpenseForm() {
  const [form, setForm] = useState<ExpenseFormFields>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof ExpenseFormFields>(field: K, value: ExpenseFormFields[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const fieldErrors = validateExpenseForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { Timestamp } = await import('firebase/firestore');
      const dateTs = Timestamp.fromDate(new Date(form.date + 'T00:00:00')) as Timestamp;
      await addExpense(
        {
          submittedBy: '',
          submitterName: '',
          amount: form.amount,
          currency: form.currency,
          category: form.category as ExpenseCategory,
          paymentSource: form.paymentSource as PaymentSource,
          description: form.description,
          receiptStoragePath: '',
          status: 'pending',
          date: dateTs,
        },
        form.photo!
      );
      // Clear only after Firestore ack
      setForm(INITIAL);
      setSuccess(true);
    } catch {
      setSubmitError('Error al guardar el gasto. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div>
        <p>Gasto registrado correctamente.</p>
        <button type="button" onClick={() => setSuccess(false)}>
          Agregar otro
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="date">Fecha</label>
        <input
          id="date"
          type="date"
          value={form.date}
          max={new Date().toISOString().split('T')[0]}
          onInput={(e) => setField('date', (e.target as HTMLInputElement).value)}
          required
        />
        {errors.date && <span>{errors.date}</span>}
      </div>

      <div>
        <label htmlFor="amount">Monto</label>
        <input
          id="amount"
          type="number"
          min="0.01"
          step="any"
          value={form.amount || ''}
          onInput={(e) => setField('amount', parseFloat((e.target as HTMLInputElement).value) || 0)}
          required
        />
        {errors.amount && <span>{errors.amount}</span>}
      </div>

      <div>
        <label htmlFor="currency">Moneda</label>
        <select
          id="currency"
          value={form.currency}
          onChange={(e) => setField('currency', (e.target as HTMLSelectElement).value)}
          required
        >
          <option value="">Seleccionar...</option>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.currency && <span>{errors.currency}</span>}
      </div>

      <div>
        <label htmlFor="category">Categoría</label>
        <select
          id="category"
          value={form.category}
          onChange={(e) => setField('category', (e.target as HTMLSelectElement).value)}
          required
        >
          <option value="">Seleccionar...</option>
          {Object.entries(ExpenseCategory).map(([label, value]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {errors.category && <span>{errors.category}</span>}
      </div>

      <div>
        <label htmlFor="paymentSource">Origen de pago</label>
        <select
          id="paymentSource"
          value={form.paymentSource}
          onChange={(e) => setField('paymentSource', (e.target as HTMLSelectElement).value)}
          required
        >
          <option value="">Seleccionar...</option>
          {Object.values(PaymentSource).map((value) => (
            <option key={value} value={value}>{PAYMENT_SOURCE_LABELS[value]}</option>
          ))}
        </select>
        {errors.paymentSource && <span>{errors.paymentSource}</span>}
      </div>

      <div>
        <label htmlFor="description">Descripción</label>
        <textarea
          id="description"
          value={form.description}
          onInput={(e) => setField('description', (e.target as HTMLTextAreaElement).value)}
        />
      </div>

      <div>
        <label htmlFor="photo">Comprobante</label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0] ?? null;
            setField('photo', file);
          }}
          required
        />
        {errors.photo && <span>{errors.photo}</span>}
      </div>

      {submitError && <p>{submitError}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar gasto'}
      </button>
    </form>
  );
}
