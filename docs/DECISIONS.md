# Architecture Decision Record

| ID | Decision | Status | Rationale |
|---|---|---|---|
| ADR-001 | PatchReason name | Accepted | Professional product identity for security-focused code review |
| ADR-002 | TypeScript/Node.js API security as initial domain | Accepted | Bounded scope and measurable output quality |
| ADR-003 | Qwen3.5-27B as base | Accepted | Base and adapted-model workflow documented in the root README |
| ADR-004 | NVIDIA NeMo AutoModel + LoRA | Accepted | NVIDIA-centric training stack and efficient model adaptation |
| ADR-005 | Single B200 on Vast.ai | Accepted | One GPU for training, inference and profiling within a capped budget |
| ADR-006 | Strong prompted baseline before adaptation | Accepted | Separates fine-tuning gains from prompt-engineering gains |
| ADR-007 | Traceable metrics and implementation evidence | Accepted | Reproducibility and auditability |

## Execution records

The root README summarizes training, inference, evaluation, and profiling evidence. Configuration files are maintained in `config/nemo/`. Record environment-specific compatibility checks and software versions with each new run.

## Change policy

Log the date, reason, impact and links when altering a decision. Never silently replace measured results or configuration artifacts.

### External source intake: pinned revisions and review queue

Decision date: 2026-10-26.

Use Hugging Face Security Vulnerability Fix Patches as the first lightweight
source of code-change candidates. Resolve and record a Hugging Face commit SHA.
Check actual changed JS/TS file paths because the declared language label can
differ from the patched files. Prefer the official CVEfixes SQLite archive for
additional CVE-linked source, but ingest it separately due to download size
and different annotation semantics.

Raw source material, original diffs and candidate records remain untracked.
Only source links, transformations, manifests and aggregate reports go into Git.
No records enter NeMo fine-tuning without provenance, license and technical
annotation approval. Reserve independent public code-review benchmarks for
separate evaluation rather than training.

### Decision: review expanded CWE coverage

The first Hugging Face source selection returned only 11 candidates from 355 records under a five-CWE scope. We retained the TypeScript/JavaScript focus but added an independent coverage analysis for the remaining CWE categories. New records must meet the same remediation, diff and provenance criteria and must undergo manual review before training. See [CWE Scope Review](CWE_SCOPE_REVIEW.md).
