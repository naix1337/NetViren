'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPulse } from '@/components/shared/StatusPulse';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, FileSearch, Activity, Network, Plus, RefreshCw } from 'lucide-react';

const mockAgents = [
  { id: '1', name: 'Windows-01', type: 'windows', ip: '192.168.1.100', version: '1.2.0', status: 'online' as const, lastHeartbeat: '30s ago', filesScanned: 1254, processes: 87, connections: 342 },
  { id: '2', name: 'Windows-02', type: 'windows', ip: '192.168.1.101', version: '1.2.0', status: 'online' as const, lastHeartbeat: '45s ago', filesScanned: 987, processes: 64, connections: 198 },
  { id: '3', name: 'Linux-01', type: 'linux', ip: '192.168.1.50', version: '1.1.0', status: 'online' as const, lastHeartbeat: '1m ago', filesScanned: 3456, processes: 112, connections: 567 },
  { id: '4', name: 'Linux-02', type: 'linux', ip: '192.168.1.51', version: '1.1.0', status: 'offline' as const, lastHeartbeat: '2h ago', filesScanned: 2341, processes: 0, connections: 0 },
  { id: '5', name: 'Linux-03', type: 'linux', ip: '10.0.0.50', version: '1.2.0', status: 'error' as const, lastHeartbeat: '30m ago', filesScanned: 567, processes: 23, connections: 45 },
];

export default function AgentsPage() {
  const t = useTranslations();
  const [loading] = React.useState(false);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{mockAgents.length} agents registered</p>
        <div className="flex gap-2">
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('agents.deploy')}
          </Button>
          <Button variant="ghost" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockAgents.map((agent) => (
          <Card key={agent.id} className="card-hover cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan/10">
                  <Bot className="h-5 w-5 text-accent-cyan" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                  <p className="text-xs text-text-muted">{agent.ip}</p>
                </div>
              </div>
              <StatusPulse status={agent.status === 'error' ? 'warning' : agent.status} size="md" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={agent.type === 'windows' ? 'info' : 'success'}>
                  {agent.type}
                </Badge>
                <Badge variant={agent.status === 'online' ? 'success' : agent.status === 'offline' ? 'default' : 'danger'}>
                  {agent.status}
                </Badge>
                <span className="text-xs text-text-muted">v{agent.version}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface p-2">
                  <FileSearch className="h-3.5 w-3.5 mx-auto text-accent-cyan mb-1" />
                  <p className="text-xs font-medium text-text-primary">{agent.filesScanned.toLocaleString()}</p>
                  <p className="text-[10px] text-text-muted">{t('agents.files_scanned')}</p>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <Activity className="h-3.5 w-3.5 mx-auto text-accent-emerald mb-1" />
                  <p className="text-xs font-medium text-text-primary">{agent.processes}</p>
                  <p className="text-[10px] text-text-muted">{t('agents.processes')}</p>
                </div>
                <div className="rounded-lg bg-surface p-2">
                  <Network className="h-3.5 w-3.5 mx-auto text-accent-violet mb-1" />
                  <p className="text-xs font-medium text-text-primary">{agent.connections}</p>
                  <p className="text-[10px] text-text-muted">{t('agents.connections')}</p>
                </div>
              </div>
              <p className="text-xs text-text-muted mt-3">
                {t('agents.last_seen')}: {agent.lastHeartbeat}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
