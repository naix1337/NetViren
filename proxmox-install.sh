#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# NetViren - Proxmox VE Installer
# ═══════════════════════════════════════════════════════════
# Führt auf einem Proxmox VE Host aus:
#   1. Erstellt einen LXC Container (Debian/Ubuntu)
#   2. Installiert NetViren darin automatisch
#   3. Startet alle Services
# ═══════════════════════════════════════════════════════════
# Quelle: https://github.com/naix1337/networkvirusscanner
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ───── Farben ─────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
R="/dev/null"

# ───── Konfiguration ─────
GIT_REPO="https://github.com/naix1337/networkvirusscanner.git"
INSTALL_SCRIPT="install.sh"
STORAGE="local-lvm"
NET_BRIDGE="vmbr0"
CT_ID=""
CT_HOSTNAME="netviren"
CT_DISK="8"
CT_CORES="2"
CT_RAM="2048"
CT_IP="dhcp"
CT_TEMPLATE="debian-12"
CT_PASSWORD=""

# ───── Prüfung: Läuft das auf einem Proxmox Host? ─────
check_proxmox() {
  if ! command -v pct &>/dev/null || ! command -v pvesm &>/dev/null; then
    echo -e "${RED}Fehler: Dieses Script muss auf einem Proxmox VE Host ausgeführt werden.${NC}"
    echo -e "${YELLOW}pct oder pvesm nicht gefunden.${NC}"
    exit 1
  fi
}

# ───── Container-Template holen ─────
get_template() {
  local TEMPLATE_PATH=""

  # Template in allen verfügbaren Storages suchen
  for ST in $(pvesm types 2>/dev/null | grep -i content | head -5 || echo "local"); do
    TEMPLATE_PATH=$(pvesm list "$ST" 2>/dev/null | grep -i "debian.*12.*standard" | awk '{print $1}' | head -1)
    [[ -n "$TEMPLATE_PATH" ]] && break
  done

  # Kein Template gefunden → herunterladen
  if [[ -z "$TEMPLATE_PATH" ]]; then
    echo -e "${CYAN}▶ Suche neuestes Debian 12 Template...${NC}" >&2
    pveam update 2>/dev/null || true

    local AVAIL_TEMPLATE
    AVAIL_TEMPLATE=$(pveam available 2>/dev/null | grep -i "debian-12-standard" | awk '{print $2}' | sort -V | tail -1)

    if [[ -z "$AVAIL_TEMPLATE" ]]; then
      echo -e "${RED}✗ Kein Debian 12 Template in pveam verfügbar!${NC}" >&2
      pveam available 2>/dev/null | grep debian | awk '{print "  " $2}' | head -10 >&2
      echo ""
      return
    fi

    # Download in local (oder ersten passenden Storage)
    local DL_STORAGE="local"
    pvesm list "$DL_STORAGE" &>/dev/null || DL_STORAGE=$(pvesm status 2>/dev/null | head -1 | awk '{print $1}')

    echo -e "${CYAN}▶ Lade ${AVAIL_TEMPLATE} nach ${DL_STORAGE}...${NC}" >&2
    pveam download "$DL_STORAGE" "$AVAIL_TEMPLATE" >&2

    TEMPLATE_PATH=$(pvesm list "$DL_STORAGE" 2>/dev/null | grep -i "debian.*12.*standard" | awk '{print $1}' | head -1)
  fi

  if [[ -z "$TEMPLATE_PATH" ]]; then
    echo -e "${RED}✗ Template nicht gefunden nach Download!${NC}" >&2
    echo ""
    return
  fi

  echo "$TEMPLATE_PATH"
}

# ───── Container erstellen ─────
create_container() {
  local TEMPLATE_PATH="$1"

  echo -e "${CYAN}▶ Erstelle LXC Container ${CT_ID} (${CT_HOSTNAME})...${NC}"

  # Prüfen ob ID schon existiert
  if pct list 2>/dev/null | grep -q "^$CT_ID "; then
    echo -e "${RED}Container-ID $CT_ID existiert bereits!${NC}"
    exit 1
  fi

  pct create "$CT_ID" "$TEMPLATE_PATH" \
    --hostname "$CT_HOSTNAME" \
    --storage "$STORAGE" \
    --rootfs "$STORAGE:$CT_DISK" \
    --cores "$CT_CORES" \
    --memory "$CT_RAM" \
    --net0 name=eth0,bridge="$NET_BRIDGE",ip="$CT_IP" \
    --unprivileged 1 \
    --features nesting=1 \
    --password "$CT_PASSWORD" \
    --start 1

  echo -e "${GREEN}✓ Container $CT_ID erstellt${NC}"

  # Warten bis Container läuft
  sleep 5

  # Prüfen ob Container läuft
  if ! pct status "$CT_ID" 2>/dev/null | grep -q "running"; then
    pct start "$CT_ID" 2>/dev/null || true
    sleep 3
  fi
}

