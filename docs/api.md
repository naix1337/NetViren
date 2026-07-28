# NetViren API Reference

**Base URL:** `http://localhost:4000` (configurable via `API_PORT` and `API_HOST`)

**Authentication:** Most endpoints require a Bearer JWT token in the `Authorization` header.

```
Authorization: Bearer <jwt-token>
```

**Roles:** `admin`, `analyst`, `viewer` (hierarchical: admin > analyst > viewer)

**Content-Type:** `application/json` (unless file upload)

---

## Health

### GET /api/health

Public endpoint for health checks.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "version": "1.0.0"
}
```

**Required role:** None (public)

---

## Authentication

### POST /api/auth/login

Authenticate with username and password.

**Request body:**
```json
{
  "username": "admin",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "avatarUrl": null
  }
}
```

**Error responses:**
- `400` — Username and password required
- `401` — Invalid credentials / Account uses OAuth

**Required role:** None (public)

---

### GET /api/me

Get the currently authenticated user's profile.

**Response (200):**
```json
{
  "user": {
    "id": "abc123",
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-07-28T12:00:00"
  }
}
```

**Required role:** Any authenticated user

---

### PATCH /api/me

Update the current user's profile.

**Request body:**
```json
{
  "email": "newemail@example.com",
  "avatarUrl": "https://example.com/avatar.png"
}
```

Both fields are optional.

**Response (200):**
```json
{
  "user": {
    "id": "abc123",
    "username": "admin",
    "email": "newemail@example.com",
    "role": "admin",
    "avatarUrl": "https://example.com/avatar.png",
    "isActive": true,
    "createdAt": "2026-07-28T12:00:00"
  }
}
```

**Error responses:**
- `409` — Email already in use

**Required role:** Any authenticated user

---

## Devices

All device endpoints require authentication.

### GET /api/devices

List all discovered network devices.

**Response (200):**
```json
{
  "devices": [
    {
      "id": "dev_abc123",
      "ipAddress": "192.168.1.1",
      "macAddress": "aa:bb:cc:dd:ee:ff",
      "hostname": null,
      "osDetected": "Linux",
      "osVersion": "5.x",
      "vendor": "",
      "isOnline": true,
      "threatScore": 0.0,
      "tags": ["router"],
      "notes": null,
      "whitelisted": false,
      "blacklisted": false,
      "firstSeen": "2026-07-28T12:00:00",
      "lastSeen": "2026-07-28T14:00:00",
      "createdAt": "2026-07-28T12:00:00",
      "updatedAt": "2026-07-28T14:00:00"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### GET /api/devices/:id

Get a single device by ID.

**Response (200):**
```json
{
  "device": {
    "id": "dev_abc123",
    "ipAddress": "192.168.1.1",
    ...
  }
}
```

**Error responses:**
- `404` — Device not found

**Required role:** Any authenticated user

---

### GET /api/devices/:id/ports

List all open ports for a device.

**Response (200):**
```json
{
  "ports": [
    {
      "id": "port_xyz",
      "device_id": "dev_abc123",
      "port": 80,
      "protocol": "tcp",
      "state": "open",
      "service": "http",
      "service_version": "Apache/2.4.41",
      "first_seen": "2026-07-28T12:00:00",
      "last_seen": "2026-07-28T14:00:00"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### PATCH /api/devices/:id

Update device metadata (whitelist, blacklist, tags, notes).

**Request body:**
```json
{
  "whitelisted": true,
  "blacklisted": false,
  "tags": ["router", "infrastructure"],
  "notes": "Core network gateway"
}
```

All fields are optional.

**Response (200):**
```json
{
  "device": { ... }
}
```

**Error responses:**
- `404` — Device not found

**Required role:** Any authenticated user

---

## Scans

All scan endpoints require authentication.

### GET /api/scans

List all scan jobs, ordered by started_at descending.

**Response (200):**
```json
{
  "scans": [
    {
      "id": "scan_abc",
      "scan_type": "full",
      "status": "completed",
      "target": "192.168.1.0/24",
      "devices_found": 12,
      "ports_found": 45,
      "started_at": "2026-07-28T12:00:00",
      "completed_at": "2026-07-28T12:05:00",
      "error": null,
      "triggered_by": "user_abc"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### POST /api/scans

Create a new scan job.

**Request body:**
```json
{
  "scanType": "full",
  "target": "192.168.1.0/24"
}
```

`scanType` is required. Valid values: `arp`, `port_tcp`, `port_udp`, `os`, `full`.
`target` is optional (defaults to configured subnet).

**Response (201):**
```json
{
  "scan": {
    "id": "scan_def",
    "scan_type": "full",
    "status": "pending",
    ...
  }
}
```

**Error responses:**
- `400` — scanType is required

**Required role:** Any authenticated user (viewer can view but not create)

---

### GET /api/scans/:id

Get a single scan by ID.

**Response (200):**
```json
{
  "scan": { ... }
}
```

**Error responses:**
- `404` — Scan not found

**Required role:** Any authenticated user

---

### POST /api/scans/:id/cancel

Cancel a running or pending scan.

**Response (200):**
```json
{
  "scan": {
    ...,
    "status": "failed",
    "error": "cancelled"
  }
}
```

**Error responses:**
- `404` — Scan not found
- `400` — Scan cannot be cancelled (not in pending/running state)

**Required role:** Any authenticated user

---

## Agents

Agent registration and heartbeat endpoints use per-agent token auth (not JWT). All other agent endpoints require JWT authentication.

### POST /api/agents/register

Register a new agent or re-register an existing one.

**Request body:**
```json
{
  "name": "webserver-01",
  "machineId": "unique-machine-uuid",
  "agentType": "linux",
  "version": "1.0.0",
  "ipAddress": "192.168.1.100",
  "osVersion": "Ubuntu 22.04",
  "publicKey": "optional-ssh-key",
  "capabilities": "file_scan,process_monitor"
}
```

`name`, `machineId`, and `agentType` are required. `agentType` must be `windows` or `linux`.

**Response (201 - new agent):**
```json
{
  "agent": {
    "id": "agent_abc",
    "name": "webserver-01",
    "machine_id": "unique-machine-uuid",
    "agent_type": "linux",
    "version": "1.0.0",
    "status": "online",
    "auth_token": "64-character-nanoid-token",
    ...
  }
}
```

**Response (200 - re-registration):** Same shape, new `auth_token` generated.

**Error responses:**
- `400` — Missing required fields or invalid agentType

**Required role:** None (uses shared registration)

---

### POST /api/agents/:id/heartbeat

Send a heartbeat from an agent.

**Request body:**
```json
{
  "ipAddress": "192.168.1.100"
}
```

`ipAddress` is optional.

**Response (200):**
```json
{
  "status": "ok"
}
```

**Error responses:**
- `404` — Agent not found

**Required role:** Agent token (not JWT)

---

### GET /api/agents

List all registered agents, ordered by registered_at descending.

**Response (200):**
```json
{
  "agents": [
    {
      "id": "agent_abc",
      "name": "webserver-01",
      "machine_id": "unique-machine-uuid",
      "agent_type": "linux",
      "version": "1.0.0",
      "ip_address": "192.168.1.100",
      "os_version": "Ubuntu 22.04",
      "status": "online",
      "last_heartbeat": "2026-07-28T14:00:00",
      "registered_at": "2026-07-28T10:00:00",
      "is_active": 1
    }
  ]
}
```

**Required role:** Any authenticated user

---

### GET /api/agents/:id

Get a single agent by ID.

**Response (200):**
```json
{
  "agent": { ... }
}
```

**Error responses:**
- `404` — Agent not found

**Required role:** Any authenticated user

---

### GET /api/agents/:id/files

List all file scans reported by an agent.

**Response (200):**
```json
{
  "files": [
    {
      "id": "file_abc",
      "agent_id": "agent_abc",
      "file_path": "/etc/passwd",
      "file_name": "passwd",
      "file_size": 2048,
      "sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "vt_status": "pending",
      "first_seen": "2026-07-28T12:00:00"
    }
  ]
}
```

**Error responses:**
- `404` — Agent not found

**Required role:** Any authenticated user

---

### GET /api/agents/:id/processes

List all running processes reported by an agent.

**Response (200):**
```json
{
  "processes": [
    {
      "id": "proc_abc",
      "agent_id": "agent_abc",
      "pid": 1234,
      "name": "sshd",
      "path": "/usr/sbin/sshd",
      "cmdline": "/usr/sbin/sshd -D",
      "sha256_hash": null,
      "is_suspicious": 0,
      "first_seen": "2026-07-28T12:00:00"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### GET /api/agents/:id/connections

List all active network connections reported by an agent.

**Response (200):**
```json
{
  "connections": [
    {
      "id": "conn_abc",
      "agent_id": "agent_abc",
      "local_port": 443,
      "remote_ip": "203.0.113.5",
      "remote_port": 443,
      "protocol": "tcp",
      "process_name": "",
      "is_suspicious": 0,
      "first_seen": "2026-07-28T12:00:00"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### DELETE /api/agents/:id

Delete an agent and its associated data (CASCADE).

**Response:** `204 No Content`

**Error responses:**
- `404` — Agent not found

**Required role:** Any authenticated user

---

## Packets

All packet endpoints require authentication.

### GET /api/packets

List all packet captures, ordered by started_at descending.

**Response (200):**
```json
{
  "packets": [
    {
      "id": "cap_abc",
      "agent_id": null,
      "source_ip": "192.168.1.100",
      "interface_name": "eth0",
      "file_path": "/var/lib/netviren/packets/cap_abc.pcap",
      "file_size": 1048576,
      "packet_count": 5000,
      "duration_seconds": 300,
      "status": "analyzed",
      "started_at": "2026-07-28T12:00:00",
      "completed_at": "2026-07-28T12:05:00",
      "expires_at": "2026-08-04T12:00:00",
      "notes": null
    }
  ]
}
```

**Required role:** Any authenticated user

---

### GET /api/packets/:id

Get a single packet capture with its DNS queries and connections.

**Response (200):**
```json
{
  "packet": { ... },
  "dnsQueries": [
    {
      "id": "dns_abc",
      "capture_id": "cap_abc",
      "domain": "example.com",
      "query_type": "A",
      "response_ip": "93.184.216.34",
      "count": 3,
      "first_seen": "2026-07-28T12:00:05"
    }
  ],
  "connections": [
    {
      "id": "pconn_abc",
      "capture_id": "cap_abc",
      "src_ip": "192.168.1.100",
      "src_port": 54321,
      "dst_ip": "93.184.216.34",
      "dst_port": 443,
      "protocol": "tcp",
      "bytes_sent": 1200,
      "bytes_recv": 45000,
      "packets": 35,
      "first_seen": "2026-07-28T12:00:05",
      "last_seen": "2026-07-28T12:04:50",
      "is_beacon": 0
    }
  ]
}
```

**Error responses:**
- `404` — Capture not found

**Required role:** Any authenticated user

---

### GET /api/packets/:id/download

Download the raw PCAP file for a capture.

**Response:** Binary PCAP file stream with `Content-Type: application/vnd.tcpdump.pcap`

**Error responses:**
- `404` — Capture not found or file not on disk

**Required role:** Any authenticated user

---

### DELETE /api/packets/:id

Delete a packet capture and its associated PCAP file.

**Response:** `204 No Content`

**Error responses:**
- `404` — Capture not found

**Required role:** Any authenticated user

---

## VirusTotal

All VirusTotal endpoints require authentication.

### GET /api/vt/lookup

Look up a hash, URL, domain, or IP address on VirusTotal. Results are cached for 1 hour.

**Query parameters:**
- `type` (required) — One of: `hash`, `url`, `domain`, `ip`
- `value` (required) — The value to look up

**Example:** `GET /api/vt/lookup?type=hash&value=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

**Response (200):**
```json
{
  "cached": false,
  "result": {
    "id": "vt_abc",
    "lookupType": "hash",
    "lookupValue": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "maliciousCount": 0,
    "suspiciousCount": 0,
    "harmlessCount": 68,
    "undetectedCount": 0,
    "totalVendors": 68,
    "communityScore": null,
    "cachedAt": "2026-07-28T12:00:00",
    "expiresAt": "2026-07-28T13:00:00",
    "responseData": { ... }
  }
}
```

If `cached` is `true`, the result was served from the local cache.

**Error responses:**
- `400` — type and value query params required, or invalid type
- `503` — VirusTotal API key not configured
- `502` — VirusTotal API error

**Required role:** Any authenticated user

---

## Alerts

All alert endpoints require authentication.

### GET /api/alerts

List alerts with optional filtering and pagination.

**Query parameters (all optional):**
- `severity` — Filter by severity: `info`, `low`, `medium`, `high`, `critical`
- `isRead` — Filter by read status: `true` or `false`
- `limit` — Results per page (default: 50)
- `offset` — Pagination offset (default: 0)

**Response (200):**
```json
{
  "alerts": [
    {
      "id": "alert_abc",
      "alert_type": "new_device",
      "severity": "low",
      "title": "New device detected",
      "description": "Device 192.168.1.105 joined the network",
      "device_id": "dev_abc",
      "agent_id": null,
      "metadata": null,
      "is_read": 0,
      "discord_sent": 0,
      "created_at": "2026-07-28T12:00:00"
    }
  ],
  "total": 1,
  "unreadCount": 1
}
```

**Required role:** Any authenticated user

---

### PATCH /api/alerts/:id/read

Mark a single alert as read.

**Response (200):**
```json
{
  "alert": {
    ...,
    "is_read": 1
  }
}
```

**Error responses:**
- `404` — Alert not found

**Required role:** Any authenticated user

---

### PATCH /api/alerts/read-all

Mark all alerts as read.

**Response (200):**
```json
{
  "success": true
}
```

**Required role:** Any authenticated user

---

## Reports

All report endpoints require authentication.

### GET /api/reports

List all reports, ordered by created_at descending.

**Response (200):**
```json
{
  "reports": [
    {
      "id": "rpt_abc",
      "title": "Daily Security Report",
      "report_type": "daily",
      "period_start": "2026-07-27T00:00:00",
      "period_end": "2026-07-28T00:00:00",
      "status": "completed",
      "file_path": "/var/lib/netviren/reports/rpt_abc.pdf",
      "file_size": 245760,
      "summary_json": null,
      "created_by": "user_abc",
      "created_at": "2026-07-28T06:00:00"
    }
  ]
}
```

**Required role:** Any authenticated user

---

### GET /api/reports/:id

Get a single report by ID.

**Response (200):**
```json
{
  "report": {
    ...,
    "summary": {
      "title": "Daily Security Report",
      "period": { "start": "...", "end": "..." },
      "generatedAt": "...",
      "generatedBy": "admin",
      "summary": "Report generated successfully."
    }
  }
}
```

**Error responses:**
- `404` — Report not found

**Required role:** Any authenticated user

---

### POST /api/reports/generate

Generate a new report.

**Request body:**
```json
{
  "title": "Daily Security Report",
  "reportType": "daily",
  "periodStart": "2026-07-27T00:00:00",
  "periodEnd": "2026-07-28T00:00:00"
}
```

All fields required. `reportType` must be `daily` or `manual`.

**Response (201):**
```json
{
  "report": {
    "id": "rpt_def",
    "title": "Daily Security Report",
    "report_type": "daily",
    "status": "completed",
    ...
  }
}
```

**Error responses:**
- `400` — Missing required fields or invalid reportType

**Required role:** Any authenticated user (creation restricted by UI)

---

### GET /api/reports/:id/download

Download a completed report as PDF.

**Response:** Binary PDF file stream with `Content-Type: application/pdf`

**Error responses:**
- `404` — Report not found or file not on disk
- `400` — Report not yet completed

**Required role:** Any authenticated user

---

## Settings

All settings endpoints require admin role.

### GET /api/settings

Get all system settings as key-value pairs.

**Response (200):**
```json
{
  "settings": {
    "scan_interval_minutes": "60",
    "port_scan_enabled": "true",
    "port_ranges": "20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017",
    "udp_scan_enabled": "false",
    "packet_capture_enabled": "true",
    "packet_retention_days": "7",
    "discord_webhook_url": "",
    "discord_alerts_enabled": "false",
    "vt_api_key": "",
    "vt_enabled": "false",
    "auto_vt_check": "true",
    "daily_report_time": "06:00",
    "threat_score_threshold": "5.0",
    "beaconing_detect_enabled": "true"
  }
}
```

**Required role:** admin

---

### PUT /api/settings

Update system settings. Only provided keys are updated (upsert semantics).

**Request body:**
```json
{
  "settings": {
    "scan_interval_minutes": "120",
    "discord_webhook_url": "https://discord.com/api/webhooks/..."
  }
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error responses:**
- `400` — settings object is required

**Required role:** admin

---

## Users

All user management endpoints require admin role.

### GET /api/users

List all users.

**Response (200):**
```json
{
  "users": [
    {
      "id": "user_abc",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-07-28T12:00:00",
      "updatedAt": "2026-07-28T12:00:00"
    }
  ]
}
```

**Required role:** admin

---

### POST /api/users

Create a new user.

**Request body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword",
  "role": "analyst"
}
```

`username` and `password` are required. `email` and `role` are optional (role defaults to `viewer`).

**Response (201):**
```json
{
  "user": {
    "id": "user_def",
    "username": "newuser",
    "email": "user@example.com",
    "role": "analyst",
    ...
  }
}
```

**Error responses:**
- `400` — Missing required fields or invalid role
- `409` — Username or email already taken

**Required role:** admin

---

### PATCH /api/users/:id

Update a user's profile, role, or status.

**Request body:**
```json
{
  "username": "updateduser",
  "email": "newemail@example.com",
  "password": "newpassword",
  "role": "viewer",
  "isActive": false
}
```

All fields are optional. `role` must be `admin`, `analyst`, or `viewer`.

**Response (200):**
```json
{
  "user": { ... }
}
```

**Error responses:**
- `404` — User not found
- `400` — Invalid role
- `409` — Username or email already taken

**Required role:** admin

---

### DELETE /api/users/:id

Delete a user.

**Response:** `204 No Content`

**Error responses:**
- `404` — User not found

**Required role:** admin

---

## WebSocket Events

**Endpoint:** `ws://localhost:4000/ws`

The WebSocket connection provides real-time updates for the dashboard. The server broadcasts JSON messages with the following structure:

```json
{
  "event": "event_type",
  "data": { ... }
}
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `scan:created` | Scan object | A new scan job was created |
| `scan:updated` | Scan object | Scan status changed (running/completed/failed) |
| `alert:updated` | Alert object | An alert was modified (e.g., marked read) |
| `alerts:read-all` | `{}` | All alerts were marked as read |
| `report:generating` | Report object | Report generation has started |
| `report:completed` | Report object | Report generation completed |

**Example flow:**
1. Client connects to `ws://localhost:4000/ws`
2. When a scan completes, server broadcasts:
   ```json
   {
     "event": "scan:updated",
     "data": {
       "id": "scan_abc",
       "status": "completed",
       "devices_found": 12,
       ...
     }
   }
   ```
3. Client receives the event and updates the UI accordingly

---

## Agent Protocol

Agents communicate with the server using a combination of REST API calls and a dedicated WebSocket endpoint on port 4001.

### Registration Flow

1. Agent starts up and reads its machine ID (from `/etc/machine-id` on Linux, WMI `Win32_ComputerSystemProduct.UUID` on Windows)
2. Agent sends `POST /api/agents/register` with `name`, `machineId`, `agentType`, `version`
3. Server generates a unique `agent_id` and 64-character `auth_token`, stores them, and returns them
4. Agent saves the credentials locally (encrypted config file)
5. On subsequent starts, the agent uses the stored credentials instead of re-registering

### Heartbeat Loop

```
Every 30 seconds:
  POST /api/agents/:id/heartbeat
  Authorization: Bearer <agent-token>
  Body: { "ipAddress": "...", "osVersion": "..." }
```

### Command Polling

After each heartbeat, the agent checks for pending commands:
```
GET /api/agents/:id/commands
Authorization: Bearer <agent-token>
```

**Response:**
```json
{
  "commands": [
    { "type": "scan_file", "params": { "path": "/etc" } },
    { "type": "capture_packets", "params": { "interface": "eth0", "duration": 300 } }
  ]
}
```

### File Scan Upload

After scanning files, agents upload results:
```
POST /api/agents/:id/files
Authorization: Bearer <agent-token>
Body: {
  "filePath": "/etc/passwd",
  "fileName": "passwd",
  "fileSize": 2048,
  "sha256Hash": "e3b0c44..."
}
```

### Agent Capabilities

| Capability | Description | Available |
|-----------|-------------|-----------|
| `file_scan` | Recursively scan directories, compute SHA256 hashes | Linux, Windows |
| `process_monitor` | List running processes | Linux, Windows |
| `connection_monitor` | List active network connections | Linux, Windows |
| `packet_capture` | Capture network traffic (requires Npcap) | Windows only |
| `os_info` | Report OS version and platform details | Linux, Windows |

### Error Handling

- Connection loss: exponential backoff (30s -> 60s -> 120s -> max 300s)
- Registration failure: retry every 60 seconds
- Heartbeat failure: log error, continue loop, try again next cycle
- File upload failure: log error, skip file, continue scanning
