import { useState } from 'preact/hooks';
import { signUp } from '../../hooks/useAuth';
import { AuthCard } from '../ui/AuthCard';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface FormState {
  companyName: string;
  defaultCurrency: string;
  email: string;
  password: string;
}

const INITIAL: FormState = {
  companyName: '',
  defaultCurrency: 'CLP',
  email: '',
  password: '',
};

const CURRENCY_OPTIONS = [
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'USD', label: 'USD — Dólar estadounidense' },
  { value: 'EUR', label: 'EUR — Euro' },
];

export default function RegisterForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof FormState>(field: K) {
    return (e: Event) => {
      setForm((f) => ({ ...f, [field]: (e.target as HTMLInputElement | HTMLSelectElement).value }));
    };
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      await signUp(form.email, form.password);

      // 2. Call Cloud Function to create org + set admin claims (P0: never client-side)
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctionsClient, getAuth } = await import('../../lib/firebase');
      const fns = await getFunctionsClient();
      const setOrgClaims = httpsCallable<{ orgName: string; defaultCurrency: string }, { orgId: string }>(
        fns,
        'setOrgClaims'
      );
      await setOrgClaims({ orgName: form.companyName, defaultCurrency: form.defaultCurrency });

      // 3. Force token refresh so claims propagate immediately
      const auth = await getAuth();
      await auth.currentUser?.getIdToken(true);

      window.location.href = '/dashboard';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar empresa');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Crear empresa"
      subtitle="Registra tu organización para empezar a gestionar rendiciones de gastos."
      footer={<>¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></>}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <Input
          id="reg-company"
          label="Nombre de empresa"
          type="text"
          value={form.companyName}
          required
          disabled={loading}
          onInput={set('companyName')}
        />

        <Select
          id="reg-currency"
          label="Moneda predeterminada"
          options={CURRENCY_OPTIONS}
          value={form.defaultCurrency}
          disabled={loading}
          onChange={set('defaultCurrency')}
        />

        <Input
          id="reg-email"
          label="Email"
          type="email"
          value={form.email}
          autocomplete="email"
          required
          disabled={loading}
          onInput={set('email')}
        />

        <Input
          id="reg-password"
          label="Contraseña"
          type="password"
          value={form.password}
          autocomplete="new-password"
          required
          minLength={8}
          disabled={loading}
          onInput={set('password')}
        />

        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Creando empresa…' : 'Crear empresa'}
        </Button>
      </form>
    </AuthCard>
  );
}
