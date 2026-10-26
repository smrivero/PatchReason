# PatchReason | Web UI and Portfolio Capture Plan

The interface is meant to present source-code review workflows, baseline vs adapted-model results, trustworthy quality metrics, and NVIDIA B200 telemetry. The web frontend must use measured values only for published evaluation and performance claims.

## UI capture matrix

| Route | Target evidence | Capture timing |
| --- | --- | --- |
| `/` | Scope, architecture and verified dataset counts | Before GPU rental |
| `/review` | Code input, structured security findings from a real model response | After inference is connected |
| `/compare` | Baseline versus fine-tuned comparison on identical code | After LoRA and evaluation |
| `/evaluation` | Actual metrics and confusion matrix | After scoring |
| `/gpu` | Timestamped real B200 metrics | During B200 execution |
| `/runs` | Training output and provenance | After training |
| `/methodology` | Source lineage and decision trail | Before GPU rental |

The app should have a demo mode for implementation review, but all demo fixtures must be visibly labeled and must not be used as performance evidence on GitHub or Upwork.

## Evidence naming

Save reviewed images to `screenshots/01-overview.png`, `screenshots/02-code-review.png`, ..., as listed in `docs/OBSERVABILITY.md`. Save the corresponding provenance in each run manifest: timestamps, datasets, model revision, source image, inference settings, and whether outputs were produced by baseline or LoRA.

## Integration milestones

1. Create the UI and type-safe API adapters locally.
2. Import existing manifest facts and add links to methodology.
3. Connect secure inference gateway after B200 availability.
4. Capture GPU metrics via `nvidia-smi`, `nvtop`, and NVIDIA Nsight Systems.
5. Evaluate model quality; only then produce comparison and result screenshots.
6. Copy original reports and screenshots to `/Users/smrivero/Downloads` and curate repository-friendly versions.
