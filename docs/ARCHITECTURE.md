# Architecture

## Logical services

- **React UI:** edit or paste a code change; select baseline/adapter; compare findings.
- **PatchReason API:** validate input, enforce response schema, provide access to the selected model.
- **vLLM inference:** serve the selected Qwen base model and supported LoRA adapter.
- **NeMo AutoModel workflow:** load curated code-review examples and train LoRA parameters.
- **Evaluation:** compare predictions against independent labels and save quality reports.
- **Profiling:** capture system metrics and GPU execution evidence using NVIDIA tools.

## Model boundary

The initial model is Qwen3.5-27B, a multimodal architecture, but PatchReason's first release handles text/code only. Model and runtime compatibility must be validated before assuming any vLLM LoRA serving path works unchanged.

## Data flow

`authorized source -> curated labels -> training/validation -> NeMo adapter -> vLLM -> reviewer-facing findings`

The evaluation partition must be frozen separately and must not be used to tune the model, prompts, thresholds or hyperparameters after final measurement.

## Safety boundary

Code submitted by users is treated as untrusted text, not executable instructions. Do not execute model output automatically. Avoid exposing the GPU server API publicly without authentication and network controls.
