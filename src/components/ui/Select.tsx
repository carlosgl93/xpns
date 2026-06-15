import type { JSX, ComponentChildren } from 'preact';

interface Option {
  value: string;
  label: string;
}

interface Props extends Omit<JSX.HTMLAttributes<HTMLSelectElement>, 'class' | 'size' | 'children'> {
  id: string;
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
  children?: ComponentChildren;
}

export function Select({ id, label, options, placeholder, error, ...rest }: Props) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="form-select"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
