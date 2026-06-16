// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { Badge, statusBadge } from '../../../components/ui/Badge';
import type { ExpenseStatus } from '../../../types/models';

describe('Badge', () => {
  it('applies variant class', () => {
    const { container } = render(<Badge variant="accent">A reembolsar</Badge>);
    const el = container.querySelector('.badge')!;
    expect(el.className).toContain('badge-accent');
    expect(el.textContent).toBe('A reembolsar');
  });

  it('renders all known variants', () => {
    const variants = ['accent', 'success', 'warning', 'error', 'pending'] as const;
    for (const v of variants) {
      const { container } = render(<Badge variant={v}>x</Badge>);
      expect(container.querySelector('.badge')!.className).toContain(`badge-${v}`);
    }
  });
});

describe('statusBadge', () => {
  it('returns "Pagado" / success for paid expenses', () => {
    expect(statusBadge('paid' as ExpenseStatus)).toEqual({ label: 'Pagado', variant: 'success' });
  });

  it('returns "Pendiente" / pending for pending expenses', () => {
    expect(statusBadge('pending' as ExpenseStatus)).toEqual({ label: 'Pendiente', variant: 'pending' });
  });

  it('falls back to pending for unknown status', () => {
    expect(statusBadge('whatever' as unknown as ExpenseStatus)).toEqual({ label: 'Pendiente', variant: 'pending' });
  });
});
