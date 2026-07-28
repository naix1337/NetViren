
**Files:**
- Create: `packages/frontend/src/styles/globals.css`
- Create: `packages/frontend/src/i18n/request.ts`
- Create: `packages/frontend/src/i18n/routing.ts`
- Create: `packages/frontend/messages/de.json`
- Create: `packages/frontend/messages/en.json`
- Create: `packages/frontend/src/types/api.ts` (shared types)
- Create: `packages/frontend/src/lib/api-client.ts`
- Create: `packages/frontend/src/lib/utils.ts`
- Create: `packages/frontend/src/middleware.ts`
- Create: `packages/frontend/src/app/layout.tsx`
- Create: `packages/frontend/src/app/providers.tsx`
- Create: `packages/frontend/src/app/(auth)/login/page.tsx`
- Create: `packages/frontend/src/app/(auth)/layout.tsx`
- Create: `packages/frontend/src/app/(dashboard)/layout.tsx`
- Create: `packages/frontend/src/app/(dashboard)/page.tsx`
- Create: `packages/frontend/src/components/ui/*` (shadcn/ui base components)
- Create: `packages/frontend/src/components/layout/Sidebar.tsx`
- Create: `packages/frontend/src/components/layout/Shell.tsx`
- Create: `packages/frontend/src/components/shared/StatusPulse.tsx`
- Create: `packages/frontend/src/components/shared/ThreatGauge.tsx`
- Create: `packages/frontend/src/components/shared/StatCard.tsx`
- Create: `packages/frontend/src/components/shared/ActivityFeed.tsx`
- Create: `packages/frontend/src/components/dashboard/DashboardOverview.tsx`
- Create dashboard pages: devices, agents, files, packets, timeline, alerts, reports, settings

- [ ] **Step 1: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@layer base {
  html { @apply bg-canvas text-text-primary antialiased; }
  body { @apply min-h-screen; }
  * { @apply border-border-default; }
}

@layer components {
  .glass {
    @apply bg-surface/80 backdrop-blur-xl border border-border-default;
  }
  .card {
    @apply bg-elevated rounded-xl border border-border-default p-6 transition-all duration-200;
  }
  .card-hover {
    @apply card hover:border-border-hover hover:shadow-lg hover:shadow-accent-cyan/5;
  }
  .glow-cyan {
    box-shadow: 0 0 20px rgba(34,211,238,0.1), 0 0 40px rgba(34,211,238,0.05);
  }
  .glow-violet {
    box-shadow: 0 0 20px rgba(167,139,250,0.1), 0 0 40px rgba(167,139,250,0.05);
  }
  .threat-pulse {
    animation: threatPulse 2s ease-in-out infinite;
  }
  @keyframes threatPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .scan-spin {
    animation: scanSpin 2s linear infinite;
  }
  @keyframes scanSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .slide-in {
    animation: slideIn 0.3s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

- [ ] **Step 2: Create i18n files**

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});

// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 3: Create messages files**

