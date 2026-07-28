'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusPulse } from './StatusPulse';
import { Shield, Monitor, Bot, AlertTriangle, Scan, FileSearch } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  severity?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  scan: <Scan className="h-3.5 w-3.5" />,
  alert: <AlertTriangle className="h-3.5 w-3.5" />,
  device: <Monitor className="h-3.5 w-3.5" />,
  agent: <Bot className="h-3.5 w-3.5" />,
  file: <FileSearch className="h-3.5 w-3.5" />,
  default: <Shield className="h-3.5 w-3.5" />,
};

const typeStyles: Record<string, string> = {
  scan: 'bg-accent-cyan/10 text-accent-cyan',
  alert: 'bg-accent-red/10 text-accent-red',
  device: 'bg-accent-violet/10 text-accent-violet',
  agent: 'bg-accent-emerald/10 text-accent-emerald',
  file: 'bg-accent-amber/10 text-accent-amber',
  default: 'bg-surface text-text-secondary',
};

function getStatusFromSeverity(severity?: string): 'online' | 'offline' | 'scanning' | 'threat' | 'warning' {
  switch (severity) {
    case 'critical': return 'threat';
    case 'high': return 'threat';
    case 'medium': return 'warning';
    case 'low': return 'scanning';
    default: return 'online';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ items, maxItems = 20 }: ActivityFeedProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Shield className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-1">
        {displayItems.map((item, index) => {
          const icon = typeIcons[item.type] || typeIcons.default;
          const style = typeStyles[item.type] || typeStyles.default;
          const status = getStatusFromSeverity(item.severity);

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 rounded-lg p-3 transition-all duration-300',
                'hover:bg-hover/50 slide-in',
                index === 0 && 'bg-accent-cyan/5 border border-accent-cyan/10'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col items-center gap-1">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', style)}>
                  {icon}
                </div>
                <StatusPulse status={status} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
              <time className="text-xs text-text-muted whitespace-nowrap flex-shrink-0">
                {timeAgo(item.timestamp)}
              </time>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
