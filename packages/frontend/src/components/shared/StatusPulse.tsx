'use client';

import { cn } from '@/lib/utils';

interface StatusPulseProps {
  status: 'online' | 'offline' | 'scanning' | 'threat' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

const statusColors = {
  online: 'bg-accent-emerald',
  offline: 'bg-accent-red',
  scanning: 'bg-accent-cyan',
  threat: 'bg-accent-red',
  warning: 'bg-accent-amber',
};

const statusPulseAnimations = {
  online: 'animate-pulse',
  offline: '',
  scanning: 'animate-pulse',
  threat: 'threat-pulse',
  warning: 'animate-pulse',
};

const sizeMap = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2.5 w-2.5',
  lg: 'h-3.5 w-3.5',
};

export function StatusPulse({ status = 'offline', size = 'md' }: StatusPulseProps) {
  return (
    <span className="relative inline-flex" role="status" aria-label={status}>
      <span
        className={cn(
          'inline-block rounded-full',
          statusColors[status],
          statusPulseAnimations[status],
          sizeMap[size]
        )}
      />
      {status === 'threat' && (
        <span
          className={cn(
            'absolute inset-0 inline-flex rounded-full bg-accent-red/40 animate-ping',
            sizeMap[size]
          )}
        />
      )}
    </span>
  );
}
