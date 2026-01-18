import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full py-2.5 rounded-lg border bg-white dark:bg-dark-800 text-dark-900 dark:text-dark-100 placeholder-dark-400 dark:placeholder-dark-500 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              error
                ? 'border-error-500 focus:ring-error-500'
                : 'border-dark-300 dark:border-dark-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-10 pr-4' : 'px-4',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-sm text-error-500">{error}</p>}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-dark-500 dark:text-dark-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
