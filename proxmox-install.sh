#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# NetViren - Proxmox VE Installer
# https://github.com/naix1337/networkvirusscanner
# ═══════════════════════════════════════════════════════════

set -eo pipefail

# ───── Farben ─────
RD="\033[01;31m"; GR="\033[01;32m"; YW="\033[01;33m"; BL="\033[01;34m"; CY="\033[01;36m"; NC="\033[0m"
R=/dev/null

# ───── Header ─────
header() {
  clear
  cat <<"EOF"
   ╔═══════════════════════════════════════════════╗
   ║        🛡️  NetViren - LXC Installer           ║
   ║   Network Security Platform                   ║
   ╚═══════════════════════════════════════════════╝
EOF
  echo ""
}

# ───── Fragen ─────
ask() {
  echo -e "${BL}────────────────────────────────────────────${NC}"
  echo -e "${GR}  $1${NC}"
  echo -e "${BL}────────────────────────────────────────────${NC}"
}

# ───── Auswahl ─────
choose() {
  local choice
  read -p "  Auswahl (1/2): " choice </dev/tty
  case "$choice" in
    1) return 0 ;;
    2) return 1 ;;
    *) echo -e "${RD}  Ungültig${NC}"; choose
  esac
}

# ───── Schritt ─────
step() {
  echo -e "${CY}  ▪ ${1}${NC}"
}

ok() {
  echo -e "${GR}  ✓ ${1}${NC}"
}

warn() {
  echo -e "${YW}  ⚠ ${1}${NC}"
}

fail() {
  echo -e "${RD}  ✗ ${1}${NC}"
  exit 1
}

# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

header

# Prüfung
if ! command -v pct &>/dev/null; then
  fail "Dieses Script muss auf einem Proxmox VE Host ausgeführt werden"
fi

# Modus
echo -e "${YW}  Wähle Installationsmodus:${NC}"
echo ""
echo -e "  ${GR}1)${NC} Standard  — 8GB Disk, 2 Cores, 2GB RAM, DHCP"
echo -e "  ${GR}2)${NC} Advanced  — Eigene Einstellungen"
echo ""
if choose 2>/dev/null; then
  CT_DISK="8"; CT_CORES="2"; CT_RAM="2048"; CT_IP="dhcp"
