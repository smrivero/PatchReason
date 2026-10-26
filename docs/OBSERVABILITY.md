# PatchReason | NVIDIA B200 Observability and Performance Evidence

## Objective

Record reproducible, attributable evidence of model adaptation and deployment on one NVIDIA B200 Blackwell GPU. Track system load during training and inference, preserve NVIDIA Nsight Systems traces, and provide application-level views of the actual results.

**Hardware and software are not considered verified until their versions and capabilities have been recorded from the rented instance.** No benchmark or improvement figure is claimed in advance.

## Planned toolchain

| Tool | Purpose | Official source |
| --- | --- | --- |
| NVIDIA NeMo AutoModel | LoRA supervised fine-tuning | https://catalog.ngc.nvidia.com/orgs/nvidia/-/containers/nemo-automodel/26.10.00 |
| PyTorch | Training throughput and memory statistics | https://pytorch.org/docs/stable/index.html |
| NVIDIA `nvidia-smi` | GPU identification, utilization, memory, power, temperature | https://docs.nvidia.com/deploy/nvidia-smi/index.html |
| `nvtop` | Interactive GPU utilization/process monitoring via SSH | https://github.com/Syllo/nvtop |
| NVIDIA Nsight Systems | CUDA / NVTX trace acquisition and timeline review | https://developer.nvidia.com/nsight-systems/get-started |
| vLLM | OpenAI-compatible model serving | https://docs.vllm.ai/en/stable/serving/openai_compatible_server.html |
| Promptfoo | Repeatable model evaluations | https://www.promptfoo.dev/docs/intro/ |

## Operating constraints

1. The Vast.ai instance is a container running on a third-party host. Driver versions and available device permissions are controlled by the host.
2. Kernel/counter profiling, CPU scheduling sampling, or specific Nsight events may be unavailable due to permissions. Use CUDA + NVTX tracing with `--sample=none` when feasible; record any collection limitation.
3. `nvtop` may need a terminal attached with `ssh -t`; its process view can be limited by namespace visibility.
4. Run observability tools against actual workloads and identify the workload, precision, concurrency and output tokens. A utilization screenshot alone is not a performance benchmark.
5. Keep inference endpoints behind an SSH tunnel or authenticated gateway; do not publicly expose raw vLLM endpoints.
6. Store raw logs and profiles under `artifacts/raw/` (Git-ignored). Inspect before committing selected screenshots and aggregates. Profile files may be very large.

## GPU collection workflow (on the B200 instance)

From the repository root:

```bash
bash scripts/gpu_preflight.sh
bash scripts/capture_gpu_telemetry.sh 300 training-run-01
```

This records 300 seconds of GPU telemetry. Run the command while fine-tuning or inference is active. The second argument is a run identifier. Outputs are stored in `artifacts/raw/telemetry/<run-id>/`.

For the interactive monitor:

```bash
command -v nvtop || echo 'nvtop unavailable in this image'
nvtop
```

If it is absent and package installation is permitted: `apt-get update && apt-get install -y nvtop` on Ubuntu/Debian. Do not modify the working NeMo Python environment to install system tools.

## NVIDIA Nsight Systems

On the instance, run `nsys --version` and `nsys status --environment` before selecting collection settings. The target workload command must be finalized after the training and inference entrypoints are implemented.

Example template (replace the final command with a real, short, reproducible workload):

```bash
nsys profile --trace=cuda,nvtx,osrt --sample=none --force-overwrite=true \
  --output artifacts/raw/profiles/patchreason-inference \
  <WORKLOAD_COMMAND_AND_ARGUMENTS>
```

If profiling fails because of host restrictions, preserve the error and continue with `nvidia-smi`, application metrics and `nvtop` rather than modifying host security settings without authorization.

For viewing on the Mac, install the corresponding **Nsight Systems macOS Host** from https://developer.nvidia.com/nsight-systems/get-started. Select the Intel x86_64 or Apple Silicon arm64 package after checking `uname -m` on the Mac. Collect `.nsys-rep` on Linux and download it to `/Users/smrivero/Downloads` using the provider SSH address and port.

## Screenshot and artifact plan

| Filename | Real evidence to capture | Source |
| --- | --- | --- |
| `01-overview.png` | Product overview, current deployment status | PatchReason web UI |
| `02-code-review.png` | One code review with a specific source sample and structured findings | PatchReason web UI |
| `03-model-comparison.png` | Baseline vs adapter outputs for the same input | PatchReason web UI |
| `04-evaluation.png` | Actual scored evaluation summary and confusion matrix | PatchReason web UI / Promptfoo |
| `05-gpu-telemetry.png` | Timestamped B200 utilization and VRAM chart | PatchReason web UI |
| `06-training-curves.png` | Actual recorded training/validation metrics | TensorBoard or PatchReason UI |
| `07-nvtop.png` | GPU/process activity while a workload is active | SSH terminal from Mac |
| `08-nvidia-smi.png` | Hardware/driver identification and memory/utilization | SSH terminal from Mac |
| `09-nsight-timeline.png` | CUDA / NVTX timeline captured from the workload | NVIDIA Nsight Systems on Mac |
| `10-throughput.png` | Latency, tokens/sec and concurrency from measured runs | PatchReason web UI |
| `11-promptfoo.png` | Evaluation cases, passing/failing counts and configuration | Promptfoo |
| `12-artifacts.png` | Run metadata, pinned model/dataset/container versions | PatchReason web UI |

Use descriptive, real screenshots only. Do not present sample-data UI values as measured performance. Avoid displaying secrets, service credentials, private SSH addresses, proprietary code or customer information.

## Minimum run metadata

Capture UTC timestamp, instance offer ID (if suitable for public disclosure), GPU model, CUDA driver/runtime, NeMo version, container image and digest, model revision, dataset revision and SHA256, adapter config, random seed, prompt version, inference precision, concurrency, latency distributions, token counts, measured throughput, GPU telemetry, and profiling collection limitations.

## Repository publication

Commit this plan, implementation and reviewed screenshots to Git. Keep raw model weights, large trace archives, temporary telemetry files, and unlicensed third-party source material outside the public repository unless publication rights are verified. Use `screenshots/` for selected published images and `results/` for reviewed aggregate metrics and their methodology.
