import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-border-default bg-inset px-3 py-1 text-sm text-text-primary placeholder:text-text-muted transition-all duration-200',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:outline-none focus-visible:border-accent-cyan/50 focus-visible:ring-1 focus-visible:ring-accent-cyan/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
