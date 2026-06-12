import { useState } from 'preact/hooks';
import { signIn } from '../../hooks/useAuth';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      window.location.href = '/dashboard';
    } catch {
      // Generic message — don't expose whether email exists (P0 security)
      setError('Credenciales incorrectas. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2>Iniciar sesión</h2>

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
          disabled={loading}
          autocomplete="current-password"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </button>

      <p>
        ¿No tienes cuenta? <a href="/register">Registrar empresa</a>
      </p>
    </form>
  );
}
