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

const mockFiles = [
  { id: '1', fileName: 'document.pdf', path: 'C:\\Users\\user\\Documents\\document.pdf', size: 2457600, sha256: 'a1b2c3d4e5f6...', vtStatus: 'clean' as const },
  { id: '2', fileName: 'suspicious.exe', path: 'C:\\Users\\user\\Downloads\\suspicious.exe', size: 1572864, sha256: 'b2c3d4e5f6a7...', vtStatus: 'malicious' as const },
  { id: '3', fileName: 'installer.msi', path: 'C:\\Users\\user\\Downloads\\installer.msi', size: 52428800, sha256: 'c3d4e5f6a7b8...', vtStatus: 'unknown' as const },
  { id: '4', fileName: 'report.xlsx', path: 'C:\\Users\\user\\Desktop\\report.xlsx', size: 1048576, sha256: 'd4e5f6a7b8c9...', vtStatus: 'clean' as const },
  { id: '5', fileName: 'script.ps1', path: 'C:\\Users\\user\\Documents\\script.ps1', size: 8192, sha256: 'e5f6a7b8c9d0...', vtStatus: 'pending' as const },
  { id: '6', fileName: 'malware-sample.dll', path: 'C:\\Windows\\Temp\\malware-sample.dll', size: 458752, sha256: 'f6a7b8c9d0e1...', vtStatus: 'malicious' as const },
];

const vtBadgeColors = {
  clean: 'success' as const,
  malicious: 'danger' as const,
  unknown: 'warning' as const,
  pending: 'default' as const,
  error: 'danger' as const,
};

export default function FilesPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filtered = mockFiles.filter(
    (f) =>
      f.fileName.toLowerCase().includes(search.toLowerCase()) ||
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
                    <TableCell className="text-text-primary font-medium">{file.fileName}</TableCell>
                    <TableCell className="text-xs text-text-muted font-mono max-w-[200px] truncate">{file.path}</TableCell>
                    <TableCell className="text-text-secondary">{formatBytes(file.size)}</TableCell>
                    <TableCell className="font-mono text-xs text-text-secondary">{file.sha256}</TableCell>
                    <TableCell>
                      <Badge variant={vtBadgeColors[file.vtStatus]}>{file.vtStatus}</Badge>
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
