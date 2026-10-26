# NVIDIA B200 Deployment Readiness

## Candidate hardware

- Provider: Vast.ai
- GPU: 1x NVIDIA B200 Blackwell, advertised around 179 GB usable VRAM
- Observed listing from user: USD 6.255/hour; not a reserved rate
- Billing: compute plus potential storage/bandwidth charges

## Candidate NVIDIA container

- Official release: `nvcr.io/nvidia/nemo-automodel:26.10.00`
- NVIDIA NGC: https://catalog.ngc.nvidia.com/orgs/nvidia/-/containers/nemo-automodel/26.10.00
- Installation: https://docs.nvidia.com/nemo/automodel/latest/get-started/installation

**Do not deploy based only on the container tag.** Confirm host driver compatibility, selected image architecture, NeMo Qwen3.5 support and single-device training recipe first. Pin the content digest once validated. The published NeMo Qwen3.5-27B recipe targets multi-node GPUs; single-B200 LoRA requires an adapted configuration.

## Before renting

- [ ] Dataset sources and licensing recorded; label quality reviewed
- [ ] Train/validation/evaluation split frozen
- [ ] Baseline prompts and metrics defined
- [ ] NeMo adapter configuration ready for a very short initial training pass
- [ ] Container/driver compatibility checked against selected offer
- [ ] SSH access and safe output transfer commands prepared
- [ ] Storage capacity/budget computed and hard spending limit selected
- [ ] GPU monitoring and profiling permissions planned

## Once rented

1. Check `nvidia-smi`, driver, GPU type and disk availability.
2. Inspect Python, NeMo, PyTorch and CUDA in the container.
3. Validate model loading and a minimal LoRA backward/update cycle.
4. Record baseline response quality, then run actual fine-tuning.
5. Run quality evaluation and characterize inference performance.
6. Archive checkpoints, config, evaluations and profiler reports.
7. Copy outputs to Mac, confirm integrity, and terminate the instance.

## Secure access

Use SSH tunneling to reach HTTP services from the Mac. Keep the model endpoint private. Avoid opening an unauthenticated inference service to the internet.
