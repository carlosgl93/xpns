// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/preact';
import { ThemeToggle } from '../../../components/ui/ThemeToggle';
import { theme, applyStoredTheme } from '../../../hooks/useTheme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    theme.value = 'light';
  });

  it('renders the toggle button with the correct initial label', () => {
    const { container } = render(<ThemeToggle />);
    const btn = container.querySelector('button')!;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Oscuro'); // light → button invites switching to dark
    expect(btn.getAttribute('aria-label')).toBe('Tema oscuro');
  });

  it('clicking flips theme and updates the DOM', () => {
    const { container } = render(<ThemeToggle />);
    const btn = container.querySelector('button')!;
    fireEvent.click(btn);
    expect(theme.value).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('xpns-theme')).toBe('dark');
  });

  it('renders the "Claro" label when the current theme is dark', () => {
    theme.value = 'dark';
    const { container } = render(<ThemeToggle />);
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('Claro');
    expect(btn.getAttribute('aria-label')).toBe('Tema claro');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('reflects theme changes from other sources', () => {
    const { container } = render(<ThemeToggle />);
    localStorage.setItem('xpns-theme', 'dark');
    act(() => {
      applyStoredTheme();
    });
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('Claro');
  });
});
