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

const mockAlerts = [
  { id: '1', type: 'new_device', severity: 'critical' as const, title: 'New device detected on subnet 192.168.1.0/24', description: 'Unknown device with IP 192.168.1.205 has appeared on the network', timestamp: '2026-07-28T14:32:00', isRead: false },
  { id: '2', type: 'threat', severity: 'high' as const, title: 'Suspicious port scan detected', description: 'Port scan targeting 10.0.0.0/24 from external IP 203.0.113.45', timestamp: '2026-07-28T14:15:00', isRead: false },
  { id: '3', type: 'agent_offline', severity: 'medium' as const, title: 'Agent Linux-03 heartbeat missed', description: 'No heartbeat received from Linux-03 for over 30 minutes', timestamp: '2026-07-28T13:45:00', isRead: true },
  { id: '4', type: 'vt_hit', severity: 'high' as const, title: 'VirusTotal malicious detection', description: 'File "suspicious.exe" (SHA256: b2c3...) flagged as malicious by 5/68 vendors', timestamp: '2026-07-28T13:00:00', isRead: false },
  { id: '5', type: 'scan_complete', severity: 'info' as const, title: 'Full scan completed', description: '10.0.0.0/24: 12 devices found, 34 open ports detected', timestamp: '2026-07-28T12:30:00', isRead: true },
  { id: '6', type: 'port_change', severity: 'medium' as const, title: 'Port change detected on server-01', description: 'New port 8443/TCP opened on server-01 (192.168.1.100)', timestamp: '2026-07-28T11:00:00', isRead: true },
  { id: '7', type: 'device_offline', severity: 'low' as const, title: 'Device offline: printer-03', description: 'Printer at 192.168.1.200 has been offline for over 2 hours', timestamp: '2026-07-28T10:00:00', isRead: true },
  { id: '8', type: 'new_device', severity: 'low' as const, title: 'New device: iPhone-Admin', description: 'Device 192.168.1.150 - Apple iPhone - connected to WiFi', timestamp: '2026-07-28T09:30:00', isRead: true },
  { id: '9', type: 'scan_complete', severity: 'info' as const, title: 'VirusTotal batch check complete', description: '15 hashes checked: 2 malicious, 12 clean, 1 unknown', timestamp: '2026-07-28T08:00:00', isRead: true },
  { id: '10', type: 'threat', severity: 'critical' as const, title: 'Beaconing activity detected', description: '10.0.0.45 communicating with known C2 server (198.51.100.23) every 60s', timestamp: '2026-07-28T06:00:00', isRead: true },
];

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

const unreadCount = mockAlerts.filter((a) => !a.isRead).length;

export default function AlertsPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);
  const [filterSeverity, setFilterSeverity] = React.useState('all');

  const filtered = filterSeverity === 'all'
    ? mockAlerts
    : mockAlerts.filter((a) => a.severity === filterSeverity);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{mockAlerts.length} alerts</span>
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
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-text-muted py-8">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('alerts.no_alerts')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((alert) => (
                  <TableRow key={alert.id} className={!alert.isRead ? 'bg-accent-cyan/[0.02]' : ''}>
                    <TableCell>
                      {!alert.isRead && <span className="flex h-2 w-2 rounded-full bg-accent-cyan" />}
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
                      <Badge variant={severityColors[alert.severity]}>{alert.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={`text-sm ${!alert.isRead ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                          {alert.title}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">{alert.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-text-muted whitespace-nowrap">
                      {alert.timestamp}
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
