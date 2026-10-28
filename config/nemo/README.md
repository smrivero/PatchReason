# NeMo AutoModel training configurations

PatchReason uses Qwen3.5-27B with LoRA on one NVIDIA B200. These configurations serve distinct stages:

- `qwen35_27b_b200_compatibility.yaml`: synthetic-data runtime checks.
- `qwen35_27b_b200_lora_candidate.yaml`: short real-data integration checks.
- `qwen35_27b_b200_full_epoch1.yaml`: one-epoch training configuration.

The full-epoch run and checkpoint evidence are summarized in [the root README](../../README.md#training-on-nvidia-b200). Compatibility checks are separate from model-quality evaluation.

Data loading uses `scripts/b200_patchreason_dataset.py`. Preserve the exact configuration, software versions, source revisions, and checkpoint metadata with each run. Keep training and validation exports separate from held-out evaluation data.
