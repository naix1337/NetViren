'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatBytes } from '@/lib/utils';
import { Download, Play, Network, RefreshCw } from 'lucide-react';

const mockCaptures = [
  { id: '1', source: '192.168.1.100', interface: 'eth0', packets: 15423, size: 12582912, duration: 300, status: 'completed', startedAt: '2026-07-28 10:00' },
  { id: '2', source: '10.0.0.50', interface: 'eth0', packets: 89234, size: 73400320, duration: 600, status: 'completed', startedAt: '2026-07-28 08:00' },
  { id: '3', source: '192.168.1.50', interface: 'wlan0', packets: 3210, size: 2097152, duration: 120, status: 'running', startedAt: '2026-07-28 14:30' },
  { id: '4', source: '192.168.2.1', interface: 'eth1', packets: 56234, size: 41943040, duration: 900, status: 'completed', startedAt: '2026-07-27 22:00' },
  { id: '5', source: '10.0.0.100', interface: 'eth0', packets: 1250, size: 1048576, duration: 60, status: 'failed', startedAt: '2026-07-27 18:00' },
];

const statusColors: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  completed: 'success',
  running: 'info',
  failed: 'danger',
};

export default function PacketsPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{mockCaptures.length} captures</p>
        <div className="flex gap-2">
          <Button variant="default" size="sm">
            <Play className="h-4 w-4 mr-1" />
            {t('packets.start_capture')}
          </Button>
          <Button variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Captures Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('packets.source')}</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>{t('packets.packets')}</TableHead>
                <TableHead>{t('packets.size')}</TableHead>
                <TableHead>{t('packets.duration')}</TableHead>
                <TableHead>{t('packets.status')}</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">{t('packets.download')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCaptures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-text-muted py-8">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('packets.no_captures')}
                  </TableCell>
                </TableRow>
              ) : (
                mockCaptures.map((capture) => (
                  <TableRow key={capture.id}>
                    <TableCell className="font-mono text-xs text-text-primary">{capture.source}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{capture.interface}</TableCell>
                    <TableCell className="text-text-primary">{capture.packets.toLocaleString()}</TableCell>
                    <TableCell className="text-text-secondary">{formatBytes(capture.size)}</TableCell>
                    <TableCell className="text-text-secondary">{capture.duration}s</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[capture.status] || 'default'}>{capture.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">{capture.startedAt}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled={capture.status !== 'completed'}>
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PCAP
                      </Button>
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
