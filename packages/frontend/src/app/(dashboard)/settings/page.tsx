'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, Globe, Shield, Bell, Users, Paintbrush, Wifi, HardDrive } from 'lucide-react';

function GeneralTab() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent-cyan" />
            {t('settings.general')}
          </CardTitle>
          <CardDescription>Configure general application settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('settings.language')}</label>
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1">Deutsch</Button>
                <Button variant="secondary" size="sm" className="flex-1">English</Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Timezone</label>
              <Input defaultValue="Europe/Berlin" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-accent-violet" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the interface appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Dark Mode</p>
              <p className="text-xs text-text-muted">Dark theme is always enabled for security monitoring</p>
            </div>
            <Switch checked disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">Compact Mode</p>
              <p className="text-xs text-text-muted">Reduce spacing for denser data views</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>
          <Save className="h-4 w-4 mr-1" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function ScanningTab() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4 text-accent-cyan" />
            {t('settings.scanning')}
          </CardTitle>
          <CardDescription>Configure network scanning parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.interval')}</label>
              <Input type="number" defaultValue="3600" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.port_range')}</label>
              <Input defaultValue="1-10000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.timeout')}</label>
              <Input type="number" defaultValue="30" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.max_hosts')}</label>
              <Input type="number" defaultValue="256" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.auto_rescan')}</p>
              <p className="text-xs text-text-muted">Automatically rescan networks on a schedule</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.os_detection')}</p>
              <p className="text-xs text-text-muted">Enable OS fingerprinting during scans</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.service_detection')}</p>
              <p className="text-xs text-text-muted">Detect service versions on open ports</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>
          <Save className="h-4 w-4 mr-1" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function DiscordTab() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent-cyan" />
            {t('settings.discord')}
          </CardTitle>
          <CardDescription>Configure Discord webhook notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">{t('discord.webhook_url')}</label>
            <Input placeholder={t('discord.webhook_placeholder')} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('discord.alert_level')}</label>
              <select className="flex h-9 w-full rounded-lg border border-border-default bg-inset px-3 py-1 text-sm text-text-primary">
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('discord.notification_channel')}</label>
              <Input placeholder="#alerts" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('discord.send_alerts')}</p>
              <p className="text-xs text-text-muted">Send alerts to Discord webhook</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('discord.mention_everyone')}</p>
              <p className="text-xs text-text-muted">@everyone for critical alerts</p>
            </div>
            <Switch />
          </div>
          <Button variant="secondary">{t('discord.test_webhook')}</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>
          <Save className="h-4 w-4 mr-1" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function UsersTab() {
  const t = useTranslations();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any[]>([]);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();
        setData(result?.users || []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-cyan" />
            {t('users.title')}
          </CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-text-muted py-4 text-center">Loading users...</p>
          ) : error ? (
            <p className="text-sm text-text-muted py-4 text-center">Failed to load users</p>
          ) : (
            <>
              <div className="mb-4 flex justify-end">
                <Button size="sm">
                  <Users className="h-4 w-4 mr-1" />
                  {t('users.add_user')}
                </Button>
              </div>
              <div className="divide-y divide-border-default">
                {data.length === 0 ? (
                  <p className="text-sm text-text-muted py-4 text-center">No users found</p>
                ) : (
                  data.map((user) => (
                    <div key={user.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-cyan/10 text-xs font-medium text-accent-cyan">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{user.username}</p>
                          <p className="text-xs text-text-muted">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary capitalize">{user.role}</span>
                        <Switch checked={user.active} />
                        <Button variant="ghost" size="sm" className="text-text-muted">Edit</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations();

  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Globe className="h-4 w-4" />
            {t('settings.general')}
          </TabsTrigger>
          <TabsTrigger value="scanning" className="gap-2">
            <Wifi className="h-4 w-4" />
            {t('settings.scanning')}
          </TabsTrigger>
          <TabsTrigger value="discord" className="gap-2">
            <Bell className="h-4 w-4" />
            {t('settings.discord')}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            {t('users.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="scanning">
          <ScanningTab />
        </TabsContent>
        <TabsContent value="discord">
          <DiscordTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
