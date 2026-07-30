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
import { api } from '@/lib/api-client';
import { Search, Upload, ExternalLink, Shield } from 'lucide-react';

export default function FilesPage() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [vtLoading, setVtLoading] = React.useState<string | null>(null);
  const [vtResults, setVtResults] = React.useState<Record<string, any>>({});
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const vtBadgeColors: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    clean: 'success',
    malicious: 'danger',
    unknown: 'warning',
    pending: 'default',
    error: 'danger',
  };

  const fetchFiles = React.useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/api/agents')
      .then((result) => {
        const agents = result.agents || [];
        const allFiles = agents.flatMap((a: any) =>
          (a.recent_files || a.files || []).map((f: any) => ({...f, agentName: a.name}))
        );
        setData(allFiles);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadClick = () => {
    alert('File upload via agent deployment');
  };

  const handleVtCheck = async (fileId: string, sha256: string) => {
    setVtLoading(fileId);
    setFeedback(null);
    try {
      const result = await api.post('/api/vt/lookup', { hash: sha256 });
      setVtResults((prev) => ({ ...prev, [fileId]: result }));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'VT lookup failed' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setVtLoading(null);
    }
  };

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
        <Button variant="default" size="sm" onClick={handleUploadClick}>
          <Upload className="h-4 w-4 mr-1" />
          {t('files.upload_file')}
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchFiles}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20'
            : 'bg-accent-red/10 text-accent-red border border-accent-red/20'
        }`}>
          {feedback.message}
        </div>
      )}

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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-accent-cyan"
                        onClick={() => handleVtCheck(file.id, file.sha256)}
                        disabled={vtLoading === file.id}
                      >
                        {vtLoading === file.id ? (
                          <span className="flex items-center gap-1">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
                            Checking
                          </span>
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Check
                          </>
                        )}
                      </Button>
                      {vtResults[file.id] && (
                        <span className="ml-2 text-xs font-medium text-accent-emerald">Scanned</span>
                      )}
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