```json
// messages/de.json (excerpt — full file has ~300 keys)
{
  "common": {
    "app_name": "NetViren",
    "loading": "Laden...",
    "error": "Fehler",
    "retry": "Erneut versuchen",
    "search": "Suchen...",
    "no_results": "Keine Ergebnisse",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "confirm": "Bestätigen",
    "online": "Online",
    "offline": "Offline",
    "enabled": "Aktiviert",
    "disabled": "Deaktiviert"
  },
  "auth": {
    "login_title": "NetViren",
    "login_subtitle": "Network Security Platform",
    "username": "Benutzername",
    "password": "Passwort",
    "login_button": "Anmelden",
    "login_google": "Mit Google anmelden",
    "login_github": "Mit GitHub anmelden",
    "logout": "Abmelden",
    "error_invalid": "Ungültige Anmeldedaten"
  },
  "nav": {
    "dashboard": "Dashboard",
    "devices": "Geräte",
    "agents": "Agents",
    "files": "Datei-Scans",
    "packets": "Paketanalyse",
    "timeline": "Zeitstrahl",
    "alerts": "Alarme",
    "reports": "Berichte",
    "settings": "Einstellungen"
  },
  "dashboard": {
    "threat_score": "Bedrohungs-Score",
    "devices_online": "Geräte online",
    "total_devices": "Gesamtgeräte",
    "active_scans": "Aktive Scans",
    "recent_alerts": "Letzte Alarme",
    "live_activity": "Live-Aktivität",
    "no_activity": "Keine aktuellen Aktivitäten",
    "threat_level": "Bedrohungslevel",
    "safe": "Sicher",
    "low": "Niedrig",
    "medium": "Mittel",
    "high": "Hoch",
    "critical": "Kritisch"
  },
  "devices": {
    "title": "Netzwerkgeräte",
    "ip": "IP-Adresse",
    "mac": "MAC-Adresse",
    "hostname": "Hostname",
    "os": "Betriebssystem",
    "vendor": "Hersteller",
    "ports": "Ports",
    "threat": "Bedrohung",
    "first_seen": "Erstmals gesehen",
    "last_seen": "Zuletzt gesehen",
    "no_devices": "Keine Geräte gefunden",
    "start_scan": "Scan starten",
    "whitelist": "Whitelist",
    "blacklist": "Blacklist"
  },
  "agents": {
    "title": "Agenten",
    "name": "Name",
    "type": "Typ",
    "status": "Status",
    "version": "Version",
    "ip": "IP-Adresse",
    "last_seen": "Letzter Heartbeat",
    "no_agents": "Keine Agenten registriert",
    "files_scanned": "Gescannte Dateien",
    "processes": "Prozesse",
    "connections": "Verbindungen"
  },
  "packets": {
    "title": "Paketanalyse",
    "captures": "Captures",
    "source": "Quelle",
    "packets": "Pakete",
    "size": "Größe",
    "duration": "Dauer",
    "status": "Status",
    "download": "PCAP herunterladen",
    "no_captures": "Keine Captures vorhanden",
    "dns_queries": "DNS-Anfragen",
    "connections": "Verbindungen",
    "top_talkers": "Top-Talker",
    "beaconing": "Beaconing-Verdacht"
  },
  "files": {
    "title": "Datei-Scans",
    "file": "Datei",
    "path": "Pfad",
    "size": "Größe",
    "hash": "SHA256",
    "vt_status": "VT-Status",
    "check_vt": "VT-Check",
    "no_files": "Keine Dateien gescannt"
  },
  "alerts": {
    "title": "Alarme",
    "type": "Typ",
    "severity": "Schweregrad",
    "description": "Beschreibung",
    "no_alerts": "Keine Alarme",
    "mark_read": "Als gelesen markieren",
    "new_device": "Neues Gerät",
    "device_offline": "Gerät offline",
    "threat": "Bedrohung",
    "port_change": "Port-Änderung",
    "vt_hit": "VT-Treffer"
  },
  "reports": {
    "title": "Berichte",
    "daily": "Tagesbericht",
    "manual": "Manueller Bericht",
    "generate": "Bericht generieren",
    "download": "PDF herunterladen",
    "no_reports": "Keine Berichte",
    "preview": "Vorschau",
    "period": "Zeitraum",
    "status_generating": "Wird generiert...",
    "status_completed": "Fertig",
    "status_failed": "Fehlgeschlagen"
  },
  "settings": {
    "title": "Einstellungen",
    "general": "Allgemein",
    "users": "Benutzer",
    "discord": "Discord",
    "whitelist": "Whitelist / Blacklist",
    "scanning": "Scan-Einstellungen",
    "vt": "VirusTotal",
    "language": "Sprache"
  }
}
```

English messages/en.json mirrors the same keys with English values.

- [ ] **Step 4: Create types/api.ts**

