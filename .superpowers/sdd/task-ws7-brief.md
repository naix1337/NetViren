
**Files:**
- Create: `agents/windows/agent.py`
- Create: `agents/windows/requirements.txt`
- Create: `agents/windows/agent_service.py` (Windows Service Wrapper)
- Create: `agents/windows/installer.nsi`

The Windows agent is very similar to the Linux agent with these differences:
- Uses Npcap for packet capture (instead of libpcap)
- Runs as Windows Service (via Python service wrapper)
- Uses `wmi` module for process enumeration as fallback to psutil
- NSIS installer for easy deployment

- [ ] **Step 1: Create requirements.txt**

```
requests>=2.31.0
psutil>=5.9.0
pywin32>=306
wmi>=1.5.1
```

- [ ] **Step 2: Create agent.py** — Same as Linux but with Windows-specific paths and Npcap integration

- [ ] **Step 3: Create agent_service.py** — Windows Service wrapper using pywin32

```python
"""Windows Service wrapper for NetViren Agent."""
import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import os

sys.path.append(os.path.dirname(__file__))
from agent import NetVirenAgent

class NetVirenAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "NetVirenAgent"
    _svc_display_name_ = "NetViren Security Agent"
    _svc_description_ = "Monitors system and reports to NetViren platform"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.agent = NetVirenAgent()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ''))
        self.agent.run()

if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(NetVirenAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(NetVirenAgentService)
```

- [ ] **Step 4: Create installer.nsi**

```nsis
!include "MUI2.nsh"
Name "NetViren Agent"
OutFile "NetViren-Agent-Setup.exe"
InstallDir "$PROGRAMFILES\NetViren\Agent"

Section "Install"
  SetOutPath "$INSTDIR"
  File "agent.py"
  File "agent_service.py"
  File "requirements.txt"
  
  # Install Python if not present (simplified)
  ExecWait '"$INSTDIR\python-embed.exe" /quiet'
  
  # Install dependencies
  ExecWait '"$INSTDIR\python.exe" -m pip install -r requirements.txt'
  
  # Install service
  ExecWait '"$INSTDIR\python.exe" "$INSTDIR\agent_service.py" install'
  ExecWait "net start NetVirenAgent"
SectionEnd
```

---

