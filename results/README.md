# Recorded results

`data_intake/` contains versioned dataset manifests, provenance, selection counts, and sequence-budget audits. These describe data preparation and do not substitute for model evaluation.

The root [README](../README.md#evaluation-and-measured-results) summarizes held-out evaluation and links the captured MLflow evidence. API benchmark configurations and recorded outputs are under `benchmarks/promptfoo/` in the workspace.

Preserve verified metrics with their model, adapter, data revision, and inference settings. Large checkpoints and raw profiler traces remain outside Git; screenshots are under `screenshots/`.
