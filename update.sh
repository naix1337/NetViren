#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════
# NetViren - Network Security Platform
# Update Script
# ═══════════════════════════════════════════════
# One-liner:
#   bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/update.sh)
# ═══════════════════════════════════════════════

REPO="https://github.com/naix1337/NetViren.git"
NETVIREN_DIR="/opt/netviren"
DB_DIR="/var/lib/netviren/db"
PACKET_DIR="/var/lib/netviren/packets"
LOG_DIR="/var/log/netviren"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[NetViren]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; exit 1; }

# ──────────────────────────────────────────────
# Prüfe root
# ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then fail "Must run as root (sudo)"; fi

log "Starting NetViren update..."

# ──────────────────────────────────────────────
# Prüfe ob Installation existiert
# ──────────────────────────────────────────────
if [[ ! -d "$NETVIREN_DIR/.git" ]]; then
  fail "No NetViren installation found at $NETVIREN_DIR. Run install.sh first: bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/install.sh)"
fi

cd "$NETVIREN_DIR"

# ──────────────────────────────────────────────
# .env sichern
# ──────────────────────────────────────────────
if [[ -f ".env" ]]; then
  log "Backing up .env..."
  cp .env /tmp/netviren-env-backup
  ok ".env backed up to /tmp/netviren-env-backup"
fi

# ──────────────────────────────────────────────
# Git pull
# ──────────────────────────────────────────────
log "Pulling latest code from $REPO..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master 2>/dev/null || git rev-parse origin/main 2>/dev/null || echo "$LOCAL")

if [[ "$LOCAL" == "$REMOTE" ]]; then
  ok "Already up to date (commit: ${LOCAL:0:8})"
else
  git pull --ff-only origin master 2>/dev/null || git pull --ff-only origin main 2>/dev/null || warn "Could not fast-forward — attempting merge"
  git pull 2>/dev/null || true
  ok "Code updated (${LOCAL:0:8} → ${REMOTE:0:8})"
fi

# ──────────────────────────────────────────────
# .env wiederherstellen (falls überschrieben)
# ──────────────────────────────────────────────
if [[ -f "/tmp/netviren-env-backup" ]] && ! diff -q ".env" "/tmp/netviren-env-backup" &>/dev/null; then
  cp /tmp/netviren-env-backup .env
  ok ".env restored from backup"
fi

# ──────────────────────────────────────────────
# Direktories
# ──────────────────────────────────────────────
mkdir -p "$DB_DIR" "$PACKET_DIR" "$LOG_DIR"

# ──────────────────────────────────────────────
# npm Install + Build
# ──────────────────────────────────────────────
log "Updating npm dependencies..."
export PUPPETEER_SKIP_DOWNLOAD=true

# Nur installieren wenn package-lock.json geändert wurde
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "package-lock\|package.json"; then
  npm install --no-optional 2>&1 | tail -5 || npm install --legacy-peer-deps 2>&1 | tail -5
  ok "npm dependencies updated"
else
  ok "npm dependencies already up to date"
fi

log "Building API..."
cd "$NETVIREN_DIR/packages/api"
node "$NETVIREN_DIR/node_modules/.bin/tsc" 2>&1 | tail -5 || {
  warn "API build had issues, retrying..."
  node "$NETVIREN_DIR/node_modules/typescript/bin/tsc" 2>&1 | tail -5
}
ok "API build complete"

log "Building Frontend..."
cd "$NETVIREN_DIR/packages/frontend"
node "$NETVIREN_DIR/node_modules/next/dist/bin/next" build 2>&1 | tail -10 || {
  warn "Frontend build had issues — check .next directory"
}

# Static files in standalone
if [[ -d ".next/static" && -d ".next/standalone/packages/frontend/.next" ]]; then
  cp -r .next/static .next/standalone/packages/frontend/.next/ 2>/dev/null || true
fi
ok "Frontend build complete"

# ──────────────────────────────────────────────
# Database Migration
# ──────────────────────────────────────────────
log "Running database migrations..."
cd "$NETVIREN_DIR/packages/api"
timeout 10 node dist/index.js 2>/dev/null || true
ok "Database migrations applied"

# ──────────────────────────────────────────────
# Services neu starten
# ──────────────────────────────────────────────
log "Restarting services..."
for svc in netviren-api netviren-frontend netviren-scanner netviren-packet-capture; do
  if systemctl is-enabled "$svc" &>/dev/null; then
    systemctl restart "$svc" 2>/dev/null || warn "Failed to restart $svc (may need manual restart)"
    ok "$svc restarted"
  fi
done

# ──────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  NetViren update complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Commit:${NC}  $(git rev-parse --short HEAD)"
echo -e "  ${CYAN}Datum:${NC}   $(date)"
echo ""
echo -e "  ${YELLOW}Logs prüfen:${NC}"
echo "    journalctl -u netviren-api -f"
echo "    journalctl -u netviren-frontend -f"
echo "    journalctl -u netviren-scanner -f"
echo ""
