'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ThreatGauge } from '@/components/shared/ThreatGauge';
import { StatCard } from '@/components/shared/StatCard';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Monitor,
  Scan,
  Bell,
  Shield,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

// Mock data for demonstration
const mockStats = {
  threatScore: 32,
  devicesOnline: 14,
  totalDevices: 24,
  activeScans: 2,
  recentAlerts: 7,
};

const mockAlerts = [
  { id: '1', severity: 'critical' as const, title: 'New device detected on subnet 192.168.1.0/24', time: '2m ago' },
  { id: '2', severity: 'high' as const, title: 'Suspicious port scan detected from 10.0.0.45', time: '15m ago' },
  { id: '3', severity: 'medium' as const, title: 'Agent Linux-03 heartbeat missed', time: '1h ago' },
  { id: '4', severity: 'low' as const, title: 'Scan completed: 5 devices found', time: '2h ago' },
  { id: '5', severity: 'info' as const, title: 'VirusTotal check: 2 files clean', time: '3h ago' },
];

const mockActivity = [
  { id: 'a1', type: 'scan', title: 'Quick scan started on 192.168.1.0/24', description: 'Scanning 254 hosts', timestamp: new Date(Date.now() - 30000).toISOString() },
  { id: 'a2', type: 'alert', title: 'High severity alert: Suspicious connection', description: 'Beaconing detected from 10.0.0.45 to external IP', timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: 'a3', type: 'device', title: 'New device discovered: 192.168.1.105', description: 'Vendor: Intel, OS: Windows 11', timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'a4', type: 'agent', title: 'Agent heartbeat: Windows-02', description: 'Status: online, 45 files scanned', timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'a5', type: 'file', title: 'File scan complete: suspicious.exe', description: 'SHA256: a1b2...c3d4 - VT: malicious (3/68)', timestamp: new Date(Date.now() - 900000).toISOString() },
  { id: 'a6', type: 'scan', title: 'Full scan completed on 10.0.0.0/24', description: '12 devices found, 34 open ports', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'a7', type: 'alert', title: 'Medium: Port change detected on server-01', description: 'New port 8443 opened', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'a8', type: 'device', title: 'Device offline: printer-03 (192.168.1.200)', description: 'Last seen: 2 hours ago', timestamp: new Date(Date.now() - 7200000).toISOString() },
];

const severityColors = {
  critical: 'danger' as const,
  high: 'danger' as const,
  medium: 'warning' as const,
  low: 'info' as const,
  info: 'default' as const,
};

export default function DashboardPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ThreatGauge score={mockStats.threatScore} size="md" />

        <StatCard
          title={t('dashboard.devices_online')}
          value={`${mockStats.devicesOnline}/${mockStats.totalDevices}`}
          icon={<Monitor className="h-4 w-4" />}
          trend={{ value: 12, positive: true }}
          description="Total network devices"
          color="emerald"
        />

        <StatCard
          title={t('dashboard.active_scans')}
          value={mockStats.activeScans}
          icon={<Scan className="h-4 w-4" />}
          description="Currently running"
          color="cyan"
        />

        <StatCard
          title={t('dashboard.recent_alerts')}
          value={mockStats.recentAlerts}
          icon={<Bell className="h-4 w-4" />}
          trend={{ value: 8, positive: false }}
          description="Last 24 hours"
          color="red"
        />
      </div>

      {/* Middle: Recent Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent-cyan" />
            {t('dashboard.recent_alerts')}
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-text-muted gap-1">
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border-default">
            {mockAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className={cn(
                    'h-4 w-4',
                    alert.severity === 'critical' && 'text-accent-red',
                    alert.severity === 'high' && 'text-accent-amber',
                    alert.severity === 'medium' && 'text-accent-amber',
                    alert.severity === 'low' && 'text-accent-cyan',
                    alert.severity === 'info' && 'text-text-muted'
                  )} />
                  <span className="text-sm text-text-primary">{alert.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={severityColors[alert.severity]}>
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-text-muted">{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom: Live Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent-cyan" />
            {t('dashboard.live_activity')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="text-text-muted">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={mockActivity} maxItems={10} />
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
