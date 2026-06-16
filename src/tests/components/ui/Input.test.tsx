// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Input } from '../../../components/ui/Input';

describe('Input', () => {
  it('renders a label associated with the input via id', () => {
    const { container } = render(<Input id="email" label="Email" type="email" />);
    const input = container.querySelector('input')!;
    const label = container.querySelector('label')!;
    expect(input.id).toBe('email');
    expect(input.type).toBe('email');
    expect(label.getAttribute('for')).toBe('email');
    expect(label.textContent).toBe('Email');
  });

  it('renders an error message and sets aria-invalid', () => {
    const { container } = render(<Input id="amount" label="Monto" error="Requerido" />);
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('.error')!.textContent).toBe('Requerido');
  });

  it('does not set aria-invalid when there is no error', () => {
    const { container } = render(<Input id="x" label="X" />);
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('forwards onInput', () => {
    const onInput = vi.fn();
    const { container } = render(<Input id="x" label="X" onInput={onInput} />);
    fireEvent.input(container.querySelector('input')!, { target: { value: 'hi' } });
    expect(onInput).toHaveBeenCalled();
  });
});
