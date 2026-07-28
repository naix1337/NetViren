; NetViren Agent Windows Installer (NSIS)
; ============================================
; Build: makensis installer.nsi
; Output: NetViren-Agent-Setup.exe

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

;--------------------------------
; General

Name "NetViren Agent"
OutFile "NetViren-Agent-Setup.exe"
InstallDir "$PROGRAMFILES\NetViren\Agent"
InstallDirRegKey HKLM "Software\NetViren\Agent" "InstallDir"
RequestExecutionLevel admin

;--------------------------------
; Interface Settings

!define MUI_ABORTWARNING
!define MUI_ICON "netviren.ico"
!define MUI_UNICON "netviren.ico"

;--------------------------------
; Pages

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
; Languages

!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Sections

Section "Install" SecInstall
  SetOutPath "$INSTDIR"

  ; Copy agent files
  File "agent.py"
  File "agent_service.py"
  File "requirements.txt"

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry for Add/Remove Programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\NetVirenAgent" \
    "DisplayName" "NetViren Security Agent"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\NetVirenAgent" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\NetVirenAgent" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\NetVirenAgent" \
    "DisplayIcon" "$INSTDIR\netviren.ico"
  WriteRegStr HKLM "Software\NetViren\Agent" "InstallDir" "$INSTDIR"

  ; Check for Python installation
  ClearErrors
  ReadRegStr $0 HKLM "Software\Python\PythonCore\3.11\InstallPath" ""
  ReadRegStr $0 HKLM "Software\Python\PythonCore\3.12\InstallPath" ""
  IfErrors 0 python_found

  ; Python not found -- attempt to install embedded Python
  ; In a production build, bundle python-3.x.x-embed-amd64.zip contents here
  ; For now, prompt to install Python from python.org
  MessageBox MB_YESNO \
    "Python 3 was not detected on this system.$\n$\nWould you like to install Python 3.12?$\n(A web browser will open to python.org)" \
    /SD IDYES IDNO python_skip

  ExecShell "open" "https://www.python.org/downloads/"
  MessageBox MB_OK "Please re-run this installer after Python 3 is installed."
  Goto python_skip

python_found:
  DetailPrint "Python 3 detected at: $0"

python_skip:

  ; Check for Npcap
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Npcap" ""
  IfErrors 0 npcap_found

  ; Npcap not found -- prompt to install
  MessageBox MB_YESNO \
    "Npcap was not detected on this system.$\n$\nNpcap is required for packet capture.$\nInstall Npcap now? (A web browser will open to npcap.com)" \
    /SD IDYES IDNO npcap_skip

  ExecShell "open" "https://npcap.com/#download"
  MessageBox MB_OK "Please re-run this installer after Npcap is installed."
  Goto npcap_skip

npcap_found:
  DetailPrint "Npcap detected"

npcap_skip:

  ; Install Python dependencies
  DetailPrint "Installing Python dependencies..."
  nsExec::ExecToStack '"$INSTDIR\python.exe" -m pip install -r "$INSTDIR\requirements.txt"'
  Pop $0
  DetailPrint "pip install exit code: $0"

  ; Install and start the Windows service
  DetailPrint "Registering NetViren Agent service..."
  nsExec::ExecToStack '"$INSTDIR\python.exe" "$INSTDIR\agent_service.py" install'
  Pop $0
  DetailPrint "Service install exit code: $0"

  DetailPrint "Starting NetViren Agent service..."
  nsExec::ExecToStack 'net start NetVirenAgent'
  Pop $0
  DetailPrint "Service start exit code: $0"

SectionEnd

;--------------------------------
; Uninstaller

Section "Uninstall"
  ; Stop and remove the service
  DetailPrint "Stopping NetViren Agent service..."
  nsExec::ExecToStack 'net stop NetVirenAgent'
  Pop $0

  DetailPrint "Removing NetViren Agent service..."
  nsExec::ExecToStack '"$INSTDIR\python.exe" "$INSTDIR\agent_service.py" remove'
  Pop $0

  ; Remove files
  Delete "$INSTDIR\agent.py"
  Delete "$INSTDIR\agent_service.py"
  Delete "$INSTDIR\requirements.txt"
  Delete "$INSTDIR\Uninstall.exe"

  ; Remove config directory
  RMDir /r "$APPDATA\NetViren"

  ; Remove install directory
  RMDir "$INSTDIR"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\NetVirenAgent"
  DeleteRegKey HKLM "Software\NetViren\Agent"

SectionEnd
