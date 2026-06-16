// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { theme, toggleTheme, applyStoredTheme, initThemeListener } from '../../hooks/useTheme';

type Listener = (e: Event) => void;

function makeMql(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    dispatchEvent: (e: Event) => {
      listeners.forEach((l) => l(e));
      return true;
    },
  };
  return { mql, fire: () => mql.dispatchEvent(new Event('change')) };
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    theme.value = 'light';
  });

  describe('theme signal', () => {
    it('defaults to "light" when no preference is stored', () => {
      expect(theme.value).toBe('light');
    });

    it('reads "dark" from localStorage on init', () => {
      localStorage.setItem('xpns-theme', 'dark');
      applyStoredTheme();
      expect(theme.value).toBe('dark');
    });

    it('reads "light" from localStorage on init', () => {
      localStorage.setItem('xpns-theme', 'light');
      applyStoredTheme();
      expect(theme.value).toBe('light');
    });
  });

  describe('toggleTheme', () => {
    it('flips light to dark and sets data-theme on <html>', () => {
      theme.value = 'light';
      toggleTheme();
      expect(theme.value).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('flips dark to light and removes data-theme from <html>', () => {
      theme.value = 'dark';
      document.documentElement.setAttribute('data-theme', 'dark');
      toggleTheme();
      expect(theme.value).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    it('persists the new theme to localStorage', () => {
      theme.value = 'light';
      toggleTheme();
      expect(localStorage.getItem('xpns-theme')).toBe('dark');

      toggleTheme();
      expect(localStorage.getItem('xpns-theme')).toBe('light');
    });
  });

  describe('initThemeListener', () => {
    it('reflects OS-level preference changes when no manual choice is stored', () => {
      const { mql, fire } = makeMql(false);
      vi.stubGlobal('matchMedia', () => mql);

      const cleanup = initThemeListener();
      mql.matches = true;
      fire();

      expect(theme.value).toBe('dark');
      cleanup();
      vi.unstubAllGlobals();
    });

    it('does NOT override the stored theme when OS preference changes', () => {
      localStorage.setItem('xpns-theme', 'light');
      applyStoredTheme();

      const { mql, fire } = makeMql(false);
      vi.stubGlobal('matchMedia', () => mql);

      const cleanup = initThemeListener();
      mql.matches = true;
      fire();

      expect(theme.value).toBe('light');
      cleanup();
      vi.unstubAllGlobals();
    });

    it('returns a no-op cleanup when window.matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);
      const cleanup = initThemeListener();
      expect(typeof cleanup).toBe('function');
      cleanup();
      vi.unstubAllGlobals();
    });
  });
});
