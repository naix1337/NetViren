# NetViren - Benutzerhandbuch

> **Netzwerk-Sicherheitsplattform für professionelle Umgebungen**
> Version 1.0.0 | Deutsch

---

## Inhaltsverzeichnis

1. [Überblick](#1-überblick)
2. [Erste Schritte](#2-erste-schritte)
3. [Dashboard](#3-dashboard)
4. [Netzwerkgeräte verwalten](#4-netzwerkgeräte-verwalten)
5. [Scans durchführen](#5-scans-durchführen)
6. [Agenten verwalten](#6-agenten-verwalten)
7. [Paketanalyse](#7-paketanalyse)
8. [VirusTotal-Integration](#8-virustotal-integration)
9. [Alarme & Benachrichtigungen](#9-alarme--benachrichtigungen)
10. [Berichte](#10-berichte)
11. [Benutzer & Rollen](#11-benutzer--rollen)
12. [Einstellungen](#12-einstellungen)
13. [FAQ / Fehlerbehebung](#13-faq--fehlerbehebung)

---

## 1. Überblick

NetViren ist eine professionelle Network Security Platform zur Überwachung und Analyse lokaler Netzwerke. Die Plattform erfasst kontinuierlich Netzwerkgeräte, führt Sicherheitsscans durch, analysiert Netzwerkpakete und alarmiert bei verdächtigen Aktivitäten.

### Kernfunktionen

| Funktion | Beschreibung |
|----------|-------------|
| **Netzwerk-Discovery** | Automatische Erkennung aller Geräte via ARP, ICMP und Nmap |
| **Port-Scanning** | TCP/UDP-Port-Scans mit konfigurierbaren Ranges |
| **OS-Erkennung** | Betriebssystem-Fingerprinting erkannte Geräte |
| **Agent-System** | Leichte native Agents für Windows und Linux |
| **Paketanalyse** | Deep Packet Inspection, DNS-Analyse, Beaconing-Erkennung |
| **VirusTotal** | Hash/URL/Domain/IP-Abgleich mit VirusTotal |
| **Reporting** | Tägliche PDF-Reports + Discord-Benachrichtigungen |
| **Mehrbenutzer** | Rollenbasiertes Zugriffskontrollsystem |

---

## 2. Erste Schritte

### 2.1 Anmeldung

1. Öffne die NetViren-Weboberfläche im Browser
2. Gib deine Zugangsdaten ein (vom Administrator bereitgestellt)
3. Klicke auf **Anmelden**

**Unterstützte Anmeldemethoden:**
- Benutzername + Passwort
- Google OAuth (falls konfiguriert)
- GitHub OAuth (falls konfiguriert)

### 2.2 Erster Überblick

Nach der Anmeldung siehst du das **Dashboard** mit:
- **Global Threat Score** — Gesamtbedrohungsbewertung deines Netzwerks
- **Geräte online/offline** — Aktueller Status aller erkannten Geräte
- **Aktive Scans** — Derzeit laufende Scan-Vorgänge
- **Letzte Alarme** — Die neuesten Sicherheitsereignisse
- **Live Activity Feed** — Echtzeit-Aktivitäten im Netzwerk

### 2.3 Navigation

Die Seitenleiste (links) bietet Zugriff auf alle Bereiche:

```
🛡️  Dashboard       — Startseite mit Übersicht
💻  Geräte           — Netzwerkgeräte verwalten
🤖  Agents           — Installierte Agents
📁  Datei-Scans      — Ergebnisse der Dateiscans
🌐  Paketanalyse     — Netzwerkpakete analysieren
📋  Zeitstrahl       — Chronologische Ereignisse
🔔  Alarme           — Sicherheitswarnungen
📊  Berichte         — PDF-Reports generieren
⚙️  Einstellungen    — Systemkonfiguration
```

---

## 3. Dashboard

Das Dashboard ist die zentrale Ansicht der Plattform.

### 3.1 Threat Score

Der **Globale Threat Score** ist eine gewichtete Bewertung (0–100) des gesamten Netzwerks:

- **0–20** 🟢 Sicher — Normalbetrieb
- **20–50** 🟡 Mittel — Auffälligkeiten vorhanden
- **50–80** 🟠 Hoch — Handlungsbedarf
- **80–100** 🔴 Kritisch — Sofortiges Eingreifen erforderlich

Der Score berechnet sich aus:
- Anzahl offener Ports auf kritischen Diensten
- VirusTotal-Treffer
- Beaconing-Aktivitäten
- Anzahl offline Geräte (unerwartet)
- Threat-Score einzelner Geräte

### 3.2 Live Activity Feed

Der Live-Feed zeigt Echtzeit-Ereignisse:
- Neue Geräte im Netzwerk
- Gestartete/abgeschlossene Scans
- Generierte Alarme
- Agent-Statusänderungen
- VirusTotal-Treffer

### 3.3 Schnellaktionen

- **Schnellscan** — ARP-Scan des lokalen Subnetzes starten
- **Vollständiger Scan** — ARP + Port + OS Scan durchführen
- **Bericht generieren** — PDF-Report manuell erstellen

---

## 4. Netzwerkgeräte verwalten

### 4.1 Geräteliste

Die Geräteübersicht zeigt alle erkannten Netzwerkgeräte als Tabelle mit:

| Spalte | Beschreibung |
|--------|-------------|
| IP-Adresse | IPv4-Adresse des Geräts |
| MAC-Adresse | Hardware-Adresse |
| Hostname | DNS-Name (falls auflösbar) |
| Betriebssystem | Erkanntes OS (via Nmap-Fingerprinting) |
| Hersteller | MAC-OUI-Hersteller |
| Ports | Anzahl offener Ports |
| Bedrohung | Gerätebezogener Threat-Score |
| Status | Online/Offline |
| Letzte Aktivität | Zeitstempel der letzten Kommunikation |

### 4.2 Gerätedetails

Durch Klicken auf ein Gerät öffnest du die Detailansicht mit:
- **Allgemeine Informationen** — IP, MAC, Hostname, OS, Hersteller
- **Offene Ports** — Liste aller erkannten Ports mit Dienst und Version
- **Threat-Verlauf** — Entwicklung des Threat-Scores über Zeit
- **Whitelist/Blacklist** — Gerät zur Whitelist/Blacklist hinzufügen
- **Notizen** — Freitext-Notizen zum Gerät

### 4.3 Whitelist / Blacklist

**Whitelist:** Geräte auf der Whitelist werden von Scans ausgeschlossen und lösen keine Alarme aus. Geeignet für vertrauenswürdige Geräte wie Drucker, Switches, etc.

**Blacklist:** Geräte auf der Blacklist werden mit erhöhtem Threat-Score markiert. Geeignet für unbekannte oder verdächtige Geräte.

### 4.4 Netzwerkkarte

Die optionale Netzwerkkarte zeigt eine visuelle Topologie aller erkannten Geräte und ihrer Verbindungen.

---

## 5. Scans durchführen

### 5.1 Scan-Typen

| Scan-Typ | Beschreibung | Dauer |
|----------|-------------|-------|
| **ARP-Scan** | Erkennt Geräte via ARP-Requests | ~5 Sek. |
| **ICMP-Scan** | Ping-Sweep des Zielnetzes | ~10 Sek. |
| **TCP-Port-Scan** | Scannt TCP-Ports auf offene Dienste | Konfigurierbar |
| **UDP-Port-Scan** | Scannt UDP-Ports | Konfigurierbar |
| **OS-Erkennung** | Bestimmt Betriebssystem via Nmap | ~30 Sek. pro Host |
| **Vollständiger Scan** | Führt alle Scans kombiniert aus | Je nach Netzwerkgröße |

### 5.2 Scan auslösen

1. Navigiere zu **Geräte**
2. Klicke auf **Scan starten**
3. Wähle den Scan-Typ
4. Gib das Zielnetzwerk ein (z.B. `192.168.1.0/24`)
5. Klicke auf **Starten**

Alternativ über das Dashboard: Nutze die **Schnellaktionen**.

### 5.3 Automatische Scans

NetViren kann automatische Scans in konfigurierbaren Intervallen durchführen:

1. Gehe zu **Einstellungen → Scan-Einstellungen**
2. Aktiviere **Automatische Scans**
3. Lege das Intervall fest (Standard: 60 Minuten)
4. Wähle den Scan-Typ für automatische Scans
5. Speichere die Einstellungen

Der **Continuous Monitoring**-Modus führt einen leichten ARP-Check alle 60 Sekunden durch, um Online/Offline-Status aktuell zu halten.

---

## 6. Agenten verwalten

### 6.1 Was sind Agents?

NetViren-Agents sind leichte native Programme, die auf Windows- und Linux-Systemen installiert werden. Sie kommunizieren sicher mit dem NetViren-Server und führen folgende Aufgaben aus:

- **Dateiscanning** — Berechnet SHA256-Hashes von Dateien
- **Packet Capture** — Führt echte Paketaufzeichnungen durch
- **Prozess-Monitoring** — Meldet laufende Prozesse und Netzwerkverbindungen
- **Health-Check** — Regelmäßige Status-Updates (Heartbeat)

### 6.2 Agent installieren

**Linux:**
```bash
# Auf dem Zielsystem ausführen:
curl -sSL http://netviren-server:4001/agent/install.sh | bash
# Oder manuell:
sudo python3 /opt/netviren/agents/linux/agent.py
```

**Windows:**
1. Lade das NSIS-Installationspaket herunter
2. Führe `NetViren-Agent-Setup.exe` aus
3. Der Agent wird als Windows-Dienst installiert und gestartet

### 6.3 Agent-Registrierung

Beim ersten Start registriert sich der Agent automatisch am Server:
- Er generiert eine eindeutige Maschinen-ID
- Sendet seine Fähigkeiten (Capabilities) an den Server
- Erhält ein Authentifizierungs-Token
- Beginnt mit regelmäßigen Heartbeats (alle 30 Sekunden)

### 6.4 Agent-Status

Im **Agent Management**-Bereich siehst du:

| Status | Bedeutung |
|--------|-----------|
| 🟢 Online | Agent verbunden, letzter Heartbeat < 60s |
| 🔴 Offline | Agent nicht erreichbar, Heartbeat > 120s |
| ⚠️ Error | Agent meldet Fehler |

### 6.5 Gescannte Dateien

Datei-Scans werden im Bereich **Datei-Scans** angezeigt:
- Dateipfad und -name
- Dateigröße
- SHA256-Hash
- VirusTotal-Status (wenn integriert)
- Manueller VT-Check möglich

---

## 7. Paketanalyse

### 7.1 Paket-Captures

NetViren kann Netzwerkpakete aufzeichnen und analysieren:

1. **Automatische Captures** — Dauerhafte Aufzeichnung auf konfigurierten Interfaces
2. **Manuelle Captures** — Auf Knopfdruck starten/stoppen
3. **Agent-Captures** — Agents führen Captures auf entfernten Systemen durch

### 7.2 Aufbewahrung

- Standard-Aufbewahrungsdauer: **7 Tage**
- Automatische Bereinigung alter Captures
- Manuelles Löschen einzelner Captures möglich
- PCAP-Download für externe Tools (Wireshark, tcpdump)

### 7.3 Analysierte Daten

**DNS-Anfragen:**
- Alle DNS-Queries im Capture
- Domain, Query-Typ (A, AAAA, MX, etc.), Antwort-IPs
- Sortiert nach Häufigkeit

**Verbindungen (Top-Talker):**
- Quell-/Ziel-IPs und Ports
- Übertragene Bytes und Pakete
- Protokoll (TCP/UDP/ICMP)
- Sortiert nach Datenvolumen

**Beaconing-Erkennung:**
- Automatische Erkennung regelmäßiger Verbindungen
- Typisch für C&C-Kommunikation
- Erzeugt Alarm bei Verdacht

### 7.4 PCAP-Download

Gehe zu **Paketanalyse → Capture auswählen → PCAP herunterladen**.
Die Datei kann mit Wireshark, tcpdump oder anderen Analyse-Tools geöffnet werden.

---

## 8. VirusTotal-Integration

### 8.1 Konfiguration

1. Gehe zu **Einstellungen → VirusTotal**
2. Gib deinen VirusTotal-API-Schlüssel ein
3. Wähle die Lookup-Typen (Hash, URL, Domain, IP)
4. Aktiviere/deaktiviere automatische Checks
5. Speichere die Einstellungen

### 8.2 Lookup-Typen

| Typ | Beschreibung | API-Endpoint |
|-----|-------------|-------------|
| **SHA256-Hash** | Datei-Hash aus Agent-Scans | `/api/v3/files/{hash}` |
| **URL** | Verdächtige URLs | `/api/v3/urls/{url}` |
| **Domain** | DNS-Domains | `/api/v3/domains/{domain}` |
| **IP** | IP-Adressen | `/api/v3/ip_addresses/{ip}` |

### 8.3 Ergebnisse verstehen

```
Detection Ratio: 5/72 (5 von 72 Virenscannern erkennen Bedrohung)
┌─────────────────────────────────────────────────┐
│ Vendor          │ Ergebnis     │ Aktualisiert    │
├─────────────────┼──────────────┼─────────────────┤
│ Microsoft       │ Trojan:Win32 │ 2026-07-28      │
│ McAfee          │ Generic      │ 2026-07-28      │
│ Kaspersky       │ UDS:Trojan   │ 2026-07-28      │
│ ...             │ ...          │ ...             │
└─────────────────────────────────────────────────┘
Community Score: -1 (negativ = mehr Detektionen)
First Seen: 2026-01-15
Last Seen: 2026-07-28
```

### 8.4 Caching

VirusTotal-Ergebnisse werden für **24 Stunden** gecached, um API-Limits zu schonen und die Antwortzeiten zu verbessern.

---

## 9. Alarme & Benachrichtigungen

### 9.1 Alarm-Typen

| Typ | Standard-Severity | Beschreibung |
|-----|-------------------|-------------|
| `new_device` | Info | Neues Gerät im Netzwerk erkannt |
| `device_offline` | Medium | Gerät nicht mehr erreichbar |
| `threat` | High | Bedrohung durch VT-Treffer oder Anomalie |
| `port_change` | Medium | Neue offene Ports auf einem Gerät |
| `vt_hit` | Critical | VirusTotal-Treffer bei Datei/Domain/IP |
| `suspicious_process` | Medium | Verdächtiger Prozess auf Agent |
| `beaconing` | High | Regelmäßige Verbindung zu unbekanntem Ziel |
| `scan_complete` | Info | Scan abgeschlossen |
| `agent_offline` | Medium | Agent nicht erreichbar |

### 9.2 Alarme verwalten

1. **Alarme anzeigen** — Navigiere zu **Alarme**
2. **Filtern** — Nach Schweregrad oder Typ filtern
3. **Als gelesen markieren** — Einzeln oder alle auf einmal
4. **Dismiss** — Alarm verwerfen (bei Fehlalarm)

### 9.3 Discord-Benachrichtigungen

1. Gehe zu **Einstellungen → Discord**
2. Gib die Webhook-URL ein
3. Wähle den minimalen Severity-Level für Benachrichtigungen
4. Aktiviere Discord-Benachrichtigungen
5. Klicke auf **Speichern**

**Discord-Embed-Format:**
```
┌─────────────────────────────────────┐
│ 🚨 NetViren Alarm                   │
│ Severity: HIGH                      │
│                                     │
│ Beaconing detected:                 │
│ 192.168.1.50 → 45.33.32.156:443    │
│ Regelmäßige Verbindungen (12x)      │
│                                     │
│ ─────────────────────────────────── │
│ NetViren · 2026-07-29 14:30:22     │
└─────────────────────────────────────┘
```

---

## 10. Berichte

### 10.1 Automatische Tagesberichte

NetViren generiert täglich um **06:00 Uhr** einen PDF-Report mit:

- **Geräte-Status** — Online/Offline, neu hinzugekommen, verschwunden
- **Neue Bedrohungen** — Alarme des letzten Tages mit Severity
- **Top-Talker** — Meist kommunizierende Geräte
- **Port-Änderungen** — Neue/geschlossene Ports
- **VirusTotal-Treffer** — Neue Detektionen
- **Threat-Score-Zusammenfassung** — Entwicklung der letzten 24h
- **Letzte Scans** — Status der automatischen Scans

### 10.2 Manuelle Berichte

1. Navigiere zu **Berichte**
2. Klicke auf **Bericht generieren**
3. Wähle den Zeitraum
4. Wähle die gewünschten Inhalte
5. Klicke auf **Generieren**
6. Nach Fertigstellung: **PDF herunterladen**

### 10.3 Berichtsformate

- **PDF** — Vollständiges, professionell formatiertes Dokument
- HTML-Version in Vorbereitung

---

## 11. Benutzer & Rollen

### 11.1 Rollen

| Rolle | Berechtigungen |
|-------|---------------|
| **Admin** | Vollzugriff: Settings, User-Management, System-Konfiguration, Scans |
| **Analyst** | Scans auslösen, Reports generieren, Analysen, Alarme verwalten |
| **Viewer** | Nur-Lesen: Dashboard, Geräte, Agents, Berichte ansehen |

### 11.2 Benutzer verwalten (Admin)

1. Gehe zu **Einstellungen → Benutzer**
2. Klicke auf **Benutzer hinzufügen**
3. Gib Benutzername, E-Mail, Rolle und Passwort ein
4. Klicke auf **Speichern**

### 11.3 Authentifizierung

- **Credentials** — Benutzername + Passwort (bcrypt-gehasht)
- **Google OAuth** — Anmeldung mit Google-Konto
- **GitHub OAuth** — Anmeldung mit GitHub-Konto

---

## 12. Einstellungen

### 12.1 Allgemein

| Einstellung | Beschreibung | Standard |
|-------------|-------------|----------|
| Sprache | Interface-Sprache | Deutsch |
| Scan-Intervall | Minuten zwischen Scans | 60 |
| Aufbewahrungsdauer | Tage für Packet-Captures | 7 |

### 12.2 Scan-Einstellungen

| Einstellung | Beschreibung | Standard |
|-------------|-------------|----------|
| TCP-Scans aktiviert | Port-Scans durchführen | true |
| UDP-Scans aktiviert | UDP-Ports scannen | false |
| Port-Ranges | Zu scannende Ports | 20-25,53,80,... |
| OS-Erkennung | Betriebssystem-Fingerprinting | true |

### 12.3 VirusTotal

| Einstellung | Beschreibung |
|-------------|-------------|
| API-Key | VirusTotal API-Schlüssel |
| Auto-Check | Automatische Prüfung neuer Hashes |
| Cache-TTL | Cache-Gültigkeit (Standard: 24h) |

### 12.4 Discord

| Einstellung | Beschreibung |
|-------------|-------------|
| Webhook-URL | Discord-Webhook für Benachrichtigungen |
| Alarme senden | Benachrichtigungen aktivieren |
| Min. Level | Niedrigster Severity-Level für Benachrichtigungen |

---

## 13. FAQ / Fehlerbehebung

### 13.1 Geräte werden nicht gefunden

**Mögliche Ursachen:**
1. Falsches Subnetz konfiguriert → Prüfe die Ziel-IP in den Scan-Einstellungen
2. ARP-Scans funktionieren nur im lokalen Layer-2-Netzwerk → Nutze ICMP/Nmap für routed Netzwerke
3. Firewall blockiert ARP-Requests → Prüfe CAP_NET_RAW Berechtigungen

### 13.2 Scanner startet nicht

```bash
# Prüfe, ob der Scanner-Prozess läuft:
ps aux | grep scanner

# Prüfe die Logs:
cat /var/log/netviren/*.log

# Stelle sicher, dass CAP_NET_RAW gesetzt ist:
sudo setcap cap_net_raw,cap_net_admin+ep $(which python3)
```

### 13.3 Agent verbindet sich nicht

```bash
# Auf dem Agent-System prüfen:
systemctl status netviren-agent
journalctl -u netviren-agent -n 50

# API-URL prüfen:
cat /etc/netviren-agent.json
```

### 13.4 Frontend ist nicht erreichbar

```bash
# Prüfe, ob der Frontend-Server läuft:
curl -s http://localhost:3001/login

# Prüfe die Firewall:
sudo ufw status | grep 3001

# Prüfe die Logs:
cat /var/log/netviren/frontend.log
```

### 13.5 Datenbank-Wiederherstellung

```bash
# Backup erstellen:
cp /var/lib/netviren/db/netviren.db /var/lib/netviren/backup-$(date +%Y%m%d).db

# Migrationen zurücksetzen (Achtung: Datenverlust!):
rm /var/lib/netviren/db/netviren.db
systemctl restart netviren-api
```

---

> **NetViren v1.0.0** — Network Security Platform
> Dokumentation zuletzt aktualisiert: Juli 2026
