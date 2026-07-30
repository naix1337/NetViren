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
import { api } from '@/lib/api-client';
import { Search, Filter, Scan, RefreshCw, Map, LayoutList } from 'lucide-react';

const threatColor = (score: number) => {
  if (score <= 15) return 'success';
  if (score <= 40) return 'warning';
  return 'danger';
};

export default function DevicesPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'table' | 'map'>('table');
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [scanning, setScanning] = React.useState(false);
  const [scanMessage, setScanMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDevices = React.useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/api/devices')
      .then((json) => {
        setData(json.devices || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleStartScan = async () => {
    setScanMessage(null);
    setScanning(true);
    try {
      await api.post('/api/scans', { scanType: 'arp', target: 'AUTO' });
      setScanMessage({ type: 'success', text: 'Scan started successfully.' });
    } catch (err: any) {
      setScanMessage({ type: 'error', text: err.message || 'Failed to start scan' });
    } finally {
      setScanning(false);
    }
  };

  const handleViewToggle = () => {
    if (viewMode === 'table') {
      setViewMode('map');
      alert('Map view coming soon');
    } else {
      setViewMode('table');
    }
  };

  const statusFiltered = filterStatus === 'all'
    ? data
    : data.filter((d) => {
        const status = d.is_online ? 'online' : 'offline';
        return status === filterStatus;
      });

  const filtered = statusFiltered.filter(
    (d) =>
      (d.ip_address || d.ip || '').includes(search) ||
      (d.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.mac_address || d.mac || '').includes(search)
  );

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
        <p className="text-text-muted">Failed to load devices. Please try again.</p>
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
          value={filterStatus}
          onChange={(e: any) => setFilterStatus(e.target.value)}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
          ]}
          className="w-36"
        />
        <Button variant="secondary" size="sm" onClick={() => {
          const statuses: string[] = [];
          if (filterStatus === 'all' || filterStatus === 'online') statuses.push('online');
          if (filterStatus === 'all' || filterStatus === 'offline') statuses.push('offline');
          setFilterStatus(filterStatus === 'all' ? 'online' : filterStatus === 'online' ? 'offline' : 'all');
        }}>
          <Filter className="h-4 w-4 mr-1" />
          Filter
        </Button>
        <Button variant="default" size="sm" className="ml-auto" onClick={handleStartScan} disabled={scanning}>
          <Scan className="h-4 w-4 mr-1" />
          {scanning ? 'Scanning...' : t('devices.start_scan')}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleViewToggle}>
          {viewMode === 'table' ? <Map className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchDevices}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Scan message */}
      {scanMessage && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
          scanMessage.type === 'success'
            ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
            : 'bg-accent-red/10 text-accent-red border border-accent-red/20'
        }`}>
          <span>{scanMessage.text}</span>
          <button onClick={() => setScanMessage(null)} className="text-xs underline opacity-70 hover:opacity-100 ml-4">Dismiss</button>
        </div>
      )}

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
              {filtered.length === 0 || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-text-muted py-8">
                    {t('devices.no_devices')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((device) => (
                  <TableRow key={device.id} className="cursor-pointer">
                    <TableCell>
                      <StatusPulse status={device.is_online ? 'online' : 'offline'} size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-primary">{device.ip_address}</TableCell>
                    <TableCell className="font-mono text-xs text-text-secondary">{device.mac_address}</TableCell>
                    <TableCell className="text-text-primary">{device.hostname}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{device.os_detected}</TableCell>
                    <TableCell className="text-text-secondary">{device.vendor}</TableCell>
                    <TableCell>
                      <Badge variant="default">{device.ports || device.port_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={threatColor(device.threat_score)}>{device.threat_score}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {device.last_seen ? new Date(device.last_seen + 'Z').toLocaleString() : '-'}
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