# ───── NetViren im Container installieren ─────
install_netviren() {
  echo -e "${CYAN}▶ Installiere NetViren in Container ${CT_ID}...${NC}"

  # Dependencies im Container
  pct exec "$CT_ID" -- bash -c "apt-get update -qq && apt-get install -y -qq curl git openssl" 2>&1 | tail -1

  # NetViren install-script runterladen und ausführen
  echo -e "${CYAN}▶ Führe NetViren Install-Script aus...${NC}"
  pct exec "$CT_ID" -- bash -c "
    bash <(curl -sSL https://github.com/naix1337/networkvirusscanner/raw/master/install.sh)
  " 2>&1 | while IFS= read -r line; do echo "  ${line}"; done

  echo -e "${GREEN}✓ Installation in Container ${CT_ID} abgeschlossen${NC}"
}

# ───── Info anzeigen ─────
show_info() {
  local CT_IP_ADDR=""
  if [[ "$CT_IP" == "dhcp" ]]; then
    CT_IP_ADDR=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')
  else
    CT_IP_ADDR=$(echo "$CT_IP" | cut -d/ -f1)
  fi

  echo ""
  echo -e "${GREEN}════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  NetViren installiert!${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${CYAN}Container:${NC}  ${CT_ID} (${CT_HOSTNAME})"
  echo -e "  ${CYAN}Zugriff:${NC}    pct enter ${CT_ID}"
  echo ""
  if [[ -n "$CT_IP_ADDR" ]]; then
    echo -e "  ${CYAN}Dashboard:${NC}  http://${CT_IP_ADDR}:3001"
    echo -e "  ${CYAN}API:${NC}        http://${CT_IP_ADDR}:4000"
  fi
  echo ""
  echo -e "  ${YELLOW}Login-Daten wurden während der Installation vergeben.${NC}"
  echo ""
}

# ───── Menü ─────
show_menu() {
  clear
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║     🛡️  NetViren - Proxmox Installer        ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Netzwerk-Sicherheits-Plattform${NC}"
  echo -e "  Installiert NetViren in einem neuen LXC Container"
  echo ""
  echo -e "  ${YELLOW}Schritte:${NC}"
  echo -e "  1. LXC Container wird erstellt"
  echo -e "  2. Node.js + Python + Nmap werden installiert"
  echo -e "  3. NetViren API + Frontend + Scanner werden eingerichtet"
  echo -e "  4. Dashboards sind via Browser erreichbar"
  echo ""
  echo -e "${CYAN}────────────────────────────────────────────${NC}"
  echo -e "${BOLD}  Konfiguration:${NC}"
  echo -e "  ${CYAN}1${NC}) Container-ID:       ${CT_ID:-"wird automatisch gewählt"}"
  echo -e "  ${CYAN}2${NC}) Hostname:           ${CT_HOSTNAME}"
  echo -e "  ${CYAN}3${NC}) RAM (MB):           ${CT_RAM}"
  echo -e "  ${CYAN}4${NC}) CPU Cores:          ${CT_CORES}"
  echo -e "  ${CYAN}5${NC}) Disk (GB):          ${CT_DISK}"
  echo -e "  ${CYAN}6${NC}) Storage:            ${STORAGE}"
  echo -e "  ${CYAN}7${NC}) Netzwerk-Bridge:    ${NET_BRIDGE}"
  echo -e "  ${CYAN}8${NC}) IP (dhcp oder statisch): ${CT_IP}"
  echo -e "  ${CYAN}9${NC}) Root-Passwort:      ${CT_PASSWORD:+"********"}"${CT_PASSWORD:-"(wird generiert)"}
  echo ""
  echo -e "${CYAN}────────────────────────────────────────${NC}"
  echo -e "  ${GREEN}I${NC}) 🚀  Installation starten"
  echo -e "  ${RED}Q${NC}) Beenden"
  echo ""
}

# ───── Hauptprogramm ─────
main() {
  check_proxmox

  while true; do
    show_menu
    read -p "  Auswahl: " choice
    case "$choice" in
      1)
        read -p "  Container-ID (leer = nächstmögliche): " CT_ID
        if [[ -z "$CT_ID" ]]; then
          CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
        fi
        ;;
      2) read -p "  Hostname [${CT_HOSTNAME}]: " input; CT_HOSTNAME=${input:-$CT_HOSTNAME} ;;
      3) read -p "  RAM in MB [${CT_RAM}]: " input; CT_RAM=${input:-$CT_RAM} ;;
      4) read -p  "  CPU Cores [${CT_CORES}]: " input; CT_CORES=${input:-$CT_CORES} ;;
      5) read -p "  Disk in GB [${CT_DISK}]: " input; CT_DISK=${input:-$CT_DISK} ;;
      6) read -p "  Proxmox Storage [${STORAGE}]: " input; STORAGE=${input:-$STORAGE} ;;
      7) read -p "  Netzwerk-Bridge [${NET_BRIDGE}]: " input; NET_BRIDGE=${input:-$NET_BRIDGE} ;;
      8) read -p "  IP (dhcp oder 192.168.1.100/24) [${CT_IP}]: " input; CT_IP=${input:-$CT_IP} ;;
      9) read -s -p "  Root-Passwort für Container: " CT_PASSWORD; echo "" ;;
      i|I)
        if [[ -z "$CT_ID" ]]; then
          CT_ID=$(pvesh get /cluster/nextid 2>/dev/null || echo "100")
        fi
        if [[ -z "$CT_PASSWORD" ]]; then
          CT_PASSWORD=$(openssl rand -base64 12)
          echo -e "${YELLOW}  Root-Passwort für Container: ${CT_PASSWORD}${NC}"
        fi
        echo ""
        TEMPLATE_PATH=$(get_template)
        if [[ -z "$TEMPLATE_PATH" ]]; then
          echo -e "${RED}✗ Konnte kein Debian 12 Template finden.${NC}"
          echo -e "${YELLOW}  Manuell herunterladen: pveam download local debian-12-standard_12.7-1_amd64.tar.zst${NC}"
          exit 1
        fi
        create_container "$TEMPLATE_PATH"
        install_netviren
        show_info
        exit 0
        ;;
      q|Q) echo -e "${YELLOW}Abbruch.${NC}"; exit 0 ;;
      *) echo -e "${RED}Ungültige Auswahl${NC}"; sleep 1 ;;
    esac
  done
}

main "$@"
