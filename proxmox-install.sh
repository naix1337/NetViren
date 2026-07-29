#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# NetViren - Proxmox VE Installer
# https://github.com/naix1337/networkvirusscanner
# ═══════════════════════════════════════════════════════════

set -o pipefail

# ───── Farben ─────
RD="\033[01;31m"; GR="\033[01;32m"; YW="\033[01;33m"; BL="\033[01;34m"; CY="\033[01;36m"; NC="\033[0m"

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

# ───── Ausgabe ─────
step() { echo -e "${CY}  ▪ ${1}${NC}"; }
ok()   { echo -e "${GR}  ✓ ${1}${NC}"; }
warn() { echo -e "${YW}  ⚠ ${1}${NC}"; }
fail() { echo -e "${RD}  ✗ ${1}${NC}"; exit 1; }

# ───── Sichere Übergabe: stdin kommt von Pipe → /dev/tty für Eingabe ─────
if [[ ! -t 0 ]]; then
  STDIN="</dev/tty"
else
  STDIN=""
fi

# ───── Prüfung ─────
if ! command -v pct &>/dev/null; then
  fail "Dieses Script muss auf einem Proxmox VE Host ausgeführt werden"
fi

# ═══════════════════════════════════════════════════════════
header

echo -e "${YW}  Wähle Installationsmodus:${NC}"
echo ""
echo -e "  ${GR}1)${NC} Standard  — 8GB Disk, 2 Cores, 2GB RAM, DHCP"
echo -e "  ${GR}2)${NC} Advanced  — Eigene Einstellungen"
echo ""

while true; do
  eval "read -p \"  Auswahl (1/2): \" choice $STDIN"
  case "$choice" in
    1) CT_DISK="8"; CT_CORES="2"; CT_RAM="2048"; CT_IP="dhcp"; break ;;
    2) break ;;
    *) echo -e "${RD}  Ungültig${NC}" ;;
  esac
done

