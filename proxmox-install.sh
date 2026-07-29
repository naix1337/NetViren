#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# NetViren - Proxmox VE Installer
# https://github.com/naix1337/networkvirusscanner
# ═══════════════════════════════════════════════════════════
# Usage: bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/proxmox-install.sh)
# ═══════════════════════════════════════════════════════════

# Whiptail colors
export NEWT_COLORS='
root=,blue
roottext=white,blue
title=white,blue
roottext=white,blue
checkbox=white,blue
entry=white,blue
label=cyan,blue
actlistbox=white,blue
helpline=white,blue
roottext=white,blue
emptylisttext=white,blue
textbox=white,blue
actsellistbox=white,blue
'

# ───── Prüfungen ─────
if ! command -v pct &>/dev/null; then
  echo -e "\n Fehler: Dieses Script muss auf einem Proxmox VE Host ausgeführt werden.\n"
  exit 1
fi

if ! command -v whiptail &>/dev/null; then
  apt-get install -y whiptail &>/dev/null || echo "whiptail nicht verfügbar"
fi

# ───── Variablen ─────
CT_ID=""
CT_HOSTNAME="netviren"
CT_RAM="2048"
CT_CORES="2"
CT_DISK="8"
CT_IP="dhcp"
CT_PASSWORD=""
CT_STORAGE=""
TEMPLATE_PATH=""
LOG="/tmp/netviren-installer.log"

# ───── Terminal Zugriff ─────
# Bei bash <(curl ...) ist stdin die Pipe.
# read muss von /dev/tty lesen.
if [[ -t 0 ]]; then
  READ_CMD="read"
else
  READ_CMD="read </dev/tty"
fi

# ───── Hilfsfunktionen ─────
msgbox()  { whiptail --title " NetViren Installer " --msgbox "$1" 12 65 2>&1; }
yesno()   { whiptail --title " NetViren Installer " --yesno "$1" 12 65 2>&1; }
input()   { whiptail --title " NetViren Installer " --inputbox "$1" 10 65 "$2" 2>&1; }
password() { whiptail --title " NetViren Installer " --passwordbox "$1" 10 65 2>&1; }

log() { echo "[$(date +%H:%M:%S)] $*" >>"$LOG"; }
step() { echo "  ▪ $1"; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }

# ───── 1. HEADER ─────
clear
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║       🛡️  NetViren - LXC Installer            ║"
echo " ║        Network Security Platform              ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""

# ───── 2. MODUS ─────
if whiptail --title " NetViren Installer " --yesno "Standard Modus — 8GB, 2 Cores, 2GB RAM, DHCP\n\nAbbruch mit ESC" 10 65 2>&1; then
  # Standard Mode - defaults already set
  :
else
  # Advanced Mode
  CT_ID=$(input "Container-ID (leer = automatisch)" "")
  CT_ID=${CT_ID:-$(pvesh get /cluster/nextid 2>/dev/null || echo "100")}

  CT_HOSTNAME=$(input "Hostname" "$CT_HOSTNAME")
  CT_RAM=$(input "RAM in MB" "$CT_RAM")
  CT_CORES=$(input "CPU Cores" "$CT_CORES")
  CT_DISK=$(input "Disk in GB" "$CT_DISK")
  CT_IP=$(input "IP (z.B. 192.168.1.100/24 oder dhcp)" "$CT_IP")
  CT_PASSWORD=$(password "Root-Passwort (leer = generieren)")
fi

