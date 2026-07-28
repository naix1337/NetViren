'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusPulse } from '@/components/shared/StatusPulse';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, Scan, RefreshCw, Map, LayoutList } from 'lucide-react';

// Mock data
const mockDevices = [
  { id: '1', ip: '192.168.1.1', mac: '00:11:22:33:44:01', hostname: 'gateway', os: 'Linux', vendor: 'Ubiquiti', ports: 8, threat: 12, lastSeen: '2m ago', online: true },
  { id: '2', ip: '192.168.1.100', mac: '00:11:22:33:44:02', hostname: 'server-01', os: 'Windows Server 2022', vendor: 'Dell', ports: 14, threat: 45, lastSeen: '1m ago', online: true },
  { id: '3', ip: '192.168.1.101', mac: '00:11:22:33:44:03', hostname: 'server-02', os: 'Ubuntu 24.04', vendor: 'HP', ports: 6, threat: 8, lastSeen: '5m ago', online: true },
  { id: '4', ip: '192.168.1.105', mac: '00:11:22:33:44:04', hostname: 'workstation-01', os: 'Windows 11', vendor: 'Lenovo', ports: 22, threat: 67, lastSeen: '10m ago', online: true },
  { id: '5', ip: '192.168.1.200', mac: '00:11:22:33:44:05', hostname: 'printer-03', os: 'Embedded', vendor: 'HP', ports: 3, threat: 5, lastSeen: '2h ago', online: false },
  { id: '6', ip: '10.0.0.1', mac: '00:11:22:33:44:06', hostname: 'core-switch', os: 'IOS', vendor: 'Cisco', ports: 24, threat: 18, lastSeen: '30s ago', online: true },
  { id: '7', ip: '10.0.0.100', mac: '00:11:22:33:44:07', hostname: 'db-server', os: 'Debian 12', vendor: 'SuperMicro', ports: 5, threat: 22, lastSeen: '1m ago', online: true },
  { id: '8', ip: '192.168.2.50', mac: '00:11:22:33:44:08', hostname: 'cam-01', os: 'Embedded Linux', vendor: 'Hikvision', ports: 2, threat: 35, lastSeen: '30m ago', online: true },
];

const threatColor = (score: number) => {
  if (score <= 15) return 'success';
  if (score <= 40) return 'warning';
  return 'danger';
};

export default function DevicesPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'map'>('table');
  const [search, setSearch] = React.useState('');

  const filtered = mockDevices.filter(
    (d) =>
      d.ip.includes(search) ||
      d.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      d.mac.includes(search)
  );

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
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
          ]}
          className="w-36"
        />
        <Button variant="secondary" size="sm">
          <Filter className="h-4 w-4 mr-1" />
          Filter
        </Button>
        <Button variant="default" size="sm" className="ml-auto">
          <Scan className="h-4 w-4 mr-1" />
          {t('devices.start_scan')}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setViewMode(viewMode === 'table' ? 'map' : 'table')}>
          {viewMode === 'table' ? <Map className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>{t('devices.ip')}</TableHead>
                <TableHead>{t('devices.mac')}</TableHead>
                <TableHead>{t('devices.hostname')}</TableHead>
                <TableHead>{t('devices.os')}</TableHead>
                <TableHead>{t('devices.vendor')}</TableHead>
                <TableHead>{t('devices.ports')}</TableHead>
                <TableHead>{t('devices.threat')}</TableHead>
                <TableHead>{t('devices.last_seen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-text-muted py-8">
                    {t('devices.no_devices')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((device) => (
                  <TableRow key={device.id} className="cursor-pointer">
                    <TableCell>
                      <StatusPulse status={device.online ? 'online' : 'offline'} size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-primary">{device.ip}</TableCell>
                    <TableCell className="font-mono text-xs text-text-secondary">{device.mac}</TableCell>
                    <TableCell className="text-text-primary">{device.hostname}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{device.os}</TableCell>
                    <TableCell className="text-text-secondary">{device.vendor}</TableCell>
                    <TableCell>
                      <Badge variant="default">{device.ports}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={threatColor(device.threat)}>{device.threat}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">{device.lastSeen}</TableCell>
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
