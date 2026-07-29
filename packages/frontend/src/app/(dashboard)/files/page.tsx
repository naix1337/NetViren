'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Search, Upload, ExternalLink, Shield } from 'lucide-react';

export default function FilesPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const vtBadgeColors: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    clean: 'success',
    malicious: 'danger',
    unknown: 'warning',
    pending: 'default',
    error: 'danger',
  };

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/agents');
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();
        // Flatten agent file scans into a file list
        const agents = result.agents || [];
        const allFiles = agents.flatMap((a: any) =>
          (a.recent_files || a.files || []).map((f: any) => ({...f, agentName: a.name}))
        );
        setData(allFiles);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = data.filter(
    (f) =>
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.sha256.includes(search)
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
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center text-text-muted">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load files</p>
          </CardContent>
        </Card>
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
        <Button variant="default" size="sm" className="ml-auto">
          <Upload className="h-4 w-4 mr-1" />
          {t('files.upload_file')}
        </Button>
      </div>

      {/* Files Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('files.file')}</TableHead>
                <TableHead>{t('files.path')}</TableHead>
                <TableHead>{t('files.size')}</TableHead>
                <TableHead>{t('files.hash')}</TableHead>
                <TableHead>{t('files.vt_status')}</TableHead>
                <TableHead className="text-right">{t('files.check_vt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-8">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('files.no_files')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="text-text-primary font-medium">{file.file_name}</TableCell>
                    <TableCell className="text-xs text-text-muted font-mono max-w-[200px] truncate">{file.path}</TableCell>
                    <TableCell className="text-text-secondary">{formatBytes(file.size)}</TableCell>
                    <TableCell className="font-mono text-xs text-text-secondary">{file.sha256}</TableCell>
                    <TableCell>
                      <Badge variant={vtBadgeColors[file.vt_status] || 'default'}>{file.vt_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-accent-cyan">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Check
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
