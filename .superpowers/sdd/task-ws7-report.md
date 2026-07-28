# Workstream 7: Windows Native Agent -- Report

## Status: Complete

All four files have been created in `agents/windows/` and committed to the `master` branch.

## Files Created

| File | Path | Description |
|------|------|-------------|
| `requirements.txt` | `agents/windows/requirements.txt` | Python dependencies: requests>=2.31.0, psutil>=5.9.0, pywin32>=306, wmi>=1.5.1 |
| `agent.py` | `agents/windows/agent.py` | `NetVirenAgent` class with Windows-specific implementation |
| `agent_service.py` | `agents/windows/agent_service.py` | `NetVirenAgentService` extending `win32serviceutil.ServiceFramework` |
| `installer.nsi` | `agents/windows/installer.nsi` | NSIS installer script with Python/Npcap detection and service registration |

## Key Implementation Details

### agent.py
- **Config path**: `%APPDATA%/NetViren/agent.json` (Windows-appropriate, not `/etc/`)
- **get_machine_id()**: Uses WMI (`Win32_ComputerSystemProduct.UUID`) as primary method, PowerShell command as fallback, deterministic UUID based on hostname + machine arch as third fallback
- **get_processes()**: Uses psutil primarily, falls back to WMI `Win32_Process` enumeration if psutil returns empty (handles restricted environments)
- **Npcap integration**: Stub `start_packet_capture()` method with comments on how to integrate scapy/pyshark with Npcap backend
- All other methods (register, heartbeat, scan_file, scan_directory, get_connections, run) mirror the Linux agent

### agent_service.py
- `NetVirenAgentService` extends `win32serviceutil.ServiceFramework`
- `_svc_name_` = "NetVirenAgent", with display name and description
- Handles both SCM dispatch (no args) and command-line control (install/remove/start/stop/status)

### installer.nsi
- Installs agent.py, agent_service.py, requirements.txt to `$PROGRAMFILES\NetViren\Agent`
- Detects existing Python 3 installation (checks registry for 3.11/3.12); prompts to open python.org if missing
- Detects Npcap via registry; prompts to open npcap.com if missing
- Runs pip install for dependencies
- Registers and starts the Windows service
- Full uninstaller: stops service, removes service, deletes files, removes registry keys
- Writes Add/Remove Programs registry entries

## Commit

```
8fb3fb6 - feat: add Windows Native Agent (Workstream 7)
  4 files changed, 482 insertions(+)
  create mode 100644 agents/windows/agent.py
  create mode 100644 agents/windows/agent_service.py
  create mode 100644 agents/windows/installer.nsi
  create mode 100644 agents/windows/requirements.txt
```

## Report Path

`.superpowers/sdd/task-ws7-report.md`
