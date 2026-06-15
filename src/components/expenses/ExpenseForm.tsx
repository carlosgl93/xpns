// Employee expense entry form. Mobile-first, photo-driven, sticky bottom
// submit, amount autofocused. Uses the design-system classes from
// components.css (.expense-form, .photo-input, .amount-input, .submit-bar)
// and the Input / Select / Button primitives.
//
// Auth gating is handled by the form itself (bootstrapAuth + whenAuthReady)
// — no setInterval in the page wrapper.

import { useState, useEffect, useRef } from 'preact/hooks';
import { addExpense } from '../../hooks/useExpenses';
import { ExpenseCategory, PaymentSource } from '../../types/models';
import { PAYMENT_SOURCE_LABELS } from '../../lib/paymentSources';
import { bootstrapAuth, whenAuthReady } from '../../hooks/useAuthBootstrap';
import { authUser, authClaims } from '../../hooks/useAuth';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { validateExpenseForm, localTodayString, parseLocalDate } from '../../lib/expenseForm';
import type { Timestamp } from 'firebase/firestore';

// Re-export the validator + helpers so existing test imports keep working.
export { validateExpenseForm, localTodayString, parseLocalDate };
export type { ExpenseFormFields, FormErrors } from '../../lib/expenseForm';

const CURRENCIES = ['CLP', 'ARS', 'COP', 'MXN', 'PEN', 'BRL', 'USD', 'EUR'];

const CATEGORY_OPTIONS = Object.values(ExpenseCategory).map((value) => ({
  value,
  // Enum key is PascalCase; turn into human label: 'food' → 'Comida' etc.
  label: ({
    food: 'Comida',
    lodging: 'Alojamiento',
    transport: 'Transporte',
    entertainment: 'Entretenimiento',
    other: 'Otro',
  } as Record<string, string>)[value] ?? value,
}));

const PAYMENT_SOURCE_OPTIONS = Object.values(PaymentSource).map((value) => ({
  value,
  label: PAYMENT_SOURCE_LABELS[value],
}));

const INITIAL = {
  date: localTodayString(),
  amount: 0,
  currency: '',
  category: '',
  paymentSource: '',
  description: '',
  photo: null as File | null,
};

export default function ExpenseForm() {
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const cancelledRef = useRef(false);

  // Auth bootstrap: wait for the first emission, then snapshot.
  // If unauthenticated (or no orgId), redirect to login.
  useEffect(() => {
    cancelledRef.current = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      unsubscribe = await bootstrapAuth();
      await whenAuthReady();
      if (cancelledRef.current) return;

      const u = authUser.value;
      const c = authClaims.value;
      if (!u || !c?.orgId) {
        window.location.href = '/login';
        return;
      }
      setAuthReady(true);
    })();

    return () => {
      cancelledRef.current = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  function setField<K extends keyof typeof INITIAL>(field: K, value: (typeof INITIAL)[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  }

  function handlePhotoChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    setField('photo', file);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const fieldErrors = validateExpenseForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      // Bring the first invalid field into view (mobile keyboards hide the
      // submit bar, so the user needs to see the error).
      const firstInvalid = Object.keys(fieldErrors)[0];
      const el = document.getElementById(firstInvalid);
      el?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { Timestamp } = await import('firebase/firestore');
      const dateTs = Timestamp.fromDate(parseLocalDate(form.date));
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
          date: dateTs as Timestamp,
        },
        form.photo!
      );
      if (cancelledRef.current) return;
      setForm({ ...INITIAL, date: localTodayString() });
      setSuccess(true);
    } catch {
      if (cancelledRef.current) return;
      setSubmitError('Error al guardar el gasto. Intenta de nuevo.');
    } finally {
      if (!cancelledRef.current) setSubmitting(false);
    }
  }

  if (!authReady) {
    return <p className="status-loading">Cargando…</p>;
  }

  if (success) {
    return (
      <div className="expense-form form-success">
        <div className="alert alert-success" role="status">
          Gasto registrado correctamente.
        </div>
        <div className="form-success-actions">
          <Button variant="primary" onClick={() => setSuccess(false)}>
            Agregar otro
          </Button>
          <Button variant="ghost" href="/dashboard">
            Volver al dashboard
          </Button>
        </div>
      </div>
    );
  }

  const todayMax = localTodayString();

  return (
    <>
      <header className="mobile-form-header" aria-label="Nuevo gasto">
        <a href="/dashboard" className="btn btn-ghost mobile-only">
          Cancelar
        </a>
        <span className="form-header-title">Nuevo gasto</span>
        <span className="logo">xpns</span>
      </header>

      <form className="expense-form" onSubmit={handleSubmit} noValidate>
        <label
          htmlFor="photo"
          className={`photo-input ${form.photo ? 'has-image' : ''}`}
          aria-invalid={errors.photo ? 'true' : undefined}
        >
          {form.photo ? (
            <>
              <div>Recibo capturado</div>
              <div className="meta">{form.photo.name}</div>
            </>
          ) : (
            <>
              <div>Capturar comprobante</div>
              <div className="meta">Toca para abrir la cámara</div>
            </>
          )}
          <input
            id="photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={submitting}
            required
            className="visually-hidden"
          />
        </label>
        {errors.photo && <span className="error" role="alert">{errors.photo}</span>}

        <div className="amount-row">
          <Input
            id="amount"
            label="Monto"
            type="number"
            min={0.01}
            step="any"
            value={form.amount || ''}
            onInput={(e) => setField('amount', parseFloat((e.target as HTMLInputElement).value) || 0)}
            required
            disabled={submitting}
            error={errors.amount}
            autofocus
            className="amount-input"
          />
        </div>

        <Input
          id="date"
          label="Fecha"
          type="date"
          value={form.date}
          max={todayMax}
          onInput={(e) => setField('date', (e.target as HTMLInputElement).value)}
          required
          disabled={submitting}
          error={errors.date}
        />

        <Input
          id="description"
          label="Comercio"
          type="text"
          value={form.description}
          placeholder="Ej: Copec"
          onInput={(e) => setField('description', (e.target as HTMLInputElement).value)}
          disabled={submitting}
        />

        <Select
          id="category"
          label="Categoría"
          options={CATEGORY_OPTIONS}
          placeholder="Seleccionar…"
          value={form.category}
          onChange={(e) => setField('category', (e.target as HTMLSelectElement).value)}
          required
          disabled={submitting}
          error={errors.category}
        />

        <Select
          id="paymentSource"
          label="Origen de pago"
          options={PAYMENT_SOURCE_OPTIONS}
          placeholder="Seleccionar…"
          value={form.paymentSource}
          onChange={(e) => setField('paymentSource', (e.target as HTMLSelectElement).value)}
          required
          disabled={submitting}
          error={errors.paymentSource}
        />

        {submitError && (
          <div className="alert alert-error" role="alert">
            {submitError}
          </div>
        )}

        <div className="submit-bar">
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </div>
      </form>
    </>
  );
}
