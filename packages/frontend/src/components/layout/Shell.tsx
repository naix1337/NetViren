'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  Search,
  Bell,
  Command,
  Monitor,
  Bot,
  FileSearch,
  Network,
  History,
  FileText,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ShellProps {
  children: React.ReactNode;
}

const pathTitles: Record<string, string> = {
  '/': 'dashboard.title',
  '/devices': 'devices.title',
  '/agents': 'agents.title',
  '/files': 'files.title',
  '/packets': 'packets.title',
  '/timeline': 'timeline.title',
  '/alerts': 'alerts.title',
  '/reports': 'reports.title',
  '/settings': 'settings.title',
};

const pathIcons: Record<string, React.ReactNode> = {
  '/': <Monitor className="h-4 w-4" />,
  '/devices': <Monitor className="h-4 w-4" />,
  '/agents': <Bot className="h-4 w-4" />,
  '/files': <FileSearch className="h-4 w-4" />,
  '/packets': <Network className="h-4 w-4" />,
  '/timeline': <History className="h-4 w-4" />,
  '/alerts': <Bell className="h-4 w-4" />,
  '/reports': <FileText className="h-4 w-4" />,
  '/settings': <Settings className="h-4 w-4" />,
};

export function Shell({ children }: ShellProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);

  const fetchUnreadCount = React.useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    fetch('/api/alerts', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const alerts = data.alerts || data || [];
          const unread = Array.isArray(alerts)
            ? alerts.filter((a: any) => !a.is_read).length
            : 0;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleSearch = () => {
    console.log('Search triggered');
    alert('Search functionality coming soon');
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleSearch();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const title = pathTitles[pathname] || 'dashboard.title';
  const icon = pathIcons[pathname];

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-60'
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border-default bg-canvas/80 backdrop-blur-xl px-6">
          {/* Breadcrumb / Page title */}
          <div className="flex items-center gap-2">
            {icon && (
              <span className="text-accent-cyan">{icon}</span>
            )}
            <h1 className="text-sm font-medium text-text-primary">{t(title)}</h1>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-border-hover hover:text-text-secondary"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('nav.search_placeholder')}</span>
            <kbd className="hidden rounded border border-border-default px-1.5 py-0.5 text-xs text-text-muted md:inline-flex items-center gap-0.5">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>

          {/* Notifications */}
          <button
            onClick={fetchUnreadCount}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-red text-[10px] font-medium text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Avatar */}
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>

        {/* Status Bar */}
        <footer className="flex h-8 items-center border-t border-border-default bg-surface px-6 text-xs text-text-muted">
          <span>NetViren v1.0.0</span>
          <span className="mx-2">|</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald" />
            System Online
          </span>
          <div className="flex-1" />
          <span>API: 127.0.0.1:4000</span>
        </footer>
      </div>
    </div>
  );
}
