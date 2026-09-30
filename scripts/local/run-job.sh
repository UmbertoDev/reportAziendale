#!/usr/bin/env bash
# Esegue un job del report in locale (routine cron / launchd).
# Uso: scripts/local/run-job.sh recap|reminder|report [YYYY-MM]
set -euo pipefail

JOB="${1:?uso: run-job.sh recap|reminder|report [YYYY-MM]}"
case "$JOB" in recap|reminder|report) ;; *) echo "Job sconosciuto: $JOB" >&2; exit 2 ;; esac

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$REPO_DIR/logs"
mkdir -p "$LOG_DIR"
exec >>"$LOG_DIR/$JOB.log" 2>&1

# cron parte con un PATH minimo: aggiungiamo i percorsi tipici di node e claude
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') job $JOB"
cd "$REPO_DIR"

if [[ ! -f .env ]]; then
  echo "Manca $REPO_DIR/.env (vedi docs/ESECUZIONE-LLM.md)"; exit 1
fi
set -a; source .env; set +a
export LLM_PROVIDER="${LLM_PROVIDER:-LOCAL}"
[[ -n "${2:-}" ]] && export MONTH="$2"

git pull --ff-only --quiet origin main
npm ci --silent --no-audit --no-fund
npm run --silent "job:$JOB"
echo "=== fine job $JOB"