# Defaults setzen
[[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
[[ -z "$CT_PASSWORD" ]] && CT_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16 2>/dev/null || echo "netviren$(date +%s)")

# ───── 3. TEMPLATE ─────
clear
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║       🛡️  NetViren - Installation läuft       ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""

step "Suche Debian 12 Template..."

# In allen Storages suchen
while read -r ST; do
  [[ -z "$ST" ]] && continue
  TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian" | awk '{print $1}' | head -1)
  [[ -n "$TEMPLATE_PATH" ]] && break
done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')

# Kein Template gefunden → runterladen
if [[ -z "$TEMPLATE_PATH" ]]; then
  if command -v timeout &>/dev/null; then
    step "Aktualisiere Template-Liste..."
    timeout 20 pveam update &>/dev/null || true
  fi

  # Verfügbare Templates
  TEMPLATE_LIST=$(pveam available 2>/dev/null | grep -iE "debian|ubuntu" | awk '{print $2}' | head -20)
  if [[ -z "$TEMPLATE_LIST" ]]; then
    echo ""
    echo "  ⚠  Keine Templates in pveam verfügbar."
    echo "  Bitte lade manuell ein Template herunter:"
    echo "  pveam download local debian-12-standard_12.7-1_amd64.tar.zst"
    echo "  Dann: pvesm list local | grep debian"
    echo ""
    eval "$READ_CMD -p '  Enter drücken nach manuellem Download... '"
    exit 1
  fi

  # Template-Auswahl via whiptail
  RADIOLIST=()
  while IFS= read -r tmpl; do
    [[ -z "$tmpl" ]] && continue
    RADIOLIST+=("$tmpl" "$tmpl" "OFF")
  done <<< "$TEMPLATE_LIST"

  if [[ ${#RADIOLIST[@]} -eq 0 ]]; then
    echo "  ✗ Keine Templates verfügbar."
    exit 1
  fi

  SELECTED=$(whiptail --title " Template Auswahl " --radiolist "Wähle ein Template:" 20 70 10 "${RADIOLIST[@]}" 2>&1)
  if [[ -z "$SELECTED" ]]; then
    echo "  ✗ Abgebrochen."
    exit 1
  fi

  step "Lade ${SELECTED}..."
  pveam download "local" "$SELECTED" 2>&1 | while IFS= read -r line; do
    echo "     $line"
  done

  if [[ $? -ne 0 ]]; then
    echo "  ✗ Download fehlgeschlagen."
    exit 1
  fi

  sleep 2
  while read -r ST; do
    [[ -z "$ST" ]] && continue
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep "$(echo "$SELECTED" | sed 's/\.tar\.zst//')" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')
  [[ -z "$TEMPLATE_PATH" ]] && TEMPLATE_PATH="local:vztmpl/${SELECTED}"
fi

ok "Template gefunden"

# ───── 4. STORAGE ─────
CT_STORAGE=$(pvesm status 2>/dev/null | grep -i "active" | awk '{print $1}' | head -1)
[[ -z "$CT_STORAGE" ]] && CT_STORAGE="local"

# ───── 5. CONTAINER ─────
step "Erstelle Container $CT_ID..."

PASSWORD_ESC=$(echo "$CT_PASSWORD" | sed 's/"/\\"/g')

pct create "$CT_ID" "$TEMPLATE_PATH" \
  --hostname "$CT_HOSTNAME" \
  --storage "$CT_STORAGE" \
  --rootfs "${CT_STORAGE}:${CT_DISK}" \
  --cores "$CT_CORES" \
  --memory "$CT_RAM" \
  --net0 name=eth0,bridge=vmbr0,ip="$CT_IP" \
  --unprivileged 1 \
  --features nesting=1 \
  --password "$CT_PASSWORD" \
  --start 1 2>&1 | while IFS= read -r line; do
    echo "     $line"
  done

if [[ $? -ne 0 ]]; then
  echo "  ✗ Container-Erstellung fehlgeschlagen."
  exit 1
fi
ok "Container $CT_ID erstellt"

sleep 3

# ───── 6. NETVIREN ─────
echo ""
step "Installiere NetViren im Container..."
step "Das kann 5-15 Minuten dauern — bitte warten..."

pct exec "$CT_ID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq curl git openssl locales >/dev/null 2>&1 || true
  bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh)
" 2>&1 | while IFS= read -r line; do
  echo "     $line"
done

CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')

# ───── 7. FERTIG ─────
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║     ✅  NetViren installiert!                 ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""
echo "  Container:   $CT_ID ($CT_HOSTNAME)"
echo "  Zugriff:     pct enter $CT_ID"
[[ -n "$CT_IP_ADDR" ]] && echo "  Dashboard:   http://${CT_IP_ADDR}:3001"
echo "  Passwort:    $CT_PASSWORD"
echo ""
