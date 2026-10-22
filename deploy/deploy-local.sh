#!/usr/bin/env bash
# Local deploy driver for apex-dispatch.
# Usage:
#   ./deploy/deploy-local.sh <profile> [--skip-git] [--bootstrap] [--no-deploy]
set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
cd "$REPO_ROOT"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || { echo "Usage: ./deploy/deploy-local.sh <profile>"; exit 1; }
shift || true

PROFILE_ENV="$DEPLOY_DIR/clients/$PROFILE/app.env"
[[ -f "$PROFILE_ENV" ]] || { echo "Missing profile configuration: $PROFILE_ENV" >&2; exit 1; }

SKIP_GIT=false
RUN_BOOTSTRAP=false
RUN_DEPLOY=true

for arg in "$@"; do
  case "$arg" in
    --skip-git)  SKIP_GIT=true ;;
    --bootstrap) RUN_BOOTSTRAP=true ;;
    --no-deploy) RUN_DEPLOY=false ;;
    -h|--help)   echo "Usage: ./deploy.sh $PROFILE [--skip-git] [--bootstrap] [--no-deploy]"; exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

BOLD=$'\033[1m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; DIM=$'\033[2m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'
info() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
ok()   { printf '  %s✔ %s%s\n' "$GREEN" "$1" "$RESET"; }
step() { printf '\n%s━━ %s%s\n' "$BOLD" "$1" "$RESET"; }

# Load configuration
set -a
source "$PROFILE_ENV"
set +a

required=(SERVER_IP DOMAIN SITE_USER PORT PROJECT_NAME)
for var in "${required[@]}"; do
  [[ -n "${!var:-}" ]] || { echo "Error: $var is missing in $PROFILE_ENV" >&2; exit 1; }
done

SSH_TARGET="root@$SERVER_IP"

printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$CYAN" "$RESET"
printf '%s  Deploying: %s%s (%s) -> %s\n' "$CYAN" "$PROJECT_NAME" "$RESET" "$PROFILE" "$DOMAIN"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$CYAN" "$RESET"

# Step 1: Git Push (optional)
if [[ "$SKIP_GIT" == false && -n "${GIT_REPO:-}" ]]; then
  step "Checking Git status and pushing"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    branch="$(git rev-parse --abbrev-ref HEAD)"
    if ! git diff --quiet || ! git diff --staged --quiet; then
      info "Uncommitted changes detected. Commit them first or use --skip-git."
      exit 1
    fi
    info "Pushing branch $branch to remote origin..."
    git push origin "$branch" || true
    ok "Git branch synchronized"
  fi
else
  info "Skipping git push (--skip-git or no GIT_REPO specified)"
fi

# Step 2: Upload deployment scripts & production .env
step "Uploading deployment bundle to remote server ($SERVER_IP)"
REMOTE_TEMP="/root/deploy-$PROJECT_NAME"
ssh -o ConnectTimeout=10 "$SSH_TARGET" "mkdir -p $REMOTE_TEMP"

# Upload deploy-remote.sh and server-bootstrap.sh
scp -q "$DEPLOY_DIR/deploy-remote.sh" "$SSH_TARGET:$REMOTE_TEMP/deploy-remote.sh"
scp -q "$DEPLOY_DIR/server-bootstrap.sh" "$SSH_TARGET:$REMOTE_TEMP/server-bootstrap.sh"
scp -q "$PROFILE_ENV" "$SSH_TARGET:$REMOTE_TEMP/app.env"

ok "Uploaded deployment package"

# Step 3: Run server-bootstrap if requested
if [[ "$RUN_BOOTSTRAP" == true ]]; then
  step "Running server bootstrap on remote server"
  ssh -t "$SSH_TARGET" "bash $REMOTE_TEMP/server-bootstrap.sh $REMOTE_TEMP/app.env"
  ok "Server bootstrap completed"
fi

# Step 4: Run remote deploy
if [[ "$RUN_DEPLOY" == true ]]; then
  step "Executing remote deployment and application build"
  ssh -t "$SSH_TARGET" "bash $REMOTE_TEMP/deploy-remote.sh $REMOTE_TEMP/app.env"
  ok "Remote deployment successful!"
  
  printf '\n%s✔ Deployment completed successfully!%s\n' "$GREEN" "$RESET"
  printf '  Web URL: %shttps://%s%s\n' "$BOLD" "$DOMAIN" "$RESET"
  printf '  Secret Trigger Word: "%s"\n' "${TRIGGER_WORD:-guarantee}"
  printf '  Emergency Reset URL: https://%s/?reset_vault_token=%s\n\n' "$DOMAIN" "${ADMIN_RESET_TOKEN:-unlock123}"
else
  ok "Config sync complete (--no-deploy was specified)"
fi
