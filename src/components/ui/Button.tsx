import type { ComponentChildren, JSX } from 'preact';

type Variant = 'primary' | 'secondary' | 'ghost' | 'default';

interface CommonProps {
  variant?: Variant;
  fullWidth?: boolean;
  children: ComponentChildren;
  className?: string;
}

type ButtonAsButton = CommonProps & Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'class' | 'size'> & {
  href?: undefined;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

type ButtonAsLink = CommonProps & Omit<JSX.HTMLAttributes<HTMLAnchorElement>, 'class' | 'size' | 'href'> & {
  href: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes(variant: Variant, fullWidth: boolean, extra?: string): string {
  const cls = ['btn'];
  if (variant !== 'default') cls.push(`btn-${variant}`);
  if (fullWidth) cls.push('btn-full');
  if (extra) cls.push(extra);
  return cls.join(' ');
}

export function Button(props: ButtonProps) {
  const { variant = 'default', fullWidth = false, className, children } = props;
  const cls = classes(variant, fullWidth, className);

  if ('href' in props && props.href !== undefined) {
    const { variant: _v, fullWidth: _f, className: _c, children: _ch, href, ...rest } = props;
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    );
  }

  const { variant: _v, fullWidth: _f, className: _c, children: _ch, type = 'button', ...rest } = props as ButtonAsButton;
  return (
    <button className={cls} type={type} {...rest}>
      {children}
    </button>
  );
}
