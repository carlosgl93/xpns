import { useComputed } from '@preact/signals';
import { authUser, authClaims, signOut } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ui/ThemeToggle';

interface Props {
  /** Current page nav item, e.g. "Gastos", "Equipo" */
  currentNav?: string;
}

export function Header({ currentNav = 'Gastos' }: Props) {
  const user = useComputed(() => authUser.value);
  const role = useComputed(() => authClaims.value?.role);

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <header className="app-header">
      <a className="logo" href="/dashboard">xpns</a>

      <nav className="desktop-only" aria-label="Principal">
        <a href="/dashboard" className={currentNav === 'Gastos' ? 'active' : ''}>Gastos</a>
      </nav>

      <div className="actions">
        {user.value && (
          <span className="user desktop-only">
            {user.value.email} — {role.value === 'admin' ? 'Administrador' : 'Empleado'}
          </span>
        )}
        <ThemeToggle />
        <Button variant="ghost" onClick={handleSignOut} className="desktop-only">
          Cerrar sesión
        </Button>
        <button type="button" className="overflow mobile-only" aria-label="Más opciones">
          ⋯
        </button>
      </div>
    </header>
  );
}
