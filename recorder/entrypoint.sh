#!/bin/bash
set -e

# ─── Config ───────────────────────────────────────────────
# CAMERAS: JSON array, each with:
#   name  — directory name for recordings
#   url   — RTSP source (e.g. rtsp://100.x.x.x:8554/cam-1)
#   extra — optional extra ffmpeg flags
#
# VPS_TAILSCALE_IP: Tailscale IP of the VPS (used as fallback source)
#
# Example:
#   CAMERAS='[{"name":"entrada","url":"rtsp://192.168.1.101:554/stream1"},
#             {"name":"cochera","url":"rtsp://100.x.x.x:8554/cam-2"}]'

CAMERAS="${CAMERAS:-[]}"
BASE_DIR="/recordings"
SEGMENT_TIME="${SEGMENT_TIME:-600}"   # 10 min
RETRY_DELAY="${RETRY_DELAY:-10}"      # seconds between FFmpeg restarts
PID_DIR="/tmp/ffmpeg-pids"

mkdir -p "$PID_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cleanup() {
  log "Shutting down all FFmpeg processes…"
  for pid_file in "$PID_DIR"/*.pid; do
    [ -f "$pid_file" ] && kill "$(cat "$pid_file")" 2>/dev/null || true
  done
  exit 0
}
trap cleanup SIGTERM SIGINT

run_ffmpeg() {
  local name="$1"
  local url="$2"
  local extra="$3"
  local cam_dir="${BASE_DIR}/${name}"

  mkdir -p "${cam_dir}"

  # Generate output pattern: /recordings/<name>/YYYY-MM-DD/HH-MM-SS.mp4
  local output="${cam_dir}/%Y-%m-%d/%H-%M-%S.mp4"

  log "[${name}] Starting recorder: ${url}"

  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel warning \
    -rtsp_transport tcp \
    -i "${url}" \
    -c copy \
    -map 0 \
    -f segment \
    -segment_time "${SEGMENT_TIME}" \
    -segment_atclocktime 1 \
    -reset_timestamps 1 \
    -strftime 1 \
    ${extra} \
    "${output}" &

  local pid=$!
  echo "$pid" > "${PID_DIR}/${name}.pid"
  wait "$pid"

  log "[${name}] FFmpeg exited. Restarting in ${RETRY_DELAY}s…"
}

log "Recorder starting — ${SEGMENT_TIME}s segments"
log "Cameras: $(echo "$CAMERAS" | jq -r '.[].name' | tr '\n' ' ')"

# Launch one FFmpeg per camera
echo "$CAMERAS" | jq -c '.[]' | while read -r cam; do
  name=$(echo "$cam" | jq -r '.name')
  url=$(echo "$cam" | jq -r '.url')
  extra=$(echo "$cam" | jq -r '.extra // ""')

  # Validate
  if [ -z "$name" ] || [ -z "$url" ]; then
    log "ERROR: each camera must have 'name' and 'url' — skipping: $cam"
    continue
  fi

  # Fork a supervisor loop for each camera
  (
    while true; do
      run_ffmpeg "$name" "$url" "$extra"
      sleep "$RETRY_DELAY"
    done
  ) &
done

# Health endpoint via a simple file marker
(
  while true; do
    echo "ok" > /tmp/health
    sleep 30
  done
) &

log "All cameras launched. Waiting for processes…"
wait
