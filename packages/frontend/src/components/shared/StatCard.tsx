'use client';

import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  description?: string;
  color?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'red';
}

const colorStyles = {
  cyan: 'bg-accent-cyan/10 text-accent-cyan',
  emerald: 'bg-accent-emerald/10 text-accent-emerald',
  violet: 'bg-accent-violet/10 text-accent-violet',
  amber: 'bg-accent-amber/10 text-accent-amber',
  red: 'bg-accent-red/10 text-accent-red',
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  color = 'cyan',
}: StatCardProps) {
  return (
    <Card className="card-hover">
      <CardContent className="p-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
            {description && (
              <p className="text-xs text-text-secondary">{description}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 pt-1">
                {trend.positive ? (
                  <ArrowUp className="h-3 w-3 text-accent-emerald" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-accent-red" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.positive ? 'text-accent-emerald' : 'text-accent-red'
                  )}
                >
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', colorStyles[color])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
