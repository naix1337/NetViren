#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# NetViren - Proxmox VE Installer
# https://github.com/naix1337/networkvirusscanner
# ═══════════════════════════════════════════════════════════
# Usage: bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/proxmox-install.sh)
# ═══════════════════════════════════════════════════════════

export NEWT_COLORS='
root=,blue
roottext=white,blue
title=white,blue
checkbox=white,blue
entry=white,blue
label=cyan,blue
actlistbox=white,blue
helpline=white,blue
emptylisttext=white,blue
textbox=white,blue
actsellistbox=white,blue
'

LOG="/tmp/netviren-install.log"

# ───── Prüfungen ─────
if ! command -v pct &>/dev/null; then
  echo -e "\n Fehler: Dieses Script muss auf einem Proxmox VE Host ausgeführt werden.\n"
  exit 1
fi

if ! command -v whiptail &>/dev/null; then
  apt-get install -y whiptail &>/dev/null || { echo "whiptail nicht installiert"; exit 1; }
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

# ───── Terminal ─────
if [[ -t 0 ]]; then
  READ_CMD="read"
else
  READ_CMD="read </dev/tty"
fi

# ───── Whiptail (korrigiertes stdout/stderr) ─────
input()    { whiptail --title " NetViren Installer " --inputbox "$1" 10 65 "$2" 3>&1 1>&2 2>&3; }
password() { whiptail --title " NetViren Installer " --passwordbox "$1" 10 65 3>&1 1>&2 2>&3; }

# ───── Ausgabe ─────
step() { echo "  ▪ $1"; }
ok()   { echo "  ✓ $1"; }
warn() { echo "  ⚠ $1"; }

# ───── Spinner (wartet auf PID und zeigt Exit-Status) ─────
spinner() {
  local pid=$1
  local msg="${2:-Bitte warten...}"
  local delay=0.15
  local spinstr='|/-\'
  tput civis 2>/dev/null || true
  while kill -0 "$pid" 2>/dev/null; do
    for ((i=0; i<${#spinstr}; i++)); do
      printf "\r  [%c] %s" "${spinstr:$i:1}" "$msg"
      sleep $delay
    done
  done
  # Warten bis der Prozess vollständig abgeräumt ist
  wait "$pid" 2>/dev/null
  local rc=$?
  if [[ $rc -eq 0 ]]; then
    printf "\r  [${GR}✓${NC}] %-45s\n" "$msg"
  else
    printf "\r  [${RD}✗${NC}] %-45s\n" "$msg"
  fi
  tput cnorm 2>/dev/null || true
  return $rc
}

# ═══════════════════════════════════════════════════════════
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
  "3" "Exit" 3>&1 1>&2 2>&3)

case "$CHOICE" in
  "1") ;;
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
    echo ""; echo "  Abbruch."; exit 0 ;;
esac

# Defaults
[[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
[[ -z "$CT_PASSWORD" ]] && CT_PASSWORD=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16 2>/dev/null || echo "netviren$(date +%s)")

# ═══════════════════════════════════════════════════════════
clear
echo ""
echo " ╔═══════════════════════════════════════════════╗"
echo " ║       🛡️  NetViren - Installation läuft       ║"
echo " ╚═══════════════════════════════════════════════╝"
echo ""

# ───── 1. TEMPLATE ─────
step "Suche Debian 12 Template..."

while IFS= read -r ST; do
  [[ -z "$ST" ]] && continue
  TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian" | awk '{print $1}' | head -1)
  [[ -n "$TEMPLATE_PATH" ]] && break
done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')

if [[ -z "$TEMPLATE_PATH" ]]; then
  command -v timeout &>/dev/null && timeout 20 pveam update &>/dev/null || true

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

  SELECTED=$(whiptail --title " Template Auswahl " --radiolist "Wähle ein Template:" 20 70 10 "${RADIOLIST[@]}" 3>&1 1>&2 2>&3)
  [[ -z "$SELECTED" ]] && { echo "  ✗ Abgebrochen."; exit 1; }

  step "Lade ${SELECTED}..."
  pveam download "local" "$SELECTED" 2>&1 | while IFS= read -r line; do echo "     $line"; done
  [[ ${PIPESTATUS[0]} -ne 0 ]] && { echo "  ✗ Download fehlgeschlagen."; exit 1; }

  sleep 2
  while IFS= read -r ST; do
    [[ -z "$ST" ]] && continue
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep "$(echo "$SELECTED" | sed 's/\.tar\.zst//')" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}')
  [[ -z "$TEMPLATE_PATH" ]] && TEMPLATE_PATH="local:vztmpl/${SELECTED}"
fi

ok "Template gefunden"

# ───── 2. STORAGE ─────
CT_STORAGE=$(pvesm status 2>/dev/null | grep -i "active" | awk '{print $1}' | head -1)
[[ -z "$CT_STORAGE" ]] && CT_STORAGE="local"

# ───── 3. CONTAINER ─────
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

# Auf Container warten (poll statt sleep)
step "Warte auf Container..."
for i in $(seq 1 30); do
  pct status "$CT_ID" 2>/dev/null | grep -q "running" && break
  sleep 1
done

# ───── 4. NETVIREN ─────
echo ""

# apt-output ins Log statt /dev/null
pct exec "$CT_ID" -- bash -c '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq 2>&1 | tail -2
  apt-get install -y -qq curl git openssl locales 2>&1 | tail -3
  bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh) </dev/null
' >"$LOG" 2>&1 &
INSTALL_PID=$!

spinner "$INSTALL_PID" "Installiere NetViren im Container..."
INSTALL_OK=$?

if [[ $INSTALL_OK -eq 0 ]]; then
  ok "NetViren installiert"
else
  warn "Installation fehlgeschlagen — tail -50 $LOG"
fi

# ───── 5. LOGIN-DATEI ─────
CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')
# Login-Datei aus Container auf Proxmox Host kopieren
pct exec "$CT_ID" -- cat /etc/netviren/login.txt 2>/dev/null > /etc/netviren-login-container-${CT_ID}.txt 2>/dev/null || true
chmod 600 /etc/netviren-login-container-${CT_ID}.txt 2>/dev/null || true
step "Login: /etc/netviren-login-container-${CT_ID}.txt"

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
