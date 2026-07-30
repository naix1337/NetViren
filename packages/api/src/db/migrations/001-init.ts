import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
      password_hash TEXT, role TEXT NOT NULL DEFAULT 'viewer'
        CHECK(role IN ('admin','analyst','viewer')),
      avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL, provider_account_id TEXT NOT NULL,
      refresh_token TEXT, access_token TEXT, expires_at INTEGER,
      token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL, session_token TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, ip_address TEXT NOT NULL, mac_address TEXT,
      hostname TEXT, os_detected TEXT, os_version TEXT, vendor TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      is_online INTEGER NOT NULL DEFAULT 0, threat_score REAL NOT NULL DEFAULT 0.0,
      tags TEXT, notes TEXT, whitelisted INTEGER NOT NULL DEFAULT 0,
      blacklisted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_ports (
      id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      port INTEGER NOT NULL, protocol TEXT NOT NULL CHECK(protocol IN ('tcp','udp')),
      state TEXT NOT NULL DEFAULT 'open', service TEXT, service_version TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(device_id, port, protocol)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY, scan_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('pending','running','completed','failed')),
      target TEXT, devices_found INTEGER DEFAULT 0, ports_found INTEGER DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
      error TEXT, triggered_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, machine_id TEXT UNIQUE,
      agent_type TEXT NOT NULL CHECK(agent_type IN ('windows','linux')),
      version TEXT, ip_address TEXT, os_version TEXT,
      status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online','offline','error')),
      last_heartbeat TEXT, registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      auth_token TEXT NOT NULL, public_key TEXT, capabilities TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS agent_file_scans (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER,
      sha256_hash TEXT NOT NULL, vt_status TEXT DEFAULT 'pending',
      vt_data TEXT, vt_checked_at TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sha256_hash)
    );

    CREATE TABLE IF NOT EXISTS agent_processes (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      pid INTEGER, name TEXT NOT NULL, path TEXT, cmdline TEXT,
      sha256_hash TEXT, is_suspicious INTEGER DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_connections (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      local_port INTEGER, remote_ip TEXT, remote_port INTEGER,
      protocol TEXT, process_name TEXT, is_suspicious INTEGER DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packet_captures (
      id TEXT PRIMARY KEY, agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      source_ip TEXT NOT NULL, interface_name TEXT, file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0, packet_count INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'capturing' CHECK(status IN ('capturing','completed','analyzing','analyzed','error')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
      expires_at TEXT NOT NULL, notes TEXT
    );

    CREATE TABLE IF NOT EXISTS packet_dns_queries (
      id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
      domain TEXT NOT NULL, query_type TEXT, response_ip TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')), count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS packet_connections (
      id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
      src_ip TEXT NOT NULL, src_port INTEGER, dst_ip TEXT NOT NULL, dst_port INTEGER,
      protocol TEXT, bytes_sent INTEGER DEFAULT 0, bytes_recv INTEGER DEFAULT 0,
      packets INTEGER DEFAULT 0, first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')), is_beacon INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vt_cache (
      id TEXT PRIMARY KEY, lookup_type TEXT NOT NULL CHECK(lookup_type IN ('hash','url','domain','ip')),
      lookup_value TEXT NOT NULL, response_data TEXT NOT NULL,
      malicious_count INTEGER DEFAULT 0, suspicious_count INTEGER DEFAULT 0,
      harmless_count INTEGER DEFAULT 0, undetected_count INTEGER DEFAULT 0,
      total_vendors INTEGER DEFAULT 0, community_score INTEGER,
      first_seen TEXT, last_seen TEXT,
      cached_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL,
      UNIQUE(lookup_type, lookup_value)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY, alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info','low','medium','high','critical')),
      title TEXT NOT NULL, description TEXT, device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL, metadata TEXT,
      is_read INTEGER NOT NULL DEFAULT 0, discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, title TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('daily','manual')),
      period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','completed','failed')),
      file_path TEXT, file_size INTEGER, summary_json TEXT,
      created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('scan_interval_minutes', '60'),
      ('port_scan_enabled', 'true'),
      ('port_ranges', '20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017'),
      ('udp_scan_enabled', 'false'),
      ('packet_capture_enabled', 'true'),
      ('packet_retention_days', '7'),
      ('discord_webhook_url', ''),
      ('discord_alerts_enabled', 'false'),
      ('vt_api_key', ''),
      ('vt_enabled', 'false'),
      ('auto_vt_check', 'true'),
      ('daily_report_time', '06:00'),
      ('threat_score_threshold', '5.0'),
      ('beaconing_detect_enabled', 'true');

    CREATE INDEX IF NOT EXISTS idx_device_ports_device_id ON device_ports(device_id);
    CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
    CREATE INDEX IF NOT EXISTS idx_agents_machine_id ON agents(machine_id);
    CREATE INDEX IF NOT EXISTS idx_agent_file_scans_agent_id ON agent_file_scans(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_processes_agent_id ON agent_processes(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_connections_agent_id ON agent_connections(agent_id);
    CREATE INDEX IF NOT EXISTS idx_packet_captures_agent_id ON packet_captures(agent_id);
    CREATE INDEX IF NOT EXISTS idx_packet_dns_queries_capture_id ON packet_dns_queries(capture_id);
    CREATE INDEX IF NOT EXISTS idx_packet_connections_capture_id ON packet_connections(capture_id);
    CREATE INDEX IF NOT EXISTS idx_vt_cache_expires_at ON vt_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
  `);
}
