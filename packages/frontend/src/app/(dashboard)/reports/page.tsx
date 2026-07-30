'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { FileText, Download, Plus, RefreshCw, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

const typeColors = {
  daily: 'info' as const,
  manual: 'violet' as const,
};

const statusColors: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  completed: 'success',
  generating: 'info',
  failed: 'danger',
};

const statusIcons: Record<string, React.ReactNode> = {
  generating: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
};

export default function ReportsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchReports = React.useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/api/reports')
      .then((json) => {
        setData(json.reports || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      const newReport = await api.post('/api/reports/generate', {
        reportType: 'daily',
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
      });
      setData((prev) => [newReport, ...prev]);
      setFeedback({ type: 'success', message: 'Report generated successfully.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to generate report' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = (reportId: string, status: string) => {
    if (status === 'completed') {
      router.push(`/api/reports/${reportId}/download`);
    } else {
      alert('Report generation still in progress');
    }
  };

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
        <p className="text-text-muted">Failed to load reports. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{data.length} reports</p>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleGenerateReport} disabled={generating}>
            <Plus className="h-4 w-4 mr-1" />
            {generating ? 'Generating...' : t('reports.generate')}
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchReports}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
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

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-accent-cyan" />
            {t('reports.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.title')}</TableHead>
                <TableHead>{t('reports.report_type')}</TableHead>
                <TableHead>{t('reports.period')}</TableHead>
                <TableHead>{t('packets.status')}</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">{t('reports.download')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-text-muted py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t('reports.no_reports')}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-text-primary font-medium">{report.title}</TableCell>
                    <TableCell>
                      <Badge variant={typeColors[report.type as keyof typeof typeColors]}>{report.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">{report.period}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[report.status] || 'default'}>
                        <span className="flex items-center gap-1">
                          {statusIcons[report.status]}
                          {t(`reports.status_${report.status}`)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {report.file_size ? formatBytes(report.file_size) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {report.created_at ? new Date(report.created_at + 'Z').toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={report.status !== 'completed'}
                        className="text-accent-cyan"
                        onClick={() => handleDownloadPdf(report.id, report.status)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
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
