# NeMo AutoModel configuration

The single-B200 LoRA configuration is intentionally not invented here. NVIDIA's published Qwen3.5-27B recipe declares a distributed topology. Before producing `finetune.yaml`, inspect the recipe for the exact NeMo release and adapt its parallelism, checkpointing, data loader and PEFT configuration to a single device.

Official source: https://docs.nvidia.com/nemo/automodel/latest/model-coverage/vision-language-models/qwen/Qwen3.5-27B

Record the final exact image digest and git commit of NVIDIA-NeMo/Automodel along with `finetune.yaml` before the GPU session.
