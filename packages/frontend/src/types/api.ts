export interface Device {
  id: string;
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  osDetected?: string;
  osVersion?: string;
  vendor?: string;
  firstSeen: string;
  lastSeen: string;
  isOnline: boolean;
  threatScore: number;
  tags: string[];
  whitelisted: boolean;
  blacklisted: boolean;
}

export interface DevicePort {
  id: string;
  deviceId: string;
  port: number;
  protocol: 'tcp' | 'udp';
  state: string;
  service?: string;
  serviceVersion?: string;
  lastSeen: string;
}

export interface Scan {
  id: string;
  scanType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  target?: string;
  devicesFound: number;
  portsFound: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  machineId?: string;
  agentType: 'windows' | 'linux';
  version?: string;
  ipAddress?: string;
  osVersion?: string;
  status: 'online' | 'offline' | 'error';
  lastHeartbeat?: string;
  registeredAt: string;
  isActive: boolean;
}

export interface AgentFileScan {
  id: string;
  agentId: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  sha256Hash: string;
  vtStatus: 'pending' | 'clean' | 'malicious' | 'unknown' | 'error';
  vtData?: any;
  vtCheckedAt?: string;
  firstSeen: string;
}

export interface AgentProcess {
  id: string;
  agentId: string;
  pid: number;
  name: string;
  path?: string;
  cmdline?: string;
  sha256Hash?: string;
  isSuspicious: boolean;
  firstSeen: string;
}

export interface AgentConnection {
  id: string;
  agentId: string;
  localPort?: number;
  remoteIp: string;
  remotePort?: number;
  protocol?: string;
  processName?: string;
  isSuspicious: boolean;
  firstSeen: string;
}

export interface PacketCapture {
  id: string;
  agentId?: string;
  sourceIp: string;
  interfaceName?: string;
  filePath: string;
  fileSize: number;
  packetCount: number;
  durationSeconds?: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  expiresAt: string;
}

export interface DNSQuery {
  id: string;
  captureId: string;
  domain: string;
  queryType?: string;
  responseIp?: string;
  count: number;
  firstSeen: string;
}

export interface PacketConnection {
  id: string;
  captureId: string;
  srcIp: string;
  srcPort?: number;
  dstIp: string;
  dstPort?: number;
  protocol?: string;
  bytesSent: number;
  bytesRecv: number;
  packets: number;
  firstSeen: string;
  lastSeen: string;
  isBeacon: boolean;
}

export interface VTCacheEntry {
  id: string;
  lookupType: 'hash' | 'url' | 'domain' | 'ip';
  lookupValue: string;
  maliciousCount: number;
  suspiciousCount: number;
  harmlessCount: number;
  undetectedCount: number;
  totalVendors: number;
  communityScore?: number;
  cachedAt: string;
  expiresAt: string;
}

export interface Alert {
  id: string;
  alertType: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  deviceId?: string;
  agentId?: string;
  metadata?: any;
  isRead: boolean;
  discordSent: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  reportType: 'daily' | 'manual';
  periodStart: string;
  periodEnd: string;
  status: 'generating' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  summaryJson?: any;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'analyst' | 'viewer';
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}
