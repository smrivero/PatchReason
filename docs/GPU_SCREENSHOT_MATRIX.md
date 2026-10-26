# PatchReason — Evidence Capture Matrix

Every screenshot below must depict the working application, real instrument output or a clearly labeled demo preview. Never fabricate throughput, loss, accuracy, utilization, precision, F1, or hardware measurements.

| Screenshot name | What must be visible | Capture stage |
| --- | --- | --- |
| `01-review-console.png` | User-provided code, detected vulnerabilities and source lines | UI connected to real model |
| `02-model-comparison.png` | Base and LoRA models, identical prompt, model IDs | After inference comparison |
| `03-eval-summary.png` | Evaluation set, sample count, metrics and run IDs | After scoring |
| `04-confusion-matrix.png` | TP, FP, TN, FN, dataset/version | After scoring |
| `05-training-loss.png` | Genuine training curves with run ID and axis labels | During/after training |
| `06-gpu-utilization.png` | nvidia-smi / nvtop B200 and active workload | During GPU execution |
| `07-gpu-memory.png` | VRAM, job start/end and monitoring interval | During GPU execution |
| `08-nsight-timeline.png` | CUDA kernel / CPU-GPU timeline from recorded `.nsys-rep` | After profiling |
| `09-throughput.png` | Tokens/sec, configuration and measured sample count | After benchmark |
| `10-promptfoo.png` | Promptfoo configuration and reproducible evaluation output | After eval |
| `11-dataset-provenance.png` | Source hash, partition counts, admission flags | Now, from actual manifest |
| `12-architecture.png` | System topology, execution path and toolchain | Now, as clearly identified architecture |

For public GitHub documentation, store selected screenshots in `docs/images/`, while keeping raw `.nsys-rep`, original source code and internal artifacts private. Upload screenshots to Upwork only after their underlying results exist.
