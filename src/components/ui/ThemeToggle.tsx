import { useComputed } from '@preact/signals';
import { theme, toggleTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const isDark = useComputed(() => theme.value === 'dark');
  const label = isDark.value ? 'Tema claro' : 'Tema oscuro';
  return (
    <button
      type="button"
      className="btn btn-ghost"
      aria-label={label}
      aria-pressed={isDark.value}
      onClick={toggleTheme}
    >
      {isDark.value ? 'Claro' : 'Oscuro'}
    </button>
  );
}
