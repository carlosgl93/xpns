import type { JSX, ComponentChildren } from 'preact';

type InputType = 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' | 'url' | 'search';

interface Props extends Omit<JSX.IntrinsicElements['input'], 'class' | 'size' | 'type'> {
  id: string;
  label: string;
  error?: string;
  type?: InputType;
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
