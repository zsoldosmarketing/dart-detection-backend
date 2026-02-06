import { type ReactNode } from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  const variants = {
    default:
      'bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 border-dark-200 dark:border-dark-600',
    primary:
      'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800/40',
    secondary:
      'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400 border-secondary-200 dark:border-secondary-800/40',
    success:
      'bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800/40',
    warning:
      'bg-warning-50 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 border-warning-200 dark:border-warning-800/40',
    error:
      'bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-400 border-error-200 dark:border-error-800/40',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs rounded-full',
    md: 'px-2.5 py-1 text-sm rounded-md',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