```typescript
// All shared types as defined in the Interface Contracts section above
export interface Device {
  id: string; ipAddress: string; macAddress?: string; hostname?: string;
  osDetected?: string; osVersion?: string; vendor?: string;
  firstSeen: string; lastSeen: string; isOnline: boolean;
  threatScore: number; tags: string[]; whitelisted: boolean; blacklisted: boolean;
}
export interface DevicePort {
  id: string; deviceId: string; port: number; protocol: 'tcp'|'udp';
  state: string; service?: string; serviceVersion?: string; lastSeen: string;
}
export interface Scan {
  id: string; scanType: string; status: 'pending'|'running'|'completed'|'failed';
  target?: string; devicesFound: number; portsFound: number;
  startedAt: string; completedAt?: string; error?: string;
}
export interface Agent {
  id: string; name: string; machineId?: string; agentType: 'windows'|'linux';
  version?: string; ipAddress?: string; osVersion?: string;
  status: 'online'|'offline'|'error'; lastHeartbeat?: string;
  registeredAt: string; isActive: boolean;
}
export interface AgentFileScan {
  id: string; agentId: string; filePath: string; fileName: string;
  fileSize?: number; sha256Hash: string;
  vtStatus: 'pending'|'clean'|'malicious'|'unknown'|'error';
  vtData?: any; vtCheckedAt?: string; firstSeen: string;
}
export interface AgentProcess {
  id: string; agentId: string; pid: number; name: string; path?: string;
  cmdline?: string; sha256Hash?: string; isSuspicious: boolean; firstSeen: string;
}
export interface AgentConnection {
  id: string; agentId: string; localPort?: number; remoteIp: string;
  remotePort?: number; protocol?: string; processName?: string;
  isSuspicious: boolean; firstSeen: string;
}
export interface PacketCapture {
  id: string; agentId?: string; sourceIp: string; interfaceName?: string;
  filePath: string; fileSize: number; packetCount: number;
  durationSeconds?: number; status: string; startedAt: string;
  completedAt?: string; expiresAt: string;
}
export interface DNSQuery {
  id: string; captureId: string; domain: string; queryType?: string;
  responseIp?: string; count: number; firstSeen: string;
}
export interface PacketConnection {
  id: string; captureId: string; srcIp: string; srcPort?: number;
  dstIp: string; dstPort?: number; protocol?: string;
  bytesSent: number; bytesRecv: number; packets: number;
  firstSeen: string; lastSeen: string; isBeacon: boolean;
}
export interface VTCacheEntry {
  id: string; lookupType: 'hash'|'url'|'domain'|'ip'; lookupValue: string;
  maliciousCount: number; suspiciousCount: number;
  harmlessCount: number; undetectedCount: number; totalVendors: number;
  communityScore?: number; cachedAt: string; expiresAt: string;
}
export interface Alert {
  id: string; alertType: string; severity: 'info'|'low'|'medium'|'high'|'critical';
  title: string; description?: string; deviceId?: string; agentId?: string;
  metadata?: any; isRead: boolean; discordSent: boolean; createdAt: string;
}
export interface Report {
  id: string; title: string; reportType: 'daily'|'manual';
  periodStart: string; periodEnd: string; status: 'generating'|'completed'|'failed';
  filePath?: string; fileSize?: number; summaryJson?: any; createdAt: string;
}
export interface User {
  id: string; username: string; email?: string; role: 'admin'|'analyst'|'viewer';
  avatarUrl?: string; isActive: boolean; createdAt: string;
}
```

- [ ] **Step 5: Create lib/api-client.ts**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API Error');
  }
  return res.json();
}

