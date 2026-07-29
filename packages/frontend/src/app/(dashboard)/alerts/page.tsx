'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, CheckCheck, Filter, RefreshCw, AlertTriangle, Monitor, Scan, Bot } from 'lucide-react';

const severityColors = {
  critical: 'danger' as const,
  high: 'danger' as const,
  medium: 'warning' as const,
  low: 'info' as const,
  info: 'default' as const,
};

const typeIcons: Record<string, React.ReactNode> = {
  new_device: <Monitor className="h-3.5 w-3.5" />,
  threat: <AlertTriangle className="h-3.5 w-3.5" />,
  agent_offline: <Bot className="h-3.5 w-3.5" />,
  vt_hit: <Scan className="h-3.5 w-3.5" />,
  scan_complete: <Scan className="h-3.5 w-3.5" />,
  port_change: <Monitor className="h-3.5 w-3.5" />,
  device_offline: <Monitor className="h-3.5 w-3.5" />,
};

export default function AlertsPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [filterSeverity, setFilterSeverity] = React.useState('all');

  React.useEffect(() => {
    fetch('/api/alerts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        setData(json.alerts || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const unreadCount = data.filter((a) => !a.is_read).length;

  const filtered = filterSeverity === 'all'
    ? data
    : data.filter((a) => a.severity === filterSeverity);

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
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Failed to load alerts. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{data.length} alerts</span>
          {unreadCount > 0 && (
            <Badge variant="danger">{unreadCount} unread</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <CheckCheck className="h-4 w-4 mr-1" />
            {t('alerts.mark_all_read')}
          </Button>
          <Button variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={filterSeverity}
          onChange={(e: any) => setFilterSeverity(e.target.value)}
          options={[
            { value: 'all', label: 'All Severities' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
            { value: 'info', label: 'Info' },
          ]}
          className="w-44"
        />
        <Button variant="secondary" size="sm">
          <Filter className="h-4 w-4 mr-1" />
          {t('alerts.filter_severity')}
        </Button>
      </div>

      {/* Alerts List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t('alerts.type')}</TableHead>
                <TableHead>{t('alerts.severity')}</TableHead>
                <TableHead>{t('alerts.description')}</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-text-muted py-8">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('alerts.no_alerts')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((alert) => (
                  <TableRow key={alert.id} className={!alert.is_read ? 'bg-accent-cyan/[0.02]' : ''}>
                    <TableCell>
                      {!alert.is_read && <span className="flex h-2 w-2 rounded-full bg-accent-cyan" />}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">
                          {typeIcons[alert.type] || <Bell className="h-3.5 w-3.5" />}
                        </span>
                        <span className="text-xs text-text-muted">{alert.type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColors[alert.severity as keyof typeof severityColors]}>{alert.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={`text-sm ${!alert.is_read ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                          {alert.title}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">{alert.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-text-muted whitespace-nowrap">
                      {alert.created_at ? new Date(alert.created_at + 'Z').toLocaleString() : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
