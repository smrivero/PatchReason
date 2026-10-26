# Architecture Decision Record

| ID | Decision | Status | Rationale |
|---|---|---|---|
| ADR-001 | PatchReason name | Accepted | Professional product identity for security-focused code review |
| ADR-002 | TypeScript/Node.js API security as initial domain | Accepted | Bounded scope and measurable output quality |
| ADR-003 | Qwen3.5-27B as preferred base | Proposed | Large open-weight model; runtime and fine-tuning compatibility pending |
| ADR-004 | NVIDIA NeMo AutoModel + LoRA | Proposed | NVIDIA-centric training stack and efficient model adaptation |
| ADR-005 | Single B200 on Vast.ai | Proposed | One GPU for training, inference and profiling within a capped budget |
| ADR-006 | Strong prompted baseline before adaptation | Accepted | Separates fine-tuning gains from prompt-engineering gains |
| ADR-007 | No fabricated metrics or real-client claim | Accepted | Portfolio credibility and auditability |

## Open engineering decisions

1. Confirm selected B200 host driver and supported CUDA/container combination.
2. Derive a single-GPU LoRA configuration from official NeMo documentation; published Qwen3.5-27B recipe targets a distributed environment.
3. Verify vLLM serving compatibility for base architecture and trained adapter.
4. Confirm profiling permissions and available disk storage on the selected Vast.ai offer.
5. Select properly licensed datasets and record provenance.

## Change policy

Log the date, reason, impact and links when altering a decision. Never silently replace measured results or configuration artifacts.
