import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border-default bg-hover text-text-secondary',
        secondary: 'border-border-default bg-surface text-text-secondary',
        success: 'border-accent-emerald/20 bg-accent-emerald/10 text-accent-emerald',
        warning: 'border-accent-amber/20 bg-accent-amber/10 text-accent-amber',
        danger: 'border-accent-red/20 bg-accent-red/10 text-accent-red',
        info: 'border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan',
        violet: 'border-accent-violet/20 bg-accent-violet/10 text-accent-violet',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