if [[ "$choice" == "2" ]]; then
  echo ""
  CT_ID="" CT_HOSTNAME="netviren" CT_RAM="2048" CT_CORES="2" CT_DISK="8" CT_IP="dhcp" CT_PASSWORD=""
  eval "read -p \"  Container-ID (Enter = automatisch): \" CT_ID $STDIN"
  [[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
  eval "read -p \"  Hostname [\$CT_HOSTNAME]: \" input $STDIN"; CT_HOSTNAME=${input:-$CT_HOSTNAME}
  eval "read -p \"  RAM in MB [\$CT_RAM]: \" input $STDIN"; CT_RAM=${input:-$CT_RAM}
  eval "read -p \"  CPU Cores [\$CT_CORES]: \" input $STDIN"; CT_CORES=${input:-$CT_CORES}
  eval "read -p \"  Disk in GB [\$CT_DISK]: \" input $STDIN"; CT_DISK=${input:-$CT_DISK}
  eval "read -p \"  IP (dhcp oder 192.168.1.100/24) [\$CT_IP]: \" input $STDIN"; CT_IP=${input:-$CT_IP}
  eval "read -s -p \"  Root-Passwort (Enter = generieren): \" CT_PASSWORD $STDIN"; echo ""
fi

# Defaults
[[ -z "$CT_ID" ]] && CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
[[ -z "$CT_PASSWORD" ]] && CT_PASSWORD=$(openssl rand -base64 12)

header
echo -e "${GR}  Container $CT_ID ($CT_HOSTNAME)"
echo -e "  ${CT_RAM}MB RAM / ${CT_CORES} Cores / ${CT_DISK}GB / IP: ${CT_IP}${NC}"
echo ""

# ───── 1. Template ─────
step "Suche Debian 12 Template..."
TEMPLATE_PATH=""

# Nach vorhandenen Templates in allen Storages suchen
while read -r ST; do
  [[ -z "$ST" ]] && continue
  TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian" | awk '{print $1}' | head -1)
  [[ -n "$TEMPLATE_PATH" ]] && break
done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}' || echo "")

# Falls keins gefunden: herunterladen
if [[ -z "$TEMPLATE_PATH" ]]; then
  echo ""
  warn "Kein Debian Template lokal gefunden."
  step "Suche in verfügbaren Templates..."

  # pveam update mit Timeout
  if command -v timeout &>/dev/null; then
    timeout 30 pveam update &>/dev/null || true
  fi

  # Template-Liste anzeigen
  echo ""
  echo -e "${CY}Verfügbare Templates:${NC}"
  pveam available 2>/dev/null | grep -iE "debian|ubuntu" | awk '{print "  " $2}' | head -15 || echo "  (keine gefunden)"
  echo ""

  # Template-Name vom User
  eval "read -p \"  Template-Name eingeben (Enter = abbrechen): \" AVAIL_TEMPLATE $STDIN"
  if [[ -z "$AVAIL_TEMPLATE" ]]; then
    fail "Abbruch. Manuell: pveam download local debian-12-standard_12.7-1_amd64.tar.zst"
  fi

  step "Lade ${AVAIL_TEMPLATE} herunter..."
  pveam download "local" "$AVAIL_TEMPLATE" 2>&1 | tail -3 || \
    fail "Download fehlgeschlagen (pveam download local $AVAIL_TEMPLATE)"
  sleep 2

  # Nach dem Download suchen
  while read -r ST; do
    [[ -z "$ST" ]] && continue
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep "$(echo "$AVAIL_TEMPLATE" | sed 's/\.tar\.zst//')" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done < <(pvesm status 2>/dev/null | awk 'NR>1{print $1}' || echo "")

  # Fallback
  [[ -z "$TEMPLATE_PATH" ]] && TEMPLATE_PATH="local:vztmpl/${AVAIL_TEMPLATE}"
fi

ok "Template: $(basename "$TEMPLATE_PATH" 2>/dev/null || echo "$TEMPLATE_PATH")"

# ───── 2. Container ─────
step "Erstelle Container $CT_ID..."

# Storage für den Container ermitteln
CT_STORAGE="local"
CT_STORAGE=$(pvesm status 2>/dev/null | grep -i "active" | awk '{print $1}' | head -1)
[[ -z "$CT_STORAGE" ]] && CT_STORAGE="local"

if ! pct create "$CT_ID" "$TEMPLATE_PATH" \
  --hostname "$CT_HOSTNAME" \
  --storage "$CT_STORAGE" \
  --rootfs "${CT_STORAGE}:${CT_DISK}" \
  --cores "$CT_CORES" --memory "$CT_RAM" \
  --net0 name=eth0,bridge=vmbr0,ip="$CT_IP" \
  --unprivileged 1 --features nesting=1 \
  --password "$CT_PASSWORD" --start 1 2>&1; then
  fail "Container-Erstellung fehlgeschlagen"
fi
ok "Container $CT_ID erstellt"

sleep 3

# ───── 3. NetViren ─────
step "Installiere NetViren im Container (ca. 5-10 Min)..."
step "Dies kann eine Weile dauern — keine Eingabe nötig"

if pct exec "$CT_ID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive LANG=C
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq curl git openssl >/dev/null 2>&1
  bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh) </dev/null
" 2>&1; then
  ok "NetViren installiert"
else
  warn "Installation hatte Warnungen (pct enter $CT_ID zum Prüfen)"
fi

# ───── 4. Info ─────
CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}' || echo "")

echo ""
echo -e "${GR}  ✅  NetViren installiert!${NC}"
echo ""
echo -e "  ${CY}Container:${NC}  $CT_ID ($CT_HOSTNAME)"
echo -e "  ${CY}Zugriff:${NC}    pct enter $CT_ID"
[[ -n "$CT_IP_ADDR" ]] && echo -e "  ${CY}Dashboard:${NC}  http://${CT_IP_ADDR}:3001"
echo -e "  ${CY}Passwort:${NC}   $CT_PASSWORD"
echo ""
