'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThreatGauge } from '@/components/shared/ThreatGauge';
import { StatCard } from '@/components/shared/StatCard';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import {
  Monitor,
  Scan,
  Bell,
  Shield,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

const severityColors: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'default',
};

interface DashboardStats {
  threatScore: number;
  devicesOnline: number;
  totalDevices: number;
  activeScans: number;
  recentAlerts: number;
}

interface DashboardAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  time: string;
}

interface DashboardActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [stats, setStats] = React.useState<DashboardStats>({
    threatScore: 0, devicesOnline: 0, totalDevices: 0,
    activeScans: 0, recentAlerts: 0,
  });
  const [alerts, setAlerts] = React.useState<DashboardAlert[]>([]);
  const [activity, setActivity] = React.useState<DashboardActivity[]>([]);

  const fetchDashboardData = React.useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      api.get('/api/devices').catch(() => ({ devices: [] })),
      api.get('/api/scans').catch(() => ({ scans: [] })),
      api.get('/api/alerts').catch(() => ({ alerts: [] })),
    ])
      .then(([devicesData, scansData, alertsData]) => {
        const deviceList = devicesData.devices || [];
        const scanList = scansData.scans || [];
        const alertList = alertsData.alerts || [];
        const onlineDevices = deviceList.filter((d: any) => d.is_online || d.status === 'online').length;

        setStats({
          threatScore: Math.min(100, deviceList.reduce((acc: number, d: any) => acc + (d.threat_score || 0), 0)),
          devicesOnline: onlineDevices,
          totalDevices: deviceList.length,
          activeScans: scanList.filter((s: any) => s.status === 'running').length,
          recentAlerts: alertList.length,
        });

        setAlerts(alertList.slice(0, 5).map((a: any) => ({
          id: a.id,
          severity: a.severity || 'info',
          title: a.title || '',
          time: a.created_at ? new Date(a.created_at + 'Z').toLocaleString() : '',
        })));

        setActivity([
          ...scanList.slice(0, 3).map((s: any) => ({
            id: 'scan-' + s.id, type: 'scan',
            title: `Scan: ${s.scan_type || s.type || ''}`,
            description: `${s.status} — ${s.target || ''}`,
            timestamp: s.started_at || s.created_at || '',
          })),
          ...alertList.slice(0, 5).map((a: any) => ({
            id: 'alert-' + a.id, type: 'alert',
            title: a.title || '',
            description: a.description || '',
            timestamp: a.created_at || '',
          })),
        ]);

        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <p>Verbindung zum Server fehlgeschlagen</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ThreatGauge score={stats.threatScore} size="md" />

        <StatCard
          title={t('dashboard.devices_online')}
          value={stats.totalDevices > 0 ? `${stats.devicesOnline}/${stats.totalDevices}` : '—'}
          icon={<Monitor className="h-4 w-4" />}
          description="Total network devices"
          color="emerald"
        />

        <StatCard
          title={t('dashboard.active_scans')}
          value={stats.activeScans}
          icon={<Scan className="h-4 w-4" />}
          description="Currently running"
          color="cyan"
        />

        <StatCard
          title={t('dashboard.recent_alerts')}
          value={stats.recentAlerts}
          icon={<Bell className="h-4 w-4" />}
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
          <Button variant="ghost" size="sm" className="text-text-muted gap-1" onClick={() => router.push('/alerts')}>
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-text-muted">
              Keine aktuellen Alarme
            </div>
          ) : (
            <div className="divide-y divide-border-default">
              {alerts.map((alert) => (
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
                    <Badge variant={severityColors[alert.severity] || 'default'}>
                      {alert.severity}
                    </Badge>
                    <span className="text-xs text-text-muted">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom: Live Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent-cyan" />
            {t('dashboard.live_activity')}
          </CardTitle>
          <Button variant="ghost" size="icon" className="text-text-muted" onClick={fetchDashboardData}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">
              Keine Aktivitäten vorhanden
            </div>
          ) : (
            <ActivityFeed items={activity} maxItems={10} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
