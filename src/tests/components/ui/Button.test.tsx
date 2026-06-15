// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Button } from '../../../components/ui/Button';

describe('Button', () => {
  it('renders a <button> by default with btn class', () => {
    const { container } = render(<Button>Click me</Button>);
    const btn = container.querySelector('button')!;
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('btn');
    expect(btn.textContent).toBe('Click me');
  });

  it('applies variant class: primary', () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('btn-primary');
  });

  it('applies variant class: secondary', () => {
    const { container } = render(<Button variant="secondary">Cancel</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('btn-secondary');
  });

  it('applies variant class: ghost', () => {
    const { container } = render(<Button variant="ghost">Dismiss</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('btn-ghost');
  });

  it('renders full-width when fullWidth is true', () => {
    const { container } = render(<Button fullWidth>Full</Button>);
    expect(container.querySelector('button')!.className).toContain('btn-full');
  });

  it('forwards onClick', () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>Tap</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    const { container } = render(<Button disabled onClick={onClick}>Tap</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders an <a> when href is provided', () => {
    const { container } = render(<Button href="/login">Go</Button>);
    const a = container.querySelector('a')!;
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('/login');
    expect(a.className).toContain('btn');
  });
});
