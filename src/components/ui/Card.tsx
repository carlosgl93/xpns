import type { ComponentChildren, JSX } from 'preact';

interface Props extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class' | 'size'> {
  children: ComponentChildren;
  /** Optional extra class. Surface styling is always applied. */
  surface?: boolean;
}

export function Card({ children, surface = true, ...rest }: Props) {
  const cls = surface ? 'card' : 'card card--flat';
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
