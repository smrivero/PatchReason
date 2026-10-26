#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' '=== PatchReason GPU environment ==='
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo 'nvidia-smi not found: this container is not yet ready for GPU collection' >&2
  exit 1
fi
nvidia-smi
printf '\n=== Driver, GPU and compute metadata ===\n'
nvidia-smi --query-gpu=name,uuid,driver_version,memory.total,compute_cap --format=csv || true
printf '\n=== Tool availability ===\n'
for tool in python python3 nvtop nsys; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '%s: %s\n' "$tool" "$(command -v "$tool")"
  else
    printf '%s: unavailable\n' "$tool"
  fi
done
if command -v nsys >/dev/null 2>&1; then
  nsys --version || true
  nsys status --environment || true
fi
if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
try:
    import torch
    print('PyTorch:', torch.__version__)
    print('CUDA runtime:', torch.version.cuda)
    print('CUDA accessible:', torch.cuda.is_available())
    if torch.cuda.is_available():
        print('GPU:', torch.cuda.get_device_name(0))
        print('Compute capability:', torch.cuda.get_device_capability(0))
except ImportError:
    print('PyTorch is not available in the current Python environment')
PY
fi
