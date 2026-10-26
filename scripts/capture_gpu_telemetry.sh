#!/usr/bin/env bash
set -euo pipefail

DURATION="${1:-300}"
RUN_ID="${2:-b200-session}"
if ! [[ "$DURATION" =~ ^[0-9]+$ ]] || (( DURATION < 1 || DURATION > 86400 )); then
  echo 'Usage: bash scripts/capture_gpu_telemetry.sh <duration_seconds:1..86400> <run_id>' >&2
  exit 2
fi
if ! [[ "$RUN_ID" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo 'run_id must consist of letters, digits, dot, underscore or dash' >&2
  exit 2
fi
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo 'nvidia-smi is unavailable' >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/artifacts/raw/telemetry/$RUN_ID"
mkdir -p "$DEST"
if [[ -f "$DEST/gpu.csv" ]]; then
  echo "Refusing to overwrite previous capture: $DEST/gpu.csv" >&2
  exit 1
fi
{
  printf 'run_id=%s\n' "$RUN_ID"
  printf 'capture_start_utc=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf 'duration_seconds=%s\n' "$DURATION"
} > "$DEST/capture_metadata.txt"
nvidia-smi -q > "$DEST/nvidia-smi-inventory.txt"
# Capture under an active workload. Sample interval: 2 seconds.
nvidia-smi --query-gpu=timestamp,name,uuid,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw \
  --format=csv -l 2 > "$DEST/gpu.csv" &
COLLECTOR_PID=$!
stop_capture() {
  kill "$COLLECTOR_PID" 2>/dev/null || true
  wait "$COLLECTOR_PID" 2>/dev/null || true
}
trap stop_capture EXIT INT TERM
sleep "$DURATION"
stop_capture
trap - EXIT INT TERM
printf 'capture_end_utc=%s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$DEST/capture_metadata.txt"
echo "Telemetry saved: $DEST"
