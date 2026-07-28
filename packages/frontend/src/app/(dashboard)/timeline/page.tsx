'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPulse } from '@/components/shared/StatusPulse';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Scan, AlertTriangle, Monitor, Bot, User, Settings, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'scan' | 'alert' | 'device' | 'agent' | 'user' | 'system';
  title: string;
  description: string;
  timestamp: string;
  actor?: string;
}

const mockEvents: TimelineEvent[] = [
  { id: '1', type: 'scan', title: 'Quick scan started', description: 'Scanning 192.168.1.0/24 subnet', timestamp: '2026-07-28T14:32:00', actor: 'System' },
  { id: '2', type: 'alert', title: 'High severity alert', description: 'Suspicious outbound connection detected from 10.0.0.45', timestamp: '2026-07-28T14:30:00', actor: 'System' },
  { id: '3', type: 'device', title: 'New device discovered', description: '192.168.1.105 - Intel - Windows 11', timestamp: '2026-07-28T14:15:00', actor: 'Scanner' },
  { id: '4', type: 'agent', title: 'Agent heartbeat received', description: 'Linux-01 - 3,456 files scanned', timestamp: '2026-07-28T14:14:00', actor: 'Linux-01' },
  { id: '5', type: 'scan', title: 'Full scan completed', description: '10.0.0.0/24: 12 devices, 34 open ports', timestamp: '2026-07-28T13:00:00', actor: 'System' },
  { id: '6', type: 'user', title: 'User logged in', description: 'admin user authenticated via SSO', timestamp: '2026-07-28T12:45:00', actor: 'admin' },
  { id: '7', type: 'system', title: 'System update applied', description: 'Agent version updated to 1.2.0', timestamp: '2026-07-28T12:00:00', actor: 'System' },
  { id: '8', type: 'alert', title: 'Medium: Port change detected', description: 'server-01: new port 8443/TCP opened', timestamp: '2026-07-28T11:30:00', actor: 'System' },
  { id: '9', type: 'device', title: 'Device went offline', description: 'printer-03 (192.168.1.200) - Last seen 2h ago', timestamp: '2026-07-28T11:00:00', actor: 'System' },
  { id: '10', type: 'scan', title: 'VirusTotal batch check', description: '15 file hashes checked - 2 malicious detections', timestamp: '2026-07-28T10:00:00', actor: 'VT Service' },
  { id: '11', type: 'agent', title: 'Agent registered', description: 'New Linux agent: Linux-04 (10.0.0.55)', timestamp: '2026-07-28T09:00:00', actor: 'Linux-04' },
  { id: '12', type: 'user', title: 'Configuration changed', description: 'Scan schedule updated: daily full scan at 02:00', timestamp: '2026-07-28T08:30:00', actor: 'admin' },
];

const typeIcons: Record<string, React.ReactNode> = {
  scan: <Scan className="h-4 w-4 text-accent-cyan" />,
  alert: <AlertTriangle className="h-4 w-4 text-accent-red" />,
  device: <Monitor className="h-4 w-4 text-accent-violet" />,
  agent: <Bot className="h-4 w-4 text-accent-emerald" />,
  user: <User className="h-4 w-4 text-accent-amber" />,
  system: <Settings className="h-4 w-4 text-text-secondary" />,
};

const typeBorders: Record<string, string> = {
  scan: 'border-accent-cyan',
  alert: 'border-accent-red',
  device: 'border-accent-violet',
  agent: 'border-accent-emerald',
  user: 'border-accent-amber',
  system: 'border-border-hover',
};

export default function TimelinePage() {
  const t = useTranslations();
  const [loading] = React.useState(false);
  const [filter, setFilter] = React.useState('all');

  const filtered = filter === 'all'
    ? mockEvents
    : mockEvents.filter((e) => e.type === filter);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select
          value={filter}
          onChange={(e: any) => setFilter(e.target.value)}
          options={[
            { value: 'all', label: t('timeline.all_events') },
            { value: 'scan', label: t('timeline.scan_event') },
            { value: 'alert', label: t('timeline.alert_event') },
            { value: 'device', label: t('timeline.device_event') },
            { value: 'agent', label: t('timeline.agent_event') },
            { value: 'user', label: t('timeline.user_event') },
            { value: 'system', label: t('timeline.system_event') },
          ]}
          className="w-48"
        />
        <span className="text-sm text-text-muted">{filtered.length} events</span>
      </div>

      {/* Timeline */}
      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border-default" />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t('timeline.no_events')}</p>
            </div>
          ) : (
            filtered.map((event) => (
              <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Timeline dot */}
                <div className={`relative z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 bg-surface ${typeBorders[event.type]}`}>
                  {typeIcons[event.type]}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-text-primary">{event.title}</h3>
                    <time className="text-xs text-text-muted whitespace-nowrap">{event.timestamp}</time>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{event.description}</p>
                  {event.actor && (
                    <p className="text-xs text-text-muted mt-0.5">by {event.actor}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
