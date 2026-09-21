import type {ButtonHTMLAttributes, ReactNode} from 'react';
import Link from 'next/link';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  rel?: string;
  target?: string;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({
  children,
  className,
  href,
  rel,
  target,
  variant = 'primary',
  type = 'button',
  ...props
}: Props) {
  const classNames = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  if (href) {
    return (
      <Link
        aria-label={props['aria-label']}
        className={classNames}
        href={href}
        rel={rel}
        target={target}
        title={props.title}
      >
        {children}
      </Link>
    );
  }
  return (
    <button className={classNames} type={type} {...props}>
      {children}
    </button>
  );
}
