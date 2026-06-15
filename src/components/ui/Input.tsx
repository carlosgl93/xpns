import type { JSX, ComponentChildren } from 'preact';

interface Props extends Omit<JSX.HTMLAttributes<HTMLInputElement>, 'class' | 'size'> {
  id: string;
  label: string;
  error?: string;
  children?: ComponentChildren;
}

export function Input({ id, label, error, type = 'text', children, ...rest }: Props) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="form-input"
        type={type}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error && (
        <span id={`${id}-error`} className="error" role="alert">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}
