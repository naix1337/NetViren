'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  LayoutDashboard,
  Monitor,
  Bot,
  FileSearch,
  Network,
  History,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Languages,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/devices', label: 'nav.devices', icon: Monitor },
  { href: '/agents', label: 'nav.agents', icon: Bot },
  { href: '/files', label: 'nav.files', icon: FileSearch },
  { href: '/packets', label: 'nav.packets', icon: Network },
  { href: '/timeline', label: 'nav.timeline', icon: History },
  { href: '/alerts', label: 'nav.alerts', icon: Bell },
  { href: '/reports', label: 'nav.reports', icon: FileText },
  { href: '/settings', label: 'nav.settings', icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(collapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    onToggle?.();
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border-default bg-surface/80 backdrop-blur-xl transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border-default px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-cyan/10">
            <span className="text-sm font-bold text-accent-cyan">NV</span>
          </div>
          {!isCollapsed && (
            <span className="text-base font-semibold text-text-primary">NetViren</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-l-2 border-accent-cyan bg-accent-cyan/5 text-accent-cyan'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span>{t(item.label)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border-default p-3">
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>{t('nav.collapse')}</span>
            </>
          )}
        </button>

        {/* Language switch */}
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-text-primary transition-colors mt-1">
          <Languages className="h-4 w-4" />
          {!isCollapsed && <span>DE / EN</span>}
        </button>

        {/* Logout */}
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-hover hover:text-accent-red transition-colors mt-1">
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>{t('auth.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
