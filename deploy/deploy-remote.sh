#!/usr/bin/env bash
# Remote server deployment script for apex-dispatch.
# Runs as root on the target server.
set -Eeuo pipefail
umask 027

ENV_FILE="${1:-/root/deploy-apex-dispatch/app.env}"
[[ -f "$ENV_FILE" ]] || { echo "Missing env file: $ENV_FILE" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

BOLD=$'\033[1m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; DIM=$'\033[2m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'
log() { printf '\n[%s] %s%s%s\n' "$(date +'%H:%M:%S')" "$BOLD" "$*" "$RESET"; }
ok()  { printf '  %s✔ %s%s\n' "$GREEN" "$*" "$RESET"; }
die() { printf '\n%s✘ ERROR: %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this deployment script as root."

SITE_DIR="/home/$SITE_USER/htdocs/$DOMAIN"
[[ -d "$SITE_DIR" ]] || die "Site directory $SITE_DIR does not exist. Run with --bootstrap first."

log "1. Synchronizing codebase into $SITE_DIR"
# If Git repo is provided and .git exists, pull branch. Otherwise clone or use synced files.
if [[ -n "${GIT_REPO:-}" ]]; then
  if [[ ! -d "$SITE_DIR/.git" ]]; then
    log "Cloning repository $GIT_REPO..."
    sudo -u "$SITE_USER" git clone "$GIT_REPO" "$SITE_DIR"
  else
    log "Fetching latest commit from ${GIT_BRANCH:-main}..."
    cd "$SITE_DIR"
    sudo -u "$SITE_USER" git fetch --all -q
    sudo -u "$SITE_USER" git reset --hard "origin/${GIT_BRANCH:-main}" -q
  fi
fi

# Ensure persistent data directories exist and are never removed
mkdir -p "$SITE_DIR/data/uploads"
chown -R "$SITE_USER":"$SITE_USER" "$SITE_DIR/data"

log "2. Writing isolated production .env file"
cat << ENV_EOF > "$SITE_DIR/.env"
VAULT_PIN=${VAULT_PIN:-secret123}
ADMIN_RESET_TOKEN=${ADMIN_RESET_TOKEN:-unlock123}
TRIGGER_WORD=${TRIGGER_WORD:-guarantee}
PORT=${PORT:-3000}
AUTO_LOCK_MINUTES=${AUTO_LOCK_MINUTES:-5}
SLIDESHOW_INTERVAL=${SLIDESHOW_INTERVAL:-3}
NODE_ENV=production
ENV_EOF
chmod 600 "$SITE_DIR/.env"
chown "$SITE_USER":"$SITE_USER" "$SITE_DIR/.env"
ok "Production .env file configured"

log "3. Installing dependencies and compiling frontend"
cd "$SITE_DIR"
sudo -H -u "$SITE_USER" npm install --no-audit --no-fund
sudo -H -u "$SITE_USER" npm run build
ok "Frontend assets built into dist/"

log "4. Starting / reloading PM2 process ($PROJECT_NAME)"
sudo -H -u "$SITE_USER" pm2 startOrReload ecosystem.config.cjs --update-env
sudo -H -u "$SITE_USER" pm2 save >/dev/null 2>&1 || true
ok "PM2 process reloaded"

log "5. Performing application health verification"
sleep 2
health_check=0
for i in {1..5}; do
  if curl -s -f "http://127.0.0.1:$PORT/api/auth/status" >/dev/null 2>&1; then
    health_check=1
    break
  fi
  sleep 1
done

if [[ $health_check -eq 1 ]]; then
  ok "Health check passed on port $PORT"
else
  die "Health check failed on http://127.0.0.1:$PORT"
fi

printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$GREEN" "$RESET"
printf '%s  ✔ Deploy Complete: %s%s\n' "$GREEN" "https://$DOMAIN" "$RESET"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n\n' "$GREEN" "$RESET"
