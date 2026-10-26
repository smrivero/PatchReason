# Candidate: single-NVIDIA-B200 Qwen3.5-27B LoRA

## Status

Engineering proposal only. Not an executed training run, not a quality-approved
training dataset, and not a demonstrated 1-GPU recipe.

## Version-pinned references

- [NeMo AutoModel r0.7.0 Qwen3.5-27B 16-GPU VLM recipe](https://github.com/NVIDIA-NeMo/Automodel/blob/r0.7.0/examples/vlm_finetune/qwen3_5/qwen3_5_27b_tp4pp4.yaml)
- [NeMo AutoModel r0.7.0 Gemma-3 VLM LoRA recipe](https://github.com/NVIDIA-NeMo/Automodel/blob/r0.7.0/examples/vlm_finetune/gemma3/gemma3_vl_4b_cord_v2_peft.yaml)
- [NeMo AutoModel 0.7 dataset guide](https://docs.nvidia.com/nemo/automodel/v0.7/datasets/overview)
- [NeMo AutoModel 0.7 VLM guide](https://docs.nvidia.com/nemo/automodel/v0.7/model-coverage/vision-language-models/overview)
- [NVIDIA NeMo AutoModel 26.10 container](https://catalog.ngc.nvidia.com/orgs/nvidia/containers/nemo-automodel)
- [Qwen3.5-27B](https://huggingface.co/Qwen/Qwen3.5-27B)

## Intended configuration

- Model: Qwen/Qwen3.5-27B, BF16 VLM path
- Hardware: one B200, `tp=pp=cp=ep=1`, gradient checkpointing
- LoRA: rank 16, alpha 32, text projections targeted, towers excluded
- Sequence limit: 2048 tokens, no silent truncation intended
- Data: text-only security classification, VLM `conversation` adapter
- Scope: **two optimizer steps**, strictly for compatibility verification

This project does not use the standard NeMo LLM `ChatDataset` directly in this
candidate because the checked-in model recipe uses `FinetuneRecipeForVLM`.
The custom dataset loader converts each validated chat record into the VLM
conversation schema. Data adapter correctness on the final `AutoProcessor`,
collation, nonempty assistant loss mask, LoRA layer matches, and model behavior
must still be verified at runtime.

## Preconditions before renting

1. Source rights and label spot review documented; admission is not yet approved.
2. A B200 host with a CUDA-13.2-compatible NVIDIA driver and adequate persistent disk.
3. The desired model weights can be retrieved, preferably onto persistent storage.
4. Check actual available RAM and GPU memory, Docker GPU access, and permitted profilers.
5. Commit current scripts and preserve hashes of the train/validation archive.

## On rented host (only after authorization)

Use `/workspace/PatchReason` for the cloned repo and stage `train.jsonl` and
`validation.jsonl` from the SHA-256-verified archive under
`/workspace/PatchReason/data`. No final evaluation split is transferred.

The candidate command, **not yet validated**, is:

```bash
automodel config/nemo/qwen35_27b_b200_lora_candidate.yaml
```

First verify `AutoProcessor`/VLM collation on one real sample and ensure labels
contain supervised tokens; confirm actual trainable adapters and GPU memory.
Only then attempt the two-step compatibility run. Preserve terminal logs,
`nvidia-smi` telemetry, `nvtop` captures, Nsight Systems traces (if allowed),
exact container image digest, and adapter/checkpoint metadata. Do not infer
accuracy or improvement from a successful optimizer step.
