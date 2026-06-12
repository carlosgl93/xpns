import { useState } from 'preact/hooks';
import { signUp } from '../../hooks/useAuth';

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

export default function RegisterForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormState) {
    return (e: Event) => {
      setForm((f) => ({ ...f, [field]: (e.target as HTMLInputElement).value }));
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
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2>Crear empresa</h2>

      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}

      <label>
        Nombre de empresa
        <input
          type="text"
          value={form.companyName}
          onInput={set('companyName')}
          required
          disabled={loading}
        />
      </label>

      <label>
        Moneda predeterminada
        <select value={form.defaultCurrency} onChange={set('defaultCurrency')} disabled={loading}>
          <option value="CLP">CLP — Peso chileno</option>
          <option value="ARS">ARS — Peso argentino</option>
          <option value="COP">COP — Peso colombiano</option>
          <option value="MXN">MXN — Peso mexicano</option>
          <option value="PEN">PEN — Sol peruano</option>
          <option value="BRL">BRL — Real brasileño</option>
          <option value="USD">USD — Dólar estadounidense</option>
          <option value="EUR">EUR — Euro</option>
        </select>
      </label>

      <label>
        Email
        <input
          type="email"
          value={form.email}
          onInput={set('email')}
          required
          disabled={loading}
          autocomplete="email"
        />
      </label>

      <label>
        Contraseña
        <input
          type="password"
          value={form.password}
          onInput={set('password')}
          required
          minLength={8}
          disabled={loading}
          autocomplete="new-password"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Creando empresa…' : 'Crear empresa'}
      </button>

      <p>
        ¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a>
      </p>
    </form>
  );
}