export const api = {
  get: (path: string) => fetchApi(path),
  post: (path: string, body?: any) => fetchApi(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body: any) => fetchApi(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path: string, body: any) => fetchApi(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => fetchApi(path, { method: 'DELETE' }),
  upload: async (path: string, formData: FormData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
```

- [ ] **Step 6: Create lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tagen`;
}
```

- [ ] **Step 7: Create Next.js middleware for auth**

```typescript
// packages/frontend/src/middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    if (path.startsWith('/settings') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Analyst+Admin routes
    if ((path.startsWith('/reports') || path.startsWith('/alerts')) && token?.role === 'viewer') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: ['/((?!api|_next|login|register).*)'],
};
```

- [ ] **Step 8: Create base UI components (shadcn/ui style)**

Create base components in `packages/frontend/src/components/ui/`:
- `button.tsx` — cva-based variants: default, secondary, ghost, destructive, with cyan accent
- `card.tsx` — Card, CardHeader, CardContent, CardFooter
- `badge.tsx` — variants: default, secondary, success, warning, danger, with matching colors
- `input.tsx` — dark theme input with cyan focus ring
- `select.tsx` — dark select dropdown
- `tabs.tsx` — Radix tabs with cyan active indicator
- `table.tsx` — Dark themed table with striped rows
- `dialog.tsx` — Radix dialog with glassmorphism
- `dropdown-menu.tsx` — Radix dropdown
- `switch.tsx` — Radix switch with cyan active
- `tooltip.tsx` — Radix tooltip
- `avatar.tsx` — Radix avatar
- `separator.tsx` — Radix separator
- `scroll-area.tsx` — Radix scroll area
- `progress.tsx` — Radix progress with cyan gradient
- `skeleton.tsx` — Loading skeleton with shimmer

- [ ] **Step 9: Create shared components**

```tsx
// StatusPulse.tsx — animated live indicator
interface StatusPulseProps {
  status: 'online' | 'offline' | 'scanning' | 'threat' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}
// Renders a pulsing dot: green=online, red=offline, cyan=scanning, red(threat pulse), amber=warning

// ThreatGauge.tsx — radial/semi-circular score display
interface ThreatGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
// SVG-based radial gauge with color gradient: green(0-20) → amber(20-50) → red(50-100)

// StatCard.tsx
interface StatCardProps {
  title: string; value: string | number; icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  description?: string; color?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'red';
}
// Card with icon, large value, trend arrow, subtle description

// ActivityFeed.tsx
interface ActivityFeedProps {
  items: Array<{ id: string; type: string; title: string; description?: string; timestamp: string; severity?: string }>;
  maxItems?: number;
}
// Scrollable list with auto-slide-in animations for new items
```

- [ ] **Step 10: Create layout components**

```tsx
// Sidebar.tsx — glassmorphism sidebar
// - 240px expanded, 64px collapsed
// - Nav items with icons (lucide-react): Dashboard, Devices, Agents, Files, Packets, Timeline, Alerts, Reports, Settings
// - Active state: cyan left border + cyan text
// - Bottom: User avatar + name + logout button
// - Language switch at bottom
// - Collapse toggle button

// Shell.tsx — Main layout wrapper
// - Sidebar on left
// - Top bar: breadcrumb + Cmd+K search + language switch + user avatar
// - Content area with padding
// - (Optional) Status bar at bottom
```

- [ ] **Step 11: Create dashboard overview page**

```tsx
// (dashboard)/page.tsx — The main dashboard
// Top row:
//   - Global Threat Score (ThreatGauge, large)
//   - Devices Online/Total (StatCard)
//   - Active Scans (StatCard with pulse animation if active)
//   - Recent Alerts count (StatCard)
// Middle:
//   - Recent Alerts list (last 5)
// Bottom:
//   - Live Activity Feed (auto-scrolling WebSocket feed)
```

- [ ] **Step 12: Create feature pages**

Each page follows this pattern:
1. Fetch data on mount via `api.get(...)` (React useEffect or SWR)
2. Show skeleton while loading
3. Show error with retry button on failure
4. Render data with appropriate components
5. Real-time updates via WebSocket where applicable

**Key pages:**

- **Devices page** (`/devices`): Table with IP, MAC, hostname, OS, ports count, threat score badge, last seen. Toggle for map view (SVG/Canvas network topology).
- **Device detail** (`/devices/:id`): Full device info, port list, threat score timeline, whitelist/blacklist toggle, notes.
- **Agents page** (`/agents`): Agent cards with status badge, name, type, IP, heartbeat time, active/inactive toggle.
- **Agent detail** (`/agents/:id`): Agent info, file scans table, processes list, connections list, tabs for each.
- **Files page** (`/files`): File scans table with sha256 (truncated), VT status badge, "Check on VT" button.
- **Packets page** (`/packets`): Capture list with source, packet count, size, duration, status. Download button.
- **Packet detail** (`/packets/:id`): DNS queries table, connections table (top talkers), beaconing flags.
- **Timeline page** (`/timeline`): All events (scans, alerts, device changes) in a chronological timeline view.
- **Alerts page** (`/alerts`): Alert list with severity badge, type, title, timestamp. Click to mark read.
- **Reports page** (`/reports`): Report list with type badge, period, status. Generate button (admin/analyst). Download PDF.
- **Settings page** (`/settings`): Tabs for General, Scanning, VT, Discord, Users (admin), Whitelist/Blacklist (admin).

- [ ] **Step 13: Create auth pages**

```tsx
// (auth)/login/page.tsx — Login page
// Full-screen centered card with glassmorphism
// NetViren logo + title
// Username + password form with validation
// "Sign in with Google" button (styled with Google colors)
// "Sign in with GitHub" button (styled with GitHub colors)
// Loading state on submit
// Error message on invalid credentials
// Redirect to dashboard on success
```

- [ ] **Step 14: Create app providers**

```tsx
// providers.tsx
// - SessionProvider (Auth.js)
// - ThemeProvider (dark mode only)
// - Toaster (Sonner for notifications)
```

---

