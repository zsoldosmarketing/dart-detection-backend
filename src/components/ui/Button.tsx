import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

    const variants = {
      primary:
        'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-600/20 hover:from-primary-500 hover:to-primary-400 hover:shadow-lg hover:shadow-primary-500/25 focus:ring-primary-500',
      secondary:
        'bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-md shadow-secondary-600/20 hover:from-secondary-500 hover:to-secondary-400 hover:shadow-lg hover:shadow-secondary-500/25 focus:ring-secondary-500',
      outline:
        'border border-dark-300 dark:border-dark-600 text-dark-900 dark:text-dark-100 hover:bg-dark-50 dark:hover:bg-dark-800 hover:border-dark-400 dark:hover:border-dark-500 focus:ring-dark-500',
      ghost:
        'text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800/70 focus:ring-dark-500',
      danger:
        'bg-gradient-to-r from-error-600 to-error-500 text-white shadow-md shadow-error-600/20 hover:from-error-500 hover:to-error-400 hover:shadow-lg hover:shadow-error-500/25 focus:ring-error-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
