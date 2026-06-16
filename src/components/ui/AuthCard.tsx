import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  subtitle?: string;
  footer?: ComponentChildren;
  children: ComponentChildren;
}

export function AuthCard({ title, subtitle, footer, children }: Props) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="display">{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );
}
