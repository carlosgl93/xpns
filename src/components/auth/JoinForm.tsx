import { useState, useEffect } from 'preact/hooks';
import { signUp } from '../../hooks/useAuth';

export default function JoinForm() {
  const [token, setToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') ?? '');
    setOrgId(params.get('org') ?? '');
  }, []);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!token || !orgId) {
      setError('Link de invitación inválido.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      await signUp(email, password);

      // 2. Call Cloud Function to validate invite + set employee claims (P0: server-only)
      const { httpsCallable } = await import('firebase/functions');
      const { getFunctionsClient, getAuth } = await import('../../lib/firebase');
      const fns = await getFunctionsClient();
      const processInvite = httpsCallable<{ token: string; orgId: string }, { orgId: string }>(
        fns,
        'processInvite'
      );
      await processInvite({ token, orgId });

      // 3. Force token refresh so employee claims are active
      const auth = await getAuth();
      await auth.currentUser?.getIdToken(true);

      window.location.href = '/dashboard/expenses/new';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al unirse a la empresa';
      if (msg.includes('deadline-exceeded') || msg.includes('expired')) {
        setError('El link de invitación ha expirado.');
      } else if (msg.includes('already-exists') || msg.includes('used')) {
        setError('Este link de invitación ya fue utilizado.');
      } else if (msg.includes('permission-denied')) {
        setError('Este link no es para tu email.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2>Unirse a empresa</h2>

      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}

      <label>
        Email
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          required
          disabled={loading}
          autocomplete="email"
        />
      </label>

      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          required
          minLength={8}
          disabled={loading}
          autocomplete="new-password"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Uniéndose…' : 'Unirse'}
      </button>
    </form>
  );
}
