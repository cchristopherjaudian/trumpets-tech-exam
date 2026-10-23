import type { ButtonHTMLAttributes } from 'react';
import { cx } from './types.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** The single button used for every action in the app. */
export function Button({ variant = 'secondary', type = 'button', className, ...props }: ButtonProps) {
  return <button {...props} type={type} className={cx('button', `button--${variant}`, className)} />;
}
