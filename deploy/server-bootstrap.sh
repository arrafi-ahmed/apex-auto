#!/usr/bin/env bash
# One-time server preparation for apex-auto.
# Idempotent: safe to run multiple times.
set -Eeuo pipefail
umask 027

ENV_FILE="${1:-/root/deploy-apex-auto/app.env}"
[[ -f "$ENV_FILE" ]] || { echo "Missing env file: $ENV_FILE" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

BOLD=$'\033[1m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; DIM=$'\033[2m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'
log() { printf '\n[%s] %s%s%s\n' "$(date +'%H:%M:%S')" "$BOLD" "$*" "$RESET"; }
ok()  { printf '  %s✔ %s%s\n' "$GREEN" "$*" "$RESET"; }
die() { printf '\n%s✘ ERROR: %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this script as root."

log "1. Updating system package lists & dependencies"
apt-get update -qq
apt-get install -y -qq curl git ufw nginx build-essential rsync ffmpeg

log "2. Ensuring Node.js 22+ LTS is installed"
node_major=0
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
fi
if (( node_major < 22 )); then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node --version) and npm $(npm --version) ready"

log "3. Installing PM2 Process Manager globally"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
pm2 startup systemd -u "$SITE_USER" --hp "/home/$SITE_USER" >/dev/null 2>&1 || true
ok "PM2 installed"

log "4. Ensuring site user ($SITE_USER) and directory structure"
[[ "$SITE_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "SITE_USER '$SITE_USER' is invalid. Linux usernames must start with a letter (a-z) and contain only lowercase letters, numbers, and dashes."

if ! id "$SITE_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$SITE_USER"
fi

SITE_DIR="/home/$SITE_USER/htdocs/$DOMAIN"
mkdir -p "$SITE_DIR" "$SITE_DIR/data/uploads" "/home/$SITE_USER/pm2-logs"
chown -R "$SITE_USER":"$SITE_USER" "/home/$SITE_USER"
chmod 755 "/home/$SITE_USER" "/home/$SITE_USER/htdocs"
ok "Directories provisioned at $SITE_DIR"

log "5. Configuring Nginx reverse proxy with large upload limit (500MB)"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
cat << NGINX_EOF > "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        # Overwrite (not append) so client-supplied X-Forwarded-For is never forwarded
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Disable buffering for smooth video and image streaming
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t >/dev/null 2>&1 && systemctl reload nginx
ok "Nginx vhost configured and reloaded"

log "6. Firewall (UFW) verification"
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw allow OpenSSH >/dev/null 2>&1 || true
ok "Firewall ports 80/443 enabled"

printf '\n%s✔ Server bootstrap completed successfully!%s\n' "$GREEN" "$RESET"
