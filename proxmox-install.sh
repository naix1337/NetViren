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

# ───── Terminal ─────
if [[ -t 0 ]]; then
  READ_CMD="read"
else
  READ_CMD="read </dev/tty"
fi

# ───── UI ─────
msgbox()   { whiptail --title " NetViren Installer " --msgbox "$1" 12 65 2>&1; }
input()    { whiptail --title " NetViren Installer " --inputbox "$1" 10 65 "$2" 2>&1; }
password() { whiptail --title " NetViren Installer " --passwordbox "$1" 10 65 2>&1; }

step() { echo "  ▪ $1"; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }

# ───── Spinner ─────
spinner() {
  local pid=$1
  local delay=0.15
  local spinstr='|/-\'
  local msg="${2:-Bitte warten...}"
  tput civis 2>/dev/null || true
  while kill -0 "$pid" 2>/dev/null; do
    for ((i=0; i<${#spinstr}; i++)); do
      printf "\r  [%c] %s" "${spinstr:$i:1}" "$msg"
      sleep $delay
    done
  done
  printf "\r  [✓] %-40s\n" "$msg"
  tput cnorm 2>/dev/null || true
}

# ───── HEADER ─────
clear
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║       🛡️  NetViren - LXC Installer            ║"
echo " ║        Network Security Platform              ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""

# ───── MENU ─────
CHOICE=$(whiptail --title " NetViren Installer " --menu "Wähle den Installationsmodus:" 14 50 3 \
  "1" "Standard  — 8GB, 2 Cores, 2GB, DHCP" \
  "2" "Advanced  — Eigene Konfiguration" \
  "3" "Exit" 2>&1)

case "$CHOICE" in
  "1")
    # Standard - defaults sind gesetzt
    ;;
  "2")
    CT_ID=$(input "Container-ID (leer = automatisch)" "")
    CT_ID=${CT_ID:-$(pvesh get /cluster/nextid 2>/dev/null || echo "100")}
    CT_HOSTNAME=$(input "Hostname" "$CT_HOSTNAME")
    CT_RAM=$(input "RAM in MB" "$CT_RAM")
    CT_CORES=$(input "CPU Cores" "$CT_CORES")
    CT_DISK=$(input "Disk in GB" "$CT_DISK")
    CT_IP=$(input "IP (z.B. 192.168.1.100/24 oder dhcp)" "$CT_IP")
    CT_PASSWORD=$(password "Root-Passwort (leer = generieren)")
    ;;
  *)
    echo ""
    echo "  Abbruch."
    exit 0
    ;;
esac

# Defaults
[[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
[[ -z "$CT_PASSWORD" ]] && CT_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16 2>/dev/null || echo "netviren$(date +%s)")

# ───── TEMPLATE ─────
clear
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║       🛡️  NetViren - Installation läuft       ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""

step "Suche Debian 12 Template..."

while read -r ST; do
  [[ -z "$ST" ]] && continue
  TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian" | awk '{print $1}' | head -1)
  [[ -n "$TEMPLATE_PATH" ]] && break
done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')

if [[ -z "$TEMPLATE_PATH" ]]; then
  if command -v timeout &>/dev/null; then
    step "Aktualisiere Template-Liste..."
    timeout 20 pveam update &>/dev/null || true
  fi

  TEMPLATE_LIST=$(pveam available 2>/dev/null | grep -iE "debian|ubuntu" | awk '{print $2}' | head -20)
  if [[ -z "$TEMPLATE_LIST" ]]; then
    echo ""
    echo "  ⚠  Keine Templates verfügbar."
    echo "  Manuell: pveam download local debian-12-standard_12.7-1_amd64.tar.zst"
    echo ""
    eval "$READ_CMD -p '  Enter drücken... '"
    exit 1
  fi

  RADIOLIST=()
  while IFS= read -r tmpl; do
    [[ -z "$tmpl" ]] && continue
    RADIOLIST+=("$tmpl" "$tmpl" "OFF")
  done <<< "$TEMPLATE_LIST"

  SELECTED=$(whiptail --title " Template Auswahl " --radiolist "Wähle ein Template:" 20 70 10 "${RADIOLIST[@]}" 2>&1)
  [[ -z "$SELECTED" ]] && { echo "  ✗ Abgebrochen."; exit 1; }

  step "Lade ${SELECTED}..."
  pveam download "local" "$SELECTED" 2>&1 | while IFS= read -r line; do echo "     $line"; done
  [[ ${PIPESTATUS[0]} -ne 0 ]] && { echo "  ✗ Download fehlgeschlagen."; exit 1; }

  sleep 2
  while read -r ST; do
    [[ -z "$ST" ]] && continue
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep "$(echo "$SELECTED" | sed 's/\.tar\.zst//')" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')
  [[ -z "$TEMPLATE_PATH" ]] && TEMPLATE_PATH="local:vztmpl/${SELECTED}"
fi

ok "Template gefunden"

# ───── STORAGE ─────
CT_STORAGE=$(pvesm status 2>/dev/null | grep -i "active" | awk '{print $1}' | head -1)
[[ -z "$CT_STORAGE" ]] && CT_STORAGE="local"

# ───── CONTAINER ─────
step "Erstelle Container $CT_ID..."

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
  --start 1 2>&1 | while IFS= read -r line; do echo "     $line"; done

if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
  echo "  ✗ Container-Erstellung fehlgeschlagen."
  exit 1
fi
ok "Container $CT_ID erstellt"

sleep 3

# ───── NETVIREN INSTALL (mit Spinner) ─────
echo ""

# Start installation in background, show spinner
pct exec "$CT_ID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq curl git openssl locales >/dev/null 2>&1 || true
  bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh) </dev/null
" >/tmp/netviren-install.log 2>&1 &
INSTALL_PID=$!

spinner "$INSTALL_PID" "Installiere NetViren im Container..."

wait "$INSTALL_PID" 2>/dev/null
if [[ $? -eq 0 ]]; then
  ok "NetViren installiert"
else
  warn "Installation hatte Warnungen — tail -20 /tmp/netviren-install.log"
fi

# ───── INFO ─────
CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')

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
