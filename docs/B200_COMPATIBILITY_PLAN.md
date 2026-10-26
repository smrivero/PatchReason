# Single-B200 Runtime Compatibility Plan

## Objective

Verify that NVIDIA NeMo AutoModel 0.7 can execute two LoRA
optimizer steps using Qwen3.5-27B on one NVIDIA B200.

This is an engineering compatibility check, not a completed
fine-tuning run or a security performance evaluation.

## Environment

- NVIDIA NeMo AutoModel 0.7 / container 26.10
- Qwen/Qwen3.5-27B
- Single NVIDIA B200
- BF16
- LoRA rank 16, alpha 32
- Maximum sequence length: 2048 tokens
- Two optimization steps
- Original synthetic JavaScript examples
- No checkpoint writing during this initial execution

## Required runtime verification

1. NVIDIA driver supports the selected container runtime.
2. The GPU is visible with nvidia-smi.
3. AutoProcessor loads and formats the synthetic conversations.
4. The VLM collator produces nonempty assistant supervision labels.
5. LoRA attaches to the intended language-model modules.
6. The optimizer completes two steps without an out-of-memory error.
7. GPU utilization and allocated memory are recorded.
8. Execution logs and container digest are preserved.

## Evidence

Record real screenshots of nvidia-smi, nvtop, training logs,
and Nsight Systems if profiling permissions are available.

Do not claim measured improvements before comparing the base
model against the fine-tuned adapter on independent evaluation data.

## References

- https://docs.nvidia.com/nemo/automodel/v0.7/
- https://github.com/NVIDIA-NeMo/Automodel
- https://huggingface.co/Qwen/Qwen3.5-27B
