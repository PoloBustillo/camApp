#!/bin/bash
# ─────────────────────────────────────────────────────────
# CamWatch — Disk cleanup script
# Run daily via cron to keep disk usage under threshold
# ─────────────────────────────────────────────────────────
# Usage: ./cleanup.sh [--dry-run] [--keep-days 14]
# ─────────────────────────────────────────────────────────

set -euo pipefail

BASE_DIR="${BASE_DIR:-/mnt/recordings}"
MAX_USAGE="${MAX_USAGE:-80}"   # delete oldest if disk >80%
MIN_FREE_GB="${MIN_FREE_GB:-20}"
KEEP_DAYS="${KEEP_DAYS:-7}"    # always keep last 7 days

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

dry_run=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --keep-days=*) KEEP_DAYS="${arg#*=}" ;;
    --max-usage=*) MAX_USAGE="${arg#*=}" ;;
  esac
done

log "Disk usage check — ${BASE_DIR}"

# Get disk usage percentage
usage=$(df "${BASE_DIR}" | tail -1 | awk '{print $5}' | tr -d '%')
avail_kb=$(df "${BASE_DIR}" | tail -1 | awk '{print $4}')
avail_gb=$((avail_kb / 1024 / 1024))

log "Disk: ${usage}% used, ${avail_gb}GB available (max ${MAX_USAGE}%, min ${MIN_FREE_GB}GB free)"

# Skip if usage is below threshold
if [ "$usage" -lt "$MAX_USAGE" ] && [ "$avail_gb" -gt "$MIN_FREE_GB" ]; then
  log "Under threshold, no cleanup needed"
  exit 0
fi

# List camera directories
for cam_dir in "${BASE_DIR}"/*/; do
  [ -d "$cam_dir" ] || continue
  cam_name=$(basename "$cam_dir")
  log "Checking ${cam_name}…"

  # List date directories sorted oldest first
  find "$cam_dir" -maxdepth 1 -type d -name '????-??-??' | sort | while read -r date_dir; do
    date_name=$(basename "$date_dir")
    # Check if date is older than KEEP_DAYS
    if [[ "$date_name" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      cutoff=$(date -d "${KEEP_DAYS} days ago" +%s 2>/dev/null || echo "")
      dir_epoch=$(date -d "$date_name" +%s 2>/dev/null || echo "0")
      if [ -n "$cutoff" ] && [ "$dir_epoch" -lt "$cutoff" ]; then
        if [ "$dry_run" = true ]; then
          log "  [DRY-RUN] Would delete: ${date_dir}"
        else
          size=$(du -sh "$date_dir" 2>/dev/null | cut -f1)
          rm -rf "$date_dir"
          log "  Deleted ${date_dir} (${size})"
        fi
      fi
    fi
  done
done

# Check again after deletion
usage=$(df "${BASE_DIR}" | tail -1 | awk '{print $5}' | tr -d '%')
log "Cleanup complete — disk now ${usage}% used"
