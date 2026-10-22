#!/usr/bin/env bash
# Usage:
#   ./deploy.sh <profile> [flags]
#   ./deploy.sh production
#
# Flags forwarded to deploy-local.sh:
#   --skip-git      Skip git commit/push and deploy existing remote branch
#   --bootstrap     Run one-time server preparation (Node 22+, PM2, Nginx, UFW)
#   --no-deploy     Only sync env files and scripts without rebuilding
set -Eeuo pipefail

CLIENT="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENTS_DIR="$REPO_ROOT/deploy/clients"
BOLD=$'\033[1m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; DIM=$'\033[2m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'

list_clients() {
  if [[ -d "$CLIENTS_DIR" ]] && compgen -G "$CLIENTS_DIR/*" > /dev/null; then
    for dir in "$CLIENTS_DIR"/*/; do
      [[ -d "$dir" ]] && printf '  • %s\n' "$(basename "$dir")"
    done
  else
    echo "  (no profiles found in deploy/clients/)"
  fi
}

if [[ "$CLIENT" == "-h" || "$CLIENT" == "--help" ]]; then
  echo "Usage:"
  echo "  ./deploy.sh <profile-name> [flags]   Deploy to a single profile/environment"
  echo "  ./deploy.sh                          Interactive profile menu"
  echo ""
  echo "Flags:"
  echo "  --skip-git     Skip git commit and push"
  echo "  --bootstrap    Run initial server bootstrap (Node/PM2/Nginx setup)"
  echo "  --no-deploy    Only sync env files and scripts without rebuild"
  echo ""
  echo "Available profiles:"
  list_clients
  exit 0
fi

# Interactive menu if no profile was passed
if [[ -z "$CLIENT" || "$CLIENT" == --* ]]; then
  shopt -s nullglob
  raw_clients=()
  for dir in "$CLIENTS_DIR"/*/; do
    [[ -d "$dir" ]] && raw_clients+=("$(basename "$dir")")
  done
  shopt -u nullglob

  if [[ ${#raw_clients[@]} -eq 0 ]]; then
    echo "No profiles found in deploy/clients/." >&2
    echo "Create one by copying deploy/clients/production/ to deploy/clients/<name>/" >&2
    exit 1
  fi

  echo ""
  printf '%sSelect deployment profile:%s\n' "$BOLD" "$RESET"
  for i in "${!raw_clients[@]}"; do
    printf '  %s%d)%s %s\n' "$CYAN" "$((i+1))" "$RESET" "${raw_clients[$i]}"
  done
  echo ""
  read -r -p "Enter choice [1-${#raw_clients[@]}] (default 1): " choice
  choice="${choice:-1}"
  
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#raw_clients[@]} )); then
    echo "Invalid selection." >&2
    exit 1
  fi
  CLIENT="${raw_clients[$((choice-1))]}"
fi

PROFILE_DIR="$CLIENTS_DIR/$CLIENT"
if [[ ! -d "$PROFILE_DIR" ]]; then
  printf '\n%s✘ Error: Profile "%s" does not exist in deploy/clients/%s\n\n' "$RED" "$CLIENT" "$RESET" >&2
  echo "Available profiles:"
  list_clients
  exit 1
fi

shift || true
exec "$REPO_ROOT/deploy/deploy-local.sh" "$CLIENT" "$@"
