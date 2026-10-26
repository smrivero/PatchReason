#!/usr/bin/env bash
# Run only on the future rented NVIDIA B200 instance. No installations or GPU downloads.
set -euo pipefail
printf '\n=== PatchReason B200 execution environment (read-only) ===\n'
date -u '+UTC: %Y-%m-%dT%H:%M:%SZ'
uname -a
printf '\n=== GPU hardware & driver ===\n'
if ! command -v nvidia-smi >/dev/null; then
  echo 'BLOCKED: nvidia-smi not found' >&2; exit 1
fi
nvidia-smi -L
nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv || nvidia-smi
printf '\n=== Storage and memory ===\n'
df -h .
free -h || true
printf '\n=== Tool availability ===\n'
for item in docker python3 nsys nvtop; do
  if command -v "$item" >/dev/null 2>&1; then
    printf '%s: %s\n' "$item" "$(command -v "$item")"
  else
    printf '%s: not found\n' "$item"
  fi
done
if command -v docker >/dev/null 2>&1; then
  docker info --format 'Docker server: {{.ServerVersion}}' 2>/dev/null || echo 'Docker CLI exists but daemon may be unavailable'
fi
if command -v nsys >/dev/null 2>&1; then
  nsys --version || true
  nsys status --environment || true
fi
if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
try:
    import torch
    print('PyTorch:', torch.__version__, 'built CUDA:', torch.version.cuda)
    print('CUDA usable:', torch.cuda.is_available())
    if torch.cuda.is_available():
        print('Device:', torch.cuda.get_device_name(0))
except ImportError:
    print('PyTorch: not installed in current Python environment')
PY
fi
printf '\nNEXT: Check compatibility of the actual NVIDIA driver with CUDA runtime in chosen NeMo image.\n'
printf 'Do not download Qwen3.5-27B or start the paid fine-tuning before that gate.\n'
