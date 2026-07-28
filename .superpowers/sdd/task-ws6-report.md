# Workstream 6: Linux Native Agent — Report

## Status
**Complete**

Files created in `agents/linux/`:

- **`agent.py`** (192 lines) — NetVirenAgent class implementing:
  - `load_config()` / `save_config()` — JSON config management at `/etc/netviren-agent.json`
  - `get_machine_id()` — reads `/etc/machine-id`, falls back to UUID
  - `register()` — POSTs to `/api/agents/register`, persists auth token
  - `heartbeat()` — periodic POST to `/api/agents/{id}/heartbeat`
  - `scan_file(filepath)` — SHA256 hash in 64KB chunks
  - `scan_directory(directory)` — recursive walk + upload results
  - `get_processes()` — psutil process listing
  - `get_connections()` — ESTABLISHED TCP connections
  - `run()` — main loop: heartbeat every 30s + command polling

- **`requirements.txt`** — `requests>=2.31.0`, `psutil>=5.9.0`

- **`install.sh`** (58 lines) — creates config file, installs pip deps, creates systemd service unit, enables and starts the agent

## Commits
```
b3eb4ae feat: add NetViren Linux Native Agent (Workstream 6)
```

## Report Path
`C:\Users\Azubi\Documents\netztwerk viren scanner\.superpowers\sdd\task-ws6-report.md`
