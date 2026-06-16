import { describe, it, expect } from 'vitest';
import { formatCLP, formatCLPDense } from '../../lib/format';

describe('formatCLP', () => {
  it('formats CLP with es-CL locale, no decimals, currency symbol attached', () => {
    expect(formatCLP(1247500, 'CLP')).toBe('$1.247.500');
  });

  it('formats smaller CLP values', () => {
    expect(formatCLP(45000, 'CLP')).toBe('$45.000');
  });

  it('formats zero', () => {
    expect(formatCLP(0, 'CLP')).toBe('$0');
  });

  it('formats other currencies with es-CL locale', () => {
    // es-CL + USD: Intl renders the narrow symbol; we don't pin the exact
    // prefix because ICU data changes across runtimes — only the digits do.
    const result = formatCLP(100, 'USD');
    expect(result).toContain('100');
    expect(result).not.toContain(',');
  });

  it('rounds to integer (CLP has no cents)', () => {
    expect(formatCLP(1234.6, 'CLP')).toBe('$1.235');
  });
});

describe('formatCLPDense', () => {
  it('uses a non-breaking space between the currency symbol and the number', () => {
    const result = formatCLPDense(45000, 'CLP');
    expect(result).toBe('$ 45.000');
  });

  it('formats large CLP values with non-breaking space', () => {
    expect(formatCLPDense(1247500, 'CLP')).toBe('$ 1.247.500');
  });

  it('formats zero with non-breaking space', () => {
    expect(formatCLPDense(0, 'CLP')).toBe('$ 0');
  });

  it('formats other currencies with es-CL locale + non-breaking space', () => {
    const result = formatCLPDense(100, 'USD');
    expect(result).toContain('100');
    // Must contain a non-breaking space, not a regular space, before the number.
    expect(result).toMatch(/ /);
  });
});
