# Security Audit: Python Components

**Date:** 2026-07-29
**Scope:** Scanner Worker, Packet Capture Worker, Linux Agent, Windows Agent
**Type:** Comprehensive Security Review

---

## 1. Scanner Worker (`workers/scanner/`)

### 1.1 Nmap Argument Injection

**Files:** `port_scanner.py`, `os_detection.py`

**Fix verifiziert:** Ja. Commit `562917e` hat `_validate_target()` in beide Dateien eingefuegt.

```python
def _validate_target(target: str) -> None:
    if target.startswith('-'):
        raise ValueError(f"Invalid scan target (looks like a flag): {target}")
    try:
        ipaddress.ip_network(target, strict=False)
    except ValueError:
        raise ValueError(f"Invalid scan target: {target}")
```

**Bewertung:** Der Fix ist wirksam. Ein Angreifer kann keine Nmap-Flags (`-O`, `-sT`, `--script=...`) mehr via `target`-Parameter einschleusen. Die `ipaddress.ip_network()`-Validierung stellt sicher, dass nur gueltige IPs/CIDRs akzeptiert werden.

**Verbleibendes Risiko:** Niedrig. Der `port_range`-Parameter in `scan_ports_tcp()` und `scan_ports_udp()` wird **nicht validiert**. Ein Angreifer mit Schreibzugriff auf die `PORT_RANGES`-Umgebungsvariable (oder die DB, wenn die target-Validierung umgangen wird) koennte hier manipulierte Werte einschleusen. `python-nmap` uebergibt `port_range` direkt an nmap als zweiten Parameter (`nmap.scan(target, port_range, ...)`).

### 1.2 Berechtigungen / CAP_NET_RAW

**Datei:** `deploy/systemd/netviren-scanner.service`, `install.sh`

**Gefundene Konfiguration:**
- Systemd: `AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN`
- `install.sh`: `setcap cap_net_raw,cap_net_admin+ep ${PYTHON_BIN}`