else
  ask "Container-Konfiguration"
  CT_ID=""; CT_HOSTNAME="netviren"; CT_RAM="2048"; CT_CORES="2"; CT_DISK="8"; CT_IP="dhcp"; CT_PASSWORD=""
  read -p "  Container-ID (Enter = automatisch): " CT_ID </dev/tty
  [[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
  read -p "  Hostname [${CT_HOSTNAME}]: " input </dev/tty; CT_HOSTNAME=${input:-$CT_HOSTNAME}
  read -p "  RAM in MB [${CT_RAM}]: " input </dev/tty; CT_RAM=${input:-$CT_RAM}
  read -p "  CPU Cores [${CT_CORES}]: " input </dev/tty; CT_CORES=${input:-$CT_CORES}
  read -p "  Disk in GB [${CT_DISK}]: " input </dev/tty; CT_DISK=${input:-$CT_DISK}
  read -p "  IP (dhcp oder 192.168.1.100/24) [${CT_IP}]: " input </dev/tty; CT_IP=${input:-$CT_IP}
  read -s -p "  Root-Passwort (Enter = generieren): " CT_PASSWORD </dev/tty; echo ""
fi

# Zusammenfassung
[[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
[[ -z "$CT_PASSWORD" ]] && CT_PASSWORD=$(openssl rand -base64 12)

header
ask "Installation starten?"
echo -e "  ${CY}Container:${NC}  $CT_ID ($CT_HOSTNAME)"
echo -e "  ${CY}Ressourcen:${NC} ${CT_RAM}MB RAM / ${CT_CORES} Cores / ${CT_DISK}GB"
echo -e "  ${CY}Netzwerk:${NC}   ${CT_IP}"
echo -e "  ${CY}Passwort:${NC}   ${CT_PASSWORD}"
echo ""
echo -e "${RD}  Installation läuft — Log: /tmp/netviren-install.log${NC}"
echo ""

# ───── 1. Template ─────
step "Suche Debian 12 Template..."
TEMPLATE_PATH=""

# In allen vorhandenen Storages suchen
for ST in $(pvesm status 2>/dev/null | tail -n +2 | awk '{print $1}'); do
  TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian" | awk '{print $1}' | head -1)
  [[ -n "$TEMPLATE_PATH" ]] && break
done

if [[ -z "$TEMPLATE_PATH" ]]; then
  echo ""
  warn "Kein Debian Template lokal gefunden."
  step "Aktualisiere Template-Liste (max 30s)..."
  command -v timeout &>/dev/null && timeout 30 pveam update 2>&1 | tail -3 || true
  echo ""

  # Verfügbare Templates anzeigen
  echo -e "${CY}Verfügbare Debian/Ubuntu Templates:${NC}"
  pveam available 2>/dev/null | grep -i "debian\|ubuntu" | awk '{print "  " $2}' | head -15
  echo ""
  read -p "  Template-Name aus obiger Liste eingeben (Enter = abbrechen): " AVAIL_TEMPLATE </dev/tty

  if [[ -z "$AVAIL_TEMPLATE" ]]; then
    fail "Abbruch. Manuell: pveam download local debian-12-standard_12.7-1_amd64.tar.zst"
  fi

  step "Lade ${AVAIL_TEMPLATE}..."
  # Download-Storage finden
  DL_STORAGE="local"
  pvesm list "$DL_STORAGE" &>/dev/null || DL_STORAGE=$(pvesm status 2>/dev/null | tail -n +2 | head -1 | awk '{print $1}')
  echo "  Download in Storage: $DL_STORAGE"

  pveam download "$DL_STORAGE" "$AVAIL_TEMPLATE" 2>&1 | tail -3 || \
    fail "Download fehlgeschlagen"

  # Template in allen Storages suchen
  sleep 2
  for ST in $(pvesm status 2>/dev/null | tail -n +2 | awk '{print $1}'); do
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep "$(echo $AVAIL_TEMPLATE | sed 's/\.tar\.zst//')" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done
  if [[ -z "$TEMPLATE_PATH" ]]; then
    # Fallback: einfach den Download-Pfad nehmen
    TEMPLATE_PATH="${DL_STORAGE}:vztmpl/${AVAIL_TEMPLATE}"
  fi
fi
ok "Template: $(basename $TEMPLATE_PATH)"

# ───── 2. Container ─────
step "Erstelle Container $CT_ID..."
LOG=""
# Storage ermitteln (ersten aktiven Storage nehmen, der nicht "dir" ist)
CT_STORAGE="local-lvm"
pvesm status 2>/dev/null | grep -i "active" | grep -v "dir" | head -1 | awk '{print $1}' || CT_STORAGE="local"
CT_STORAGE=$(pvesm status 2>/dev/null | grep -i "active" | grep -v "dir" | head -1 | awk '{print $1}')
[[ -n "$CT_STORAGE" ]] || CT_STORAGE="local"

if pct create "$CT_ID" "$TEMPLATE_PATH" \
  --hostname "$CT_HOSTNAME" \
  --storage "$CT_STORAGE" \
  --rootfs "${CT_STORAGE}:${CT_DISK}" \
  --cores "$CT_CORES" --memory "$CT_RAM" \
  --net0 name=eth0,bridge=vmbr0,ip="$CT_IP" \
  --unprivileged 1 --features nesting=1 \
  --password "$CT_PASSWORD" --start 1 &>/tmp/netviren-install.log; then
  ok "Container $CT_ID erstellt"
else
  fail "Container-Erstellung fehlgeschlagen (siehe Log)"
fi

sleep 5
pct start "$CT_ID" &>/dev/null || true

# ───── 3. NetViren ─────
step "Installiere NetViren im Container (ca. 5-10 Min)..."
pct exec "$CT_ID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive LANG=en_US.UTF-8
  apt-get update -qq && apt-get install -y -qq curl git openssl locales 2>/dev/null
  locale-gen en_US.UTF-8 2>/dev/null
  bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh)
" &>/tmp/netviren-install.log && ok "NetViren installiert" || warn "Installation hatte Warnungen (siehe Log)"

# ───── 4. Info ─────
CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')

header
echo -e "${GR}  ✅  NetViren installiert!${NC}"
echo ""
echo -e "  ${CY}Container:${NC}  $CT_ID ($CT_HOSTNAME)"
echo -e "  ${CY}Zugriff:${NC}    pct enter $CT_ID"
[[ -n "$CT_IP_ADDR" ]] && echo -e "  ${CY}Dashboard:${NC}  http://${CT_IP_ADDR}:3001"
echo -e "  ${CY}Passwort:${NC}   $CT_PASSWORD"
echo ""
echo -e "  ${YW}  Log:  tail -f /tmp/netviren-install.log${NC}"
echo ""
