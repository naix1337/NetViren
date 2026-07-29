'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { StatusPulse } from '@/components/shared/StatusPulse';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Scan, AlertTriangle, Monitor, Bot, User, Settings, Clock } from 'lucide-react';

export default function TimelinePage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState('all');

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

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [alertsRes, scansRes] = await Promise.all([
          fetch('/api/alerts'),
          fetch('/api/scans'),
        ]);

        const alertsData = alertsRes.ok ? await alertsRes.json() : { alerts: [] };
        const scansData = scansRes.ok ? await scansRes.json() : { scans: [] };
        const alerts = alertsData.alerts || [];
        const scans = scansData.scans || [];

        const timelineEvents: any[] = [];
        if (Array.isArray(alerts)) {
          alerts.forEach((a: any) => timelineEvents.push({ ...a, type: a.type || 'alert' }));
        }
        if (Array.isArray(scans)) {
          scans.forEach((s: any) => timelineEvents.push({ ...s, type: s.type || 'scan' }));
        }

        timelineEvents.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
        setData(timelineEvents);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = filter === 'all'
    ? data
    : data.filter((e) => e.type === filter);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center text-text-muted">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load timeline</p>
          </CardContent>
        </Card>
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
                    <time className="text-xs text-text-muted whitespace-nowrap">{new Date(event.created_at + 'Z').toLocaleString()}</time>
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
