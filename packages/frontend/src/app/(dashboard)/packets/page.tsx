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

const statusColors: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  completed: 'success',
  running: 'info',
  failed: 'danger',
};

export default function PacketsPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/packets');
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();
        setData(result?.packets || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
            <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load captures</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{data.length} captures</p>
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
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-text-muted py-8">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('packets.no_captures')}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((capture) => (
                  <TableRow key={capture.id}>
                    <TableCell className="font-mono text-xs text-text-primary">{capture.source}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{capture.interface}</TableCell>
                    <TableCell className="text-text-primary">{capture.packets.toLocaleString()}</TableCell>
                    <TableCell className="text-text-secondary">{formatBytes(capture.size)}</TableCell>
                    <TableCell className="text-text-secondary">{capture.duration}s</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[capture.status] || 'default'}>{capture.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">{new Date(capture.created_at + 'Z').toLocaleString()}</TableCell>
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
