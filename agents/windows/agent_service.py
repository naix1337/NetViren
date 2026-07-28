"""Windows Service wrapper for NetViren Agent.

Install:    python agent_service.py install
Remove:     python agent_service.py remove
Start:      python agent_service.py start
Stop:       python agent_service.py stop
Status:     python agent_service.py status
"""

import sys
import os

import win32serviceutil
import win32service
import win32event
import servicemanager

sys.path.append(os.path.dirname(__file__))
from agent import NetVirenAgent


class NetVirenAgentService(win32serviceutil.ServiceFramework):
    """Windows Service that runs the NetViren security agent."""

    _svc_name_ = "NetVirenAgent"
    _svc_display_name_ = "NetViren Security Agent"
    _svc_description_ = "Monitors system and reports to NetViren platform"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.agent = NetVirenAgent()

    def SvcStop(self):
        """Stop the service gracefully."""
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STOPPED,
            (self._svc_name_, ''),
        )

    def SvcDoRun(self):
        """Main service entry point."""
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, ''),
        )
        self.agent.run()


if __name__ == '__main__':
    if len(sys.argv) == 1:
        # Running as a service via the Service Control Manager
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(NetVirenAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        # Handle command-line arguments: install, remove, start, stop, status
        win32serviceutil.HandleCommandLine(NetVirenAgentService)
