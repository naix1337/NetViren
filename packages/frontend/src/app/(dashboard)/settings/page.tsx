'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, Globe, Shield, Bell, Users, Paintbrush, Wifi, HardDrive, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function getAuthHeaders(): Record<string, string> {
  // Auth is handled by httpOnly cookie — no manual token needed
  return { 'Content-Type': 'application/json' };
}

function GeneralTab() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [language, setLanguage] = React.useState(locale);
  const [timezone, setTimezone] = React.useState('Europe/Berlin');
  const [compactMode, setCompactMode] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.language) setLanguage(data.language);
          if (data.timezone) setTimezone(data.timezone);
          if (data.compactMode !== undefined) setCompactMode(data.compactMode);
        }
      } catch {
        // Keep defaults
      }
    };
    fetchSettings();
  }, []);

  const handleLanguageChange = (newLocale: string) => {
    setLanguage(newLocale);
    router.replace(pathname, { locale: newLocale });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ language, timezone, compactMode }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

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
                <Button
                  variant={language === 'de' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleLanguageChange('de')}
                >
                  Deutsch
                </Button>
                <Button
                  variant={language === 'en' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => handleLanguageChange('en')}
                >
                  English
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Timezone</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
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
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mr-1 text-green-400" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-4 w-4 mr-1 text-red-400" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saveStatus === 'saving'
            ? t('common.saving')
            : saveStatus === 'success'
            ? t('settings.saved')
            : saveStatus === 'error'
            ? t('settings.save_error')
            : t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function ScanningTab() {
  const t = useTranslations();

  const [scanInterval, setScanInterval] = React.useState('3600');
  const [portRange, setPortRange] = React.useState('1-10000');
  const [timeoutValue, setTimeoutValue] = React.useState('30');
  const [maxHosts, setMaxHosts] = React.useState('256');
  const [autoRescan, setAutoRescan] = React.useState(true);
  const [osDetection, setOsDetection] = React.useState(true);
  const [serviceDetection, setServiceDetection] = React.useState(true);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.scanInterval) setScanInterval(data.scanInterval.toString());
          if (data.portRange) setPortRange(data.portRange);
          if (data.timeout) setTimeoutValue(data.timeout.toString());
          if (data.maxHosts) setMaxHosts(data.maxHosts.toString());
          if (data.autoRescan !== undefined) setAutoRescan(data.autoRescan);
          if (data.osDetection !== undefined) setOsDetection(data.osDetection);
          if (data.serviceDetection !== undefined) setServiceDetection(data.serviceDetection);
        }
      } catch {
        // Keep defaults
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          scanInterval: parseInt(scanInterval, 10),
          portRange,
          timeout: parseInt(timeoutValue, 10),
          maxHosts: parseInt(maxHosts, 10),
          autoRescan,
          osDetection,
          serviceDetection,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

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
              <Input type="number" value={scanInterval} onChange={(e) => setScanInterval(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.port_range')}</label>
              <Input value={portRange} onChange={(e) => setPortRange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.timeout')}</label>
              <Input type="number" value={timeoutValue} onChange={(e) => setTimeoutValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('scanning.max_hosts')}</label>
              <Input type="number" value={maxHosts} onChange={(e) => setMaxHosts(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.auto_rescan')}</p>
              <p className="text-xs text-text-muted">Automatically rescan networks on a schedule</p>
            </div>
            <Switch checked={autoRescan} onCheckedChange={setAutoRescan} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.os_detection')}</p>
              <p className="text-xs text-text-muted">Enable OS fingerprinting during scans</p>
            </div>
            <Switch checked={osDetection} onCheckedChange={setOsDetection} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('scanning.service_detection')}</p>
              <p className="text-xs text-text-muted">Detect service versions on open ports</p>
            </div>
            <Switch checked={serviceDetection} onCheckedChange={setServiceDetection} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mr-1 text-green-400" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-4 w-4 mr-1 text-red-400" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saveStatus === 'saving'
            ? t('common.saving')
            : saveStatus === 'success'
            ? t('settings.saved')
            : saveStatus === 'error'
            ? t('settings.save_error')
            : t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function DiscordTab() {
  const t = useTranslations();

  const [webhookUrl, setWebhookUrl] = React.useState('');
  const [alertLevel, setAlertLevel] = React.useState('high');
  const [notificationChannel, setNotificationChannel] = React.useState('#alerts');
  const [sendAlerts, setSendAlerts] = React.useState(true);
  const [mentionEveryone, setMentionEveryone] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [testStatus, setTestStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.webhookUrl !== undefined) setWebhookUrl(data.webhookUrl);
          if (data.alertLevel) setAlertLevel(data.alertLevel);
          if (data.notificationChannel) setNotificationChannel(data.notificationChannel);
          if (data.sendAlerts !== undefined) setSendAlerts(data.sendAlerts);
          if (data.mentionEveryone !== undefined) setMentionEveryone(data.mentionEveryone);
        }
      } catch {
        // Keep defaults
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          webhookUrl,
          alertLevel,
          notificationChannel,
          sendAlerts,
          mentionEveryone,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTestWebhook = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/settings/test-webhook', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ webhookUrl }),
      });
      if (!res.ok) throw new Error('Failed');
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

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
            <Input
              placeholder={t('discord.webhook_placeholder')}
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('discord.alert_level')}</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border-default bg-inset px-3 py-1 text-sm text-text-primary"
                value={alertLevel}
                onChange={(e) => setAlertLevel(e.target.value)}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('discord.notification_channel')}</label>
              <Input
                placeholder="#alerts"
                value={notificationChannel}
                onChange={(e) => setNotificationChannel(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('discord.send_alerts')}</p>
              <p className="text-xs text-text-muted">Send alerts to Discord webhook</p>
            </div>
            <Switch checked={sendAlerts} onCheckedChange={setSendAlerts} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{t('discord.mention_everyone')}</p>
              <p className="text-xs text-text-muted">@everyone for critical alerts</p>
            </div>
            <Switch checked={mentionEveryone} onCheckedChange={setMentionEveryone} />
          </div>
          <Button
            variant="secondary"
            onClick={handleTestWebhook}
            disabled={testStatus === 'testing' || !webhookUrl}
          >
            {testStatus === 'testing' ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : testStatus === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mr-1 text-green-400" />
            ) : testStatus === 'error' ? (
              <AlertCircle className="h-4 w-4 mr-1 text-red-400" />
            ) : null}
            {testStatus === 'testing'
              ? 'Testing...'
              : testStatus === 'success'
              ? t('discord.test_message')
              : testStatus === 'error'
              ? t('discord.webhook_invalid')
              : t('discord.test_webhook')}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveStatus === 'saving'}>
          {saveStatus === 'saving' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : saveStatus === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mr-1 text-green-400" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-4 w-4 mr-1 text-red-400" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {saveStatus === 'saving'
            ? t('common.saving')
            : saveStatus === 'success'
            ? t('settings.saved')
            : saveStatus === 'error'
            ? t('settings.save_error')
            : t('common.save')}
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

  // Add user dialog state
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState('viewer');
  const [addSaving, setAddSaving] = React.useState(false);

  // Edit user dialog state
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<any>(null);
  const [editRole, setEditRole] = React.useState('viewer');
  const [editSaving, setEditSaving] = React.useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch('/api/users', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result?.users || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId: string, active: boolean) => {
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ active }),
      });
      fetchUsers();
    } catch {
      // Handle error silently
    }
  };

  const handleAddUser = async () => {
    setAddSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          role: newRole,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setAddDialogOpen(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
      fetchUsers();
    } catch {
      // Handle error
    } finally {
      setAddSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditDialogOpen(false);
      setEditTarget(null);
      fetchUsers();
    } catch {
      // Handle error
    } finally {
      setEditSaving(false);
    }
  };

  const openEditDialog = (user: any) => {
    setEditTarget(user);
    setEditRole(user.role);
    setEditDialogOpen(true);
  };

  const resetAddForm = () => {
    setNewUsername('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('viewer');
  };

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
                <Button size="sm" onClick={() => { resetAddForm(); setAddDialogOpen(true); }}>
                  <Users className="h-4 w-4 mr-1" />
                  {t('users.add_user')}
                </Button>
              </div>
              <div className="divide-y divide-border-default">
                {data.length === 0 ? (
                  <p className="text-sm text-text-muted py-4 text-center">{t('users.no_users')}</p>
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
                        <Switch
                          checked={user.active}
                          onCheckedChange={(checked) => handleToggleActive(user.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-muted"
                          onClick={() => openEditDialog(user)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.add_user')}</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('users.username')}</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('users.email')}</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('users.password')}</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('users.role')}</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border-default bg-inset px-3 py-1 text-sm text-text-primary"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="admin">{t('users.admin')}</option>
                <option value="analyst">{t('users.analyst')}</option>
                <option value="viewer">{t('users.viewer')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetAddForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddUser} disabled={addSaving || !newUsername || !newEmail || !newPassword}>
              {addSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {addSaving ? t('common.saving') : t('users.add_user')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.edit_user')}</DialogTitle>
            <DialogDescription>Change role for {editTarget?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium text-text-primary">{editTarget?.username}</p>
              <p className="text-xs text-text-muted">{editTarget?.email}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">{t('users.role')}</label>
              <select
                className="flex h-9 w-full rounded-lg border border-border-default bg-inset px-3 py-1 text-sm text-text-primary"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="admin">{t('users.admin')}</option>
                <option value="analyst">{t('users.analyst')}</option>
                <option value="viewer">{t('users.viewer')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEditUser} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {editSaving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
