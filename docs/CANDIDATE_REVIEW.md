# Candidate Review and Security Coverage

## Business context

PatchReason provides private JavaScript/TypeScript security screening with a source-data review pipeline for model adaptation.

The initial release performs binary vulnerability classification. Detailed findings and remediation are planned extensions. This document records the candidate-screening stage; the root README describes the subsequent Qwen3.5-27B adaptation with NVIDIA NeMo AutoModel and LoRA on one NVIDIA B200 Blackwell GPU.

## Why the initial dataset scope changed

The initial intake of [`rgaucher/security-vuln-patches`](https://huggingface.co/datasets/rgaucher/security-vuln-patches) accepted only CWE-89, CWE-639, CWE-862, CWE-863, and CWE-915, producing 11 candidates from 355 source rows. This narrow filter excluded meaningful JavaScript/TypeScript defects.

The October 26, 2026 coverage review considered **all CWE labels available in the source** while preserving checks for actual JavaScript/TypeScript diff sections and `code_fix` remediation type.

Results from the source revision pinned in `results/data_intake/security_vuln_patches.json`:

- Original source records: **355**.
- Initial candidates: **11**.
- Records originally excluded due to CWE scope: **72**.
- Additional candidates after other eligibility criteria: **60**.
- Expanded review queue: **71**.
- Records approved for model adaptation: **0**.

Of the 72 previously out-of-scope records, 12 still failed other checks: six lacked actual JS/TS diff sections and six had non-code remediation. The source collection covers 15 CWE categories; the 71 eligible candidates represent **14 categories** because the result is determined by actual eligible records, not the original source schema.

## Candidate distribution

| CWE | Category | Candidates |
| --- | --- | ---: |
| 287 | Improper authentication | 18 |
| 306 | Missing authentication for critical function | 11 |
| 79 | Cross-site scripting | 8 |
| 94 | Code injection | 6 |
| 862 | Missing authorization | 6 |
| 434 | Unrestricted dangerous file upload | 6 |
| 352 | Cross-site request forgery | 4 |
| 798 | Hard-coded credentials | 3 |
| 863 | Incorrect authorization | 3 |
| 89 | SQL injection | 2 |
| 22 | Path traversal | 1 |
| 78 | OS command injection | 1 |
| 611 | XML external entity processing | 1 |
| 918 | Server-side request forgery | 1 |
| **Total** | | **71** |

Authentication and authorization (CWE-287/306/862/863) account for **38/71** cases (~53.5%). This skew must not be mistaken for representative real-world risk prevalence. It creates an incentive to curate broader coverage from independent repositories rather than simply oversample repeated patches.

## Acceptance policy

1. Retain upstream dataset ID, pinned revision, repository, commit SHA, changed file paths, CWE and original URL.
2. Inspect the actual unsafe behavior and confirm that the patch remediates the claimed weakness. A CWE assigned by an external automated annotator is a review cue, not ground truth.
3. Prefer specific CWE identifiers where supported by the code. [MITRE discourages mapping vulnerabilities directly to CWE-287](https://cwe.mitre.org/data/definitions/287.html) when a more specific descendant applies.
4. Reconstruct vulnerable and corrected source context from a provenance-verified commit when needed. A unified diff alone is not the final model input.
5. Record upstream source license and data reuse rights. The [Hugging Face dataset card](https://huggingface.co/datasets/rgaucher/security-vuln-patches) lists MIT, which does not automatically cover every referenced upstream repository.
6. Check exact and semantic overlap across CVEs, repositories, commit histories, duplicate code and related datasets; avoid placing related material on opposite sides of evaluation boundaries.
7. Include properly verified benign cases and hard negatives to measure false alarms.
8. Keep final evaluation sources separate from model-adaptation material. Foundation-model pretraining overlap cannot be ruled out from public source dates alone.
9. Only reviewed, appropriately licensed items with validated annotations may be approved for model adaptation.

## Worklist generation

From the repository root on macOS:

```bash
source .venv/bin/activate
python3 scripts/prepare_candidate_review.py
cat results/data_intake/candidate_review_summary.json
```

This produces a metadata-only worklist in `results/data_intake/candidate_review_worklist.csv`. The utility does **not** approve anything, change the private source collection, export code, or overwrite an existing manually edited worklist. The original expanded queue remains in `datasets/private/external/security_vuln_patches/` and is excluded from Git.

## Future sources and quality gates

Expand coverage with [CVEfixes](https://github.com/secureIT-project/CVEfixes) and selected [Security Vulnerability Fix Patches](https://huggingface.co/datasets/rgaucher/security-vuln-patches), with repository/CVE-level duplicate checks. Reserve [ReviewBench](https://github.com/review-bench/ReviewBench) for independent product evaluation. Prioritize defensible, traceable examples over sheer volume.

Related industry reference: [OWASP Top 10:2025](https://top10.owasp.org/2025/).

The worklist is a **review inventory**, not a finalized training dataset. This queue is separate from the binary training and evaluation workflow documented in the root README.
