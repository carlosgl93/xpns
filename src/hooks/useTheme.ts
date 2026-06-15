// Theme state — single source of truth for light/dark mode.
//
// The bootstrap in AppLayout.astro sets data-theme before paint to avoid
// FOUC. This module exposes:
// - `theme`        : signal reflecting the current theme
// - `toggleTheme`  : flip and persist
// - `applyStoredTheme` : re-read localStorage and update the signal
//                       (used by tests; safe to call multiple times)
// - `initThemeListener` : track OS-level prefers-color-scheme changes
//                          ONLY when the user has no manual preference

import { signal } from '@preact/signals';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'xpns-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function applyToDom(theme: Theme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export const theme = signal<Theme>('light');

/** Re-read localStorage; updates `theme` signal and data-theme attribute. */
export function applyStoredTheme(): void {
  const stored = readStored();
  const next: Theme = stored ?? 'light';
  theme.value = next;
  applyToDom(next);
}

export function toggleTheme(): void {
  const next: Theme = theme.value === 'dark' ? 'light' : 'dark';
  theme.value = next;
  applyToDom(next);
  writeStored(next);
}

/**
 * Subscribe to OS prefers-color-scheme changes. Only follows the OS when the
 * user has not made a manual choice (localStorage is empty). Returns a
 * cleanup function that removes the listener.
 */
export function initThemeListener(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = (): void => {
    if (readStored() !== null) return;
    const next: Theme = mql.matches ? 'dark' : 'light';
    theme.value = next;
    applyToDom(next);
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
