import { useState } from 'preact/hooks';
import { signIn } from '../../hooks/useAuth';
import { AuthCard } from '../ui/AuthCard';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

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
    <AuthCard
      title="Iniciar sesión"
      footer={<>¿No tienes cuenta? <a href="/register">Registrar empresa</a></>}
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <Input
          id="login-email"
          label="Email"
          type="email"
          value={email}
          autocomplete="email"
          required
          disabled={loading}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />

        <Input
          id="login-password"
          label="Contraseña"
          type="password"
          value={password}
          autocomplete="current-password"
          required
          disabled={loading}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />

        <Button type="submit" variant="primary" fullWidth disabled={loading}>
          {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthCard>
  );
}
