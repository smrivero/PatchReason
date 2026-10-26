# PatchReason — Single-B200 Execution Preparation

## Status

This engineering project responds to a **simulated customer requirement** for a JavaScript/TypeScript security code-review system. No training, GPU benchmark or model improvement is claimed here.

UI development takes place in `app/` independently. This preparation does not modify the UI, its assets or API contract.

## Data

Source: [sijjeel/js-vuln-dataset](https://huggingface.co/datasets/sijjeel/js-vuln-dataset).

Selected: 4,000 training, 300 validation, 300 final evaluation records. The model adaptation task is **binary vulnerability classification**, not CWE identification or automatic patch synthesis. The selected data is labeled upstream, and per-repository rights and individual label correctness remain open admission gates.

From macOS run:

```bash
python3 scripts/validate_js_vulnerability_data.py
python3 scripts/prepare_nemo_data.py
python3 scripts/audit_binary_readiness.py
python3 scripts/package_b200_training_data.py
```

The `audit_binary_readiness.py` output is an aggregated public-safe JSON report. Character-length distributions are **not** model token counts. The packaging script creates a private `artifacts/raw/b200_handoff/patchreason-train-validation.tar.gz`, with an internal integrity manifest and external SHA-256. The **300 held-out test records are not included**.

No raw or derived training code, credentials, private datasets, model weights or raw GPU reports belong in the public repository.

## NVIDIA software and model compatibility

- [NeMo AutoModel 0.7 / October 2026](https://docs.nvidia.com/nemo/automodel/v0.7)
- [NeMo Docker installation and host driver considerations](https://docs.nvidia.com/nemo/automodel/get-started/installation)
- [Qwen3.5-27B NeMo model coverage](https://docs.nvidia.com/nemo/automodel/latest/model-coverage/vision-language-models/qwen/Qwen3.5-27B)
- [NeMo ChatDataset reference](https://docs.nvidia.com/nemo/automodel/v0.7/datasets/overview)
- [Qwen3.5-27B model](https://huggingface.co/Qwen/Qwen3.5-27B)

The model is `Qwen3_5ForConditionalGeneration`, a vision-language architecture. The published model-specific NeMo recipe declares `tp_size=4`, `pp_size=4`, and two nodes. Neither the availability of `ChatDataset` for LLMs nor the general ability to run LoRA on one GPU demonstrates that **this VLM** and these exported JSONL files can be fine-tuned unchanged on one B200.

The candidate NeMo `26.10.00` container uses CUDA 13.2 user-space; verify host driver compatibility on the actual rented instance. Inference runtimes, profiling tools, and CUDA libraries may each require distinct container environments. Avoid replacing NeMo's preinstalled torch in the container.

### Read-only check on the rented B200

```bash
bash scripts/b200_environment_gate.sh | tee b200-environment.txt
```

Inspect driver, CUDA compatibility, GPU VRAM, free disk, PyTorch visibility, `nsys` and `nvtop` availability. Capture proof of GPU model and the compatibility decision. A successful read-only check does not establish single-GPU fine-tuning compatibility.

## Observability and evidence

- [nvtop](https://github.com/Syllo/nvtop): process/GPU activity in a terminal session.
- [Nsight Systems](https://developer.nvidia.com/nsight-systems/get-started): collect trace using Linux CLI, view `.nsys-rep` on macOS host. Profiling permissions may be restricted by Vast.ai host/container configuration.
- `scripts/capture_gpu_telemetry.sh` from v9: sample utilization, VRAM, power, and temperature while an actual workload is running.

Do not generate charts from fabricated telemetry. Collect a real training run ID, timestamps, model revision, host GPU, image digest, command/config, logs, telemetry CSV, Nsight report and evaluation artifact IDs. For reproducibility, associate each screenshot with those artifacts.

## Before spending GPU budget

1. Resolve per-repository training rights and manually inspect a representative label sample. No current training authorization is implied by dataset packaging.
2. Obtain a B200 instance with host driver compatible with the selected NeMo image and adequate storage.
3. Verify model processor/loader, text-only VLM data adapter, gradient checkpointing and memory footprint against one GPU.
4. Run minimal model-loading and forward/backward compatibility checks; only then start the full LoRA job.
5. Baseline and LoRA evaluation must use the same prompts and held-out examples. Report precision, recall, F1, latency and false positives with supporting measured outputs.

## Package verification

After packaging, verify the private handoff locally, without executing any source code:

```bash
python3 scripts/verify_b200_handoff.py
```

The handoff contains only `train.jsonl`, `validation.jsonl` and `handoff_manifest.json`. The archive has a SHA-256 sidecar. The gzip and tar timestamps are deterministic. Model training is still gated by data admission and single-GPU VLM compatibility.

The published [NeMo 0.7 Qwen3.5-27B recipe](https://github.com/NVIDIA-NeMo/Automodel/blob/r0.7.0/examples/vlm_finetune/qwen3_5/qwen3_5_27b_tp4pp4.yaml) is a MedPix VLM full fine-tuning recipe across 16 GPUs; it is **not** a working LoRA config for PatchReason on one B200. Do not claim that changing `tp_size` and `pp_size` alone produces a supported configuration.