**Risiko: HOCH.** Die `install.sh` setzt `cap_net_raw,cap_net_admin+ep` auf **die gesamte Python-Binaerdatei** (`/usr/bin/python3`). Das bedeutet:
- **Jedes** Python-Skript auf dem System erbt diese Capabilities.
- Ein kompromittiertes Skript oder eine versehentliche Ausfuehrung (z.B. `pip install`-Hook, `python3 -c "...")` kann Raw-Sockets oeffnen, Pakete manipulieren, ARP-Spoofing betreiben.
- `+ep` = Effektiv + Erlaubt, d.h. die Capability wird ohne Einschraenkung auf Kindprozesse vererbt.

**Empfehlung:**
- Statt `setcap` auf die Python-Binaerdatei sollte das Systemd-AmbientCapabilities-Feld allein genutzt werden.
- Oder: Capabilities nur auf ein dediziertes Binary setzen, das via `systemd` mit `CapabilityBoundingSet=CAP_NET_RAW` laeuft.

### 1.3 Exception Handling im Main-Loop

**Datei:** `main.py`

```python
def main():
    while True:
        db = get_db()
        try:
            scans = get_pending_scans(db)
            for scan in scans:
                execute_scan(db, scan)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        finally:
            db.close()
        time.sleep(10)
```

**Bewertung:** Das Exception-Handling faengt alle Exceptions im Main-Loop und logged sie. Der finally-Block schliesst die DB-Verbindung zuverlaessig. **Kein schwerwiegendes Risiko.**

**Kleine Schwachstelle:** Bei einem DB-Verbindungsfehler wird `db.close()` im finally-Block auf einer bereits defekten Verbindung aufgerufen. Das wirft eine weitere Exception, die den finally-Block vorzeitig beendet. Empfehlung: `finally: db.close()` in einen try/except blocken.

### 1.4 DB-Berechtigungen

**Datei:** `db.py`

```python
DB_PATH = os.environ.get('DATABASE_PATH', '/var/lib/netviren/db/netviren.db')
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
```

**Bewertung:**
- SQLite ohne Authentifizierung -- das ist im lokalen Setup akzeptabel, da der Scanner und die API auf derselben Maschine laufen und dieselbe SQLite-Datei nutzen.
- **Kein Schreib-Lock-Timeout gesetzt.** `sqlite3.connect()` nutzt den Default `timeout=5.0` (Sekunden). Bei gleichzeitigem Schreibzugriff von Scanner-Worker und API kann es zu `sqlite3.OperationalError: database is locked` kommen.
- WAL-Modus (+ `PRAGMA journal_mode=WAL`) ist korrekt gesetzt und reduziert Lock-Konflikte.
- **Keine Input-Validierung** in den SQL-Queries: Die `execute_scan()`-Funktion nutzt Parameterized Queries (`?`-Platzhalter), was **SQL-Injection zuverlaessig verhindert**.

---

## 2. Packet Capture Worker (`workers/packet-capture/`)

### 2.1 Fehlende main.py (toter Code)

**Feststellung:** Das Verzeichnis enthaelt nur `db.py` und `requirements.txt`. Die Datei `main.py`, die im Systemd-Service (`netviren-packet-capture.service`) referenziert wird, **existiert nicht**. Der Service wuerde beim Start sofort fehlschlagen (`ExecStart=/usr/bin/python3 main.py` schlaegt fehl).

**Risiko: NIEDRIG.** Der Service laeuft nicht, also besteht kein Sicherheitsrisiko durch unzureichende Berechtigungen. Aber die Packet-Capture-Funktionalitaet ist **nicht implementiert**. Die `packet_captures`-Tabelle in der DB wird nie befuellt.

### 2.2 Schreibrechte fuer pcap-Dateien

**Kein Code vorhanden, der pcap-Dateien schreibt.** Der Service ist nicht implementiert. Theoretisch waeren die Berechtigungen ueber das Systemd-Service-File konfiguriert (`User=netviren`, `Environment=PACKET_DIR=/var/lib/netviren/packets`).

**Empfehlung:** Wenn implementiert, muss sichergestellt werden:
- `PACKET_DIR` hat restriktive Berechtigungen (`0750`, Owner `netviren`)
- Keine world-readable pcap-Dateien (enthalten sensitive Netzwerkdaten)
- `CAP_NET_RAW` und `CAP_NET_ADMIN` sind nur via AmbientCapabilities gesetzt, **nicht** als globales `setcap` auf Python

### 2.3 Retention/Cleanup-Logik

**Nicht implementiert.** Die `.env.example` definiert `PACKET_RETENTION_DAYS=7`, aber es existiert keine Cleanup-Routine.

**Empfehlung:** Cleanup in den Packet-Capture-Worker integrieren: Taeglich pcap-Dateien, deren `expires_at` abgelaufen ist, loeschen und die DB-Eintraege aktualisieren.

### 2.4 Speicher-Overflow-Risiken

**Nicht bewertbar**, da kein Code existiert. Bei einer zukuenftigen Implementierung ist auf folgendes zu achten:
- Maximalgroesse pro pcap-Datei begrenzen (z.B. 500 MB)
- Ringbuffer oder rolling file writer verwenden
- Pcap-Dateien nicht ohne Limit im Speicher puffern

---

## 3. Linux Agent (`agents/linux/agent.py`)

### 3.1 Credential-Storage Berechtigungen

**Fix verifiziert:** Ja. Commit `562917e` aenderte `save_config()` von:

```python
# ALT (unsicher) -- alle Benutzer koennten die Datei lesen
with open(CONFIG_PATH, 'w') as f:
    json.dump(self.config, f, indent=2)

# NEU (sicher) -- nur Owner darf lesen/schreiben
fd = os.open(CONFIG_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as f:
    json.dump(self.config, f, indent=2)
```

**Bewertung:** Der Fix setzt korrekt `0o600` (Owner Read/Write). Der Konfigurationspfad `/etc/netviren-agent.json` ist damit vor unbefugtem Zugriff geschuetzt.

**Verbleibendes Risiko:** Die Datei wird unter `/etc/` abgelegt. Das Installationsskript (`install.sh`) setzt `User=nobody`. Wenn der Service als `nobody` laeuft, kann er nach `/etc/` schreiben -- das ist ungewohnlich und sollte auf `/var/lib/netviren-agent/` oder `~/.config/netviren/` geaendert werden.

### 3.2 Heartbeat-Sicherheit

**Datei:** `agents/linux/agent.py` (Zeile 64-75), `packages/api/src/modules/agents/routes.ts` (Zeile 58-66)

**Feststellung:** Der Heartbeat-Endpoint (`POST /api/agents/:id/heartbeat`) ist in der API von JWT-Authentifizierung ausgenommen, **aber das Backend validiert nicht den auth_token des Agents**. Jeder, der eine gueltige Agent-ID kennt (oder diese erraten/brute-forcen kann), kann Heartbeats im Namen jedes beliebigen Agents senden.

```typescript
// agents/routes.ts, Zeile 12:
if (path === '/api/agents/register' || path.match(/^\/api\/agents\/[^/]+\/heartbeat$/)) {
  return; // Allow without JWT -- KEINE Token-Pruefung!
}
```

**Risiko: HOCH.** Ein Angreifer kann:
- Heartbeats fuer nicht-existente Agents spoofen => die DB mit gefaelschten "online"-Eintraegen fuellen
- Bestehende Agents als "online" markieren, die offline sind
- Den Status des gesamten Netzwerks manipulieren

**Empfehlung:**
- Der Heartbeat-Endpoint sollte den `auth_token` des Agents als `Authorization: Bearer <token>`-Header auswerten
- Oder: Einen eindeutigen, geheimen Heartbeat-Key pro Agent generieren und via Header prüfen

### 3.3 Register-Endpoint ohne Auth

**Datei:** `packages/api/src/modules/agents/routes.ts` (Zeile 21-55)

**Feststellung:** Der Register-Endpoint (`POST /api/agents/register`) ist komplett ohne Authentifizierung. Jeder, der Netzwerkzugriff auf die API hat, kann beliebig viele Agents registrieren.

```typescript
app.post('/api/agents/register', async (req, reply) => {
    const { name, machineId, agentType, version, ipAddress, osVersion, publicKey, capabilities } = req.body;
    // Keine Authentifizierung, kein API-Key
    // Erzeugt einen neuen Agent mit gueltigem auth_token
```

**Risiko: MITTEL.** Ermoeglicht:
- Unbeschraenkte Registrierung von Fake-Agents (Datenbank fuellen)
- Generierung gueltiger auth_tokens fuer einen potenziellen Missbrauch
- Angriff auf die Speicher-/Session-Verwaltung des Backends

**Empfehlung:**
- Ein Pre-Shared-Key oder Enrollment-Token fuer die Agent-Registrierung erforderlich machen
- Rate-Limiting auf den Register-Endpoint anwenden

### 3.4 File-Scan-Berechtigungen

**Datei:** `agents/linux/agent.py` (Zeile 87-102, 104-124)

```python
def scan_file(self, filepath: str) -> dict:
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            sha256.update(chunk)

def scan_directory(self, directory: str):
    for root, dirs, files in os.walk(directory):
        for fname in files:
            fpath = os.path.join(root, fname)
            if os.path.isfile(fpath) and os.access(fpath, os.R_OK):
                result = self.scan_file(fpath)
```

**Bewertung:**
- Der Service laeuft als `User=nobody` (siehe `install.sh`). Dadurch hat er nur Leseberechtigung auf world-readable Dateien.
- **Path-Traversal:** Es gibt keine Einschraenkung des `directory`-Parameters. Wenn ein Kommando via API empfangen wird (`/api/agents/:id/commands`), das einen `scan_directory`-Befehl mit einem manipulierten Pfad sendet, koennte der Agent Dateien scannen, die nicht gescannt werden sollen.
- Der `scan_directory` hat einen Symlink-Angriffspunkt: Wenn ein Symlink in einem uebergebenen Verzeichnis auf `/etc/shadow` zeigt, wird `/etc/shadow` gelesen und gehasht (nicht der Klartext, aber der Hash wird an den Server gesendet).

**Empfehlung:**
- `directory`-Parameter validieren (Allowlist von erlaubten Verzeichnissen)
- `os.path.realpath()` vor dem Scannen aufrufen, um Symlinks aufzuloesen
- Nur bestimmte, konfigurierte Verzeichnisse scannen (z.B. `/usr/bin`, `/usr/local/bin`)

---

## 4. Windows Agent (`agents/windows/`)

### 4.1 Service-Berechtigungen

**Datei:** `agents/windows/agent_service.py`, `agents/windows/installer.nsi`

**Feststellung:**
- Der Windows-Service laeuft unter dem **SYSTEM-Konto** (Default bei NSIS `win32serviceutil`). Das ist die hoechste Berechtigungsstufe auf Windows.
- `RequestExecutionLevel admin` im NSIS-Installer stellt sicher, dass der Installer mit Admin-Rechten laeuft -- korrekt.
- Der Service-Name `NetVirenAgent` ist als `_svc_name_` hartkodiert.

**Risiko: HOCH.** Der Agent laeuft als SYSTEM, hat also vollen Lese-/Schreibzugriff auf das gesamte Dateisystem, Prozesse, Registry usw.
- Ein kompromittierter Agent (z.B. durch manipulierte `pip`-Dependencies) hat vollstaendige Systemkontrolle.
- Der Agent sendet ueber HTTP (nicht HTTPS) Datei-Hashes, Prozess- und Netzwerkinformationen an die Zentrale.

**Empfehlung:**
- Service mit niedrigeren Berechtigungen laufen lassen (z.B. `NT AUTHORITY\NetworkService` oder dediziertes Service-Konto).
- HTTPS fuer die Kommunikation erzwingen.

### 4.2 Credential-Storage (Windows)

**Datei:** `agents/windows/agent.py` (Zeile 46-49)

```python
def save_config(self):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, 'w') as f:
        json.dump(self.config, f, indent=2)
```

**Risiko: HOCH.** Anders als der Linux-Agent verwendet der Windows-Agent **kein `0o600`-Aequivalent** fuer die Konfigurationsdatei. Der Pfad ist `%APPDATA%\NetViren\agent.json`, was bedeutet:
- Die Datei wird mit Default-Berechtigungen erstellt (vererbt vom Parent-Verzeichnis)
- Andere Benutzer auf demselben System koennten den `auth_token` lesen
- **Keine ACLs oder `CreateFile`-Aufruf mit expliziten Sicherheitseinstellungen**

**Empfehlung:**
- Auf Windows sollte `win32security.SetFileSecurity()` oder `os.open()` mit entsprechenden Berechtigungen verwendet werden
- Oder: Die Credentials in `Credential Manager` speichern (`win32cred`)

### 4.3 NSIS-Installer-Sicherheit

**Datei:** `agents/windows/installer.nsi`

**Gefundene Probleme:**

1. **Unsicherer Python-Erkennungsmechanismus (Zeile 67-70):**
   ```nsis
   ReadRegStr $0 HKLM "Software\Python\PythonCore\3.11\InstallPath" ""
   ReadRegStr $0 HKLM "Software\Python\PythonCore\3.12\InstallPath" ""
   ```
   Der zweite `ReadRegStr` ueberschreibt den ersten Rueckgabewert (`$0`). Die Prufung funktioniert nur, weil `IfErrors` bei *beiden* Fehlschlaegen feuert, aber der Installationspfad wird nie korrekt in `$0` gespeichert.

2. **Web-Browser-Redirect fuer Python/Npcap-Installation (Zeile 80, 99):**
   ```nsis
   ExecShell "open" "https://www.python.org/downloads/"
   ```
   Oeffnet einen externen Link ohne Ueberpruefung -- verlaesst sich auf den Default-Browser. Bei einem kompromittierten System koennte ein anderer Browser geoeffnet werden.

3. **Fehlende Signaturpruefung:**
   - `nsExec::ExecToStack '"$INSTDIR\python.exe" -m pip install ...` (Zeile 110) -- verwendet die Python-Installation, die im System gefunden wurde, ohne zu pruelfen, ob sie vertrauenswuerdig ist
   - Keine Ueberpruefung der pip-Paketsignaturen oder Hashes

4. **Uninstaller loescht `%APPDATA%\NetViren` rekursiv (Zeile 147):**
   ```nsis
   RMDir /r "$APPDATA\NetViren"
   ```
   Der Uninstaller loescht **alle** Benutzerdaten ohne Bestaetigung. Wenn der Agent auf einem System mit mehreren Benutzern installiert war, werden alle `%APPDATA%\NetViren`-Verzeichnisse geloescht (nicht nur des aktuellen Benutzers -- NSIS `RMDir` bezieht sich auf den Pfad des aktuellen Benutzers, es sei denn, es wird `$APPDATA` eines anderen Benutzers referenziert).

5. **Fehlende Code-Signatur:** Der generierte `NetViren-Agent-Setup.exe` ist nicht signiert. Windows Defender/SmartScreen wird die Installation blockieren oder eine Warnung anzeigen.

6. **Kein HTTPS fuer pip (Zeile 110):**
   ```nsis
   nsExec::ExecToStack '"$INSTDIR\python.exe" -m pip install -r "$INSTDIR\requirements.txt"'
   ```
   pip standardisiert auf HTTPS, aber es gibt keine Konfiguration, die einen pypi-Mirror erzwingt oder HTTP-Verbindungen ablehnt.

### 4.4 Npcap-Paket-Capture-Stub

**Datei:** `agents/windows/agent.py` (Zeile 210-223)

Der `start_packet_capture()`-Aufruf ist ein reiner Stub (loggt nur `warning`). Keine tatsaechliche Paketerfassung implementiert. Das ist kein Sicherheitsproblem, aber die Funktionsluecke sollte dokumentiert sein.

---

## 5. Allgemein

### 5.1 Dependency-Keys / pypi Mirror Safety

**Festellung:**
- Es gibt **keine** `pip.conf`/`pip.ini` im Repository, die einen Mirror oder Index-URL vorgeben.
- Keine `.npmrc` fuer npm-Spiegel konfiguriert.
- Die `package-lock.json` bindet Versions-Hashes, aber `requirements.txt` fuer Python spezifiziert nur Mindestversionen:
  ```
  scapy>=2.6.0
  python-nmap>=0.7.0
  ```
- **Keine Hash-Pins** in den `requirements.txt`-Dateien.
- **Keine `pip freeze > requirements.txt`**, sondern manuell gepflegte Dependencies.

**Risiko: MITTEL.** Ohne Hash-Pinning (`--hash=sha256:...`) oder eine Lock-Datei (`pip-compile`, `poetry.lock`) ist ein Supply-Chain-Angriff auf pypi-Pakete moeglich:
- Ein kompromittiertes Paket-Update (z.B. `scapy 2.6.1`) wuerde automatisch installiert
- Die `install.sh` verwendet `pip3 install -r requirements.txt` ohne `--no-deps` oder `--require-hashes`
- Die manuellen pip-Installationen im NSIS-Installer sind ebenfalls ungeschuetzt

**Empfehlung:**
- Hashes in den requirements-Dateien nutzen (`--require-hashes`-Modus von pip)
- Oder: Poetry/Pipenv mit Lock-Dateien verwenden
- Index-URL explizit setzen: `--index-url https://pypi.org/simple/`
- `pip trust` auf pypi.org beschraenken

### 5.2 Fehlende Input-Validierung (zusaetzliche Funde)

**Scanner Worker:**
- `main.py` Zeile 32: `scan.get('target') or '192.168.1.0/24'` -- Fallback wird gesetzt, aber **keine Validierung** ob der target-Wert aus der DB ueberhaupt gueltig ist (wird erst in `_validate_target()` der Untermodule geprueft)
- `main.py` Zeile 25: `scan_type` (aus der DB) wird direkt mit `if scan_type in ('arp', 'full')` verglichen -- sicher, aber das koennte enumeriert werden

**API (Node.js):**
- `packets/routes.ts` `validatePacketPath()` verwendet `realpathSync` **bevor** `existsSync` geprueft wird -- der Fix in Commit `26f342c` hat dies korrigiert: `realpathSync` wirft eine Exception, wenn der Pfad nicht existiert. Der aktuelle Code pruft `existsSync` vor `realpathSync` nicht, aber faengt die Exception.
- **Kritisch:** Der `delete`-Handler (Zeile 59-75) ruft `validatePacketPath` *innerhalb* des try auf, aber vorher wird bereits `packet.file_path` via `fs.existsSync()` ohne `realpathSync` geprueft (Zeile 64). Wenn der Pfad ein Symlink ausserhalb des erlaubten Verzeichnisses waere, wuerde der `existsSync`-Check durchlaufen, aber `validatePacketPath` wuerde fehlschlagen -- der Fehler wird korrekt abgefangen.

### 5.3 Logging von sensitiven Daten

**Scanner Worker:**
- `main.py` Zeile 33: `logger.info(f"Starting scan {scan_id}: type={scan_type}, target={target}")` -- target wird geloggt, das ist akzeptabel (es ist die zu scannende IP/Netz)
- Zeile 112: `logger.error(f"Scan {scan_id} failed: {e}")` -- die Exception-Nachricht wird geloggt. Nmap-Fehlermeldungen koennten sensitive Pfade enthalten (z.B. `/tmp/...`)
- Zeile 146: `logger.error(f"Continuous monitoring error: {e}")` -- gleiches Problem

**Linux/Windows Agent:**
- Keine sensitiven Daten in Logs gefunden
- `scan_file()` gibt `filePath` im JSON zurueck, das an die API gesendet wird -- das koennte Pfadinformationen preisgeben (Information Disclosure, falls die API-Response an unberechtigte Benutzer geht)

**API (Node.js):**
- `Fastify` Logger ist auf `LOG_LEVEL` gesetzt. In `main.ts` wird `app.listen()` geloggt, aber keine sensitiven Request-Bodies.
- **Kein Logging von `AUTH_SECRET`, `VT_API_KEY` oder `DISCORD_WEBHOOK_URL`** gefunden.
- Die `.env.example` zeigt `VT_API_KEY=`, `DISCORD_WEBHOOK_URL=` als leere Werte -- korrekt.

### 5.4 Fehlende HSTS / HTTPS-Erzwingung

**Betrifft: Alle Agenten und die API**

- Die Agenten (`agents/linux/agent.py`, `agents/windows/agent.py`) kommunizieren via **HTTP** (`http://10.0.0.1:4001`). Kein HTTPS.
- Die API bindet auf `0.0.0.0` (alle Schnittstellen). Wenn die API ohne Reverse-Proxy betrieben wird, ist der Traffic unverschluesselt.
- Der `AUTH_SECRET` (JWT-Signing-Key) und `auth_token` der Agents werden im Klartext uebertragen.

**Risiko: HOCH** im Produktionsbetrieb, wenn die Kommunikation ein Netzwerk passiert (auch nur das lokale LXC-Bridge-Netzwerk koennte von anderen Containern abgehoert werden). **Niedrig** im Ein-Container-Setup (localhost-only), aber die API bindet auf `0.0.0.0`.

**Empfehlung:**
- HTTPS im Nginx-Reverse-Proxy terminieren (nginx.conf liegt bereit unter `deploy/nginx/`)
- Agenten-API-URL auf HTTPS setzen (erfordert Zertifikatsmanagement auf den Agenten)

---

## 6. Zusammenfassung der Risikobewertung

| # | Schwachstelle | Komponente | Risiko | Status |
|---|--------------|-----------|--------|--------|
| 1 | Globales `setcap` auf Python-Binaerdatei | Scanner Worker (install.sh) | **HOCH** | Nicht gefixt |
| 2 | Heartbeat ohne Token-Validierung | API (agent routes) | **HOCH** | Nicht gefixt |
| 3 | Windows-Agent laeuft als SYSTEM | Windows Agent | **HOCH** | Nicht gefixt |
| 4 | Windows-Agent Credentials ohne restriktive Berechtigungen | Windows Agent (agent.py) | **HOCH** | Nicht gefixt |
| 5 | Kein HTTPS (Klartext-Kommunikation) | Alle Agenten, API | **HOCH** | Nicht gefixt |
| 6 | Register-Endpoint ohne Authentifizierung | API (agent routes) | **MITTEL** | Nicht gefixt |
| 7 | Fehlende Hash-Pins in requirements.txt | Alle Python-Komponenten | **MITTEL** | Nicht gefixt |
| 8 | `port_range`-Parameter nicht validiert | Scanner (port_scanner.py) | **NIEDRIG** | Nicht gefixt |
| 9 | Fehlende `main.py` fuer Packet-Capture | Packet Capture Worker | **NIEDRIG** | Nicht behoben (nie implementiert) |
| 10 | Symlink-Angriff in `scan_directory` | Linux Agent | **NIEDRIG** | Nicht gefixt |
| 11 | DB-Verbindungsabbruch ohne try/except | Scanner (main.py) | **NIEDRIG** | Nicht gefixt |
| 12 | Kein DB-Lock-Timeout gesetzt | Scanner, Packet Capture | **NIEDRIG** | Nicht gefixt |

### Bereits Gefixt (aus frueheren Audits):

- Nmap-Argument-Injection (`_validate_target()`) -- Commit `562917e` -- **Bestanden**
- Linux-Agent-Credential-Speicher (`0o600`) -- Commit `562917e` -- **Bestanden**
- Path-Traversal in Packet-Routes (`realpathSync`) -- Commit `26f342c` -- **Bestanden**
- Auth-Bypass in Agent-Routes -- Commit `f46df5d` -- **Bestanden**

---

## 7. Wichtigste Handlungsempfehlungen (P0/P1)

### P0 (Sofort):
1. **`install.sh` fixen:** `setcap` auf Python-Binaerdatei entfernen. Stattdessen nur `AmbientCapabilities=` in den Systemd-Service-Dateien nutzen.
2. **Heartbeat-Authentifizierung fixen:** Den `auth_token` des Agents im Heartbeat-Endpoint validieren. Dafuer den Token aus dem Request-Body oder Authorization-Header lesen und gegen den DB-Eintrag prufen.
3. **Windows-Agent-Berechtigungen fixen:** Service als `NetworkService` statt SYSTEM laufen lassen. Konfigurationsdatei mit restriktiven ACLs schuetzen.

### P1 (Bald):
4. **HTTPS fuer Agent-Kommunikation:** Nginx-Reverse-Proxy mit LetsEncrypt-Zertifikat konfigurieren. Agent-API-URL auf HTTPS umstellen.
5. **Register-Endpoint absichern:** Pre-Shared-Key oder Enrollment-Token fuer die Agent-Registrierung einfuehren.
6. **Python-Dependency-Hashing:** `requirements.txt` mit `--require-hashes` und konkreten Package-Hashes versehen.
7. **Packet-Capture Worker implementieren oder Systemd-Service enfernen.** Der tote Service-Verweis (`netviren-packet-capture.service`) sollte geloescht oder die main.py implementiert werden.
