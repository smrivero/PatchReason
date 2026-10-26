# PatchReason — CWE Scope Review

Status: Scope review pending; no newly selected record is approved for model adaptation.

## Business objective

PatchReason performs evidence-based security review of TypeScript and Node.js code. The initial data selection was restricted to CWE-89, CWE-639, CWE-862, CWE-863 and CWE-915. After reviewing the first Hugging Face intake, we decided to assess coverage across the other application-security CWE categories before finalizing model adaptation data.

This decision is guided by the [OWASP Top 10:2025](https://top10.owasp.org/2025/) and original [MITRE CWE definitions](https://cwe.mitre.org/). OWASP categories are broader than individual CWEs; this document does not claim a one-to-one mapping between them.

## Source and first acquisition

- [Hugging Face: security-vuln-patches](https://huggingface.co/datasets/rgaucher/security-vuln-patches)
- Original records received: 355 (2026-10-26 acquisition; source revision pinned in `results/data_intake/security_vuln_patches.json`)
- Original scope: JavaScript/TypeScript, five CWE categories, code fixes, JS/TS diff sections, size limits and exact patch deduplication
- Initial review candidates: 11 across 10 repositories
- Original `out_of_scope_cwe` exclusion count: 72; these records have not yet passed all remaining inclusion criteria
- Approved data for training: 0

The original exclusion report records the **first exclusion reason per row**, according to the ingestion script's filter order. The 72 CWE exclusions must not be described as 72 otherwise-valid candidates. The new coverage analysis evaluates them against the other conditions and reports how many remain eligible.

## Decision: broaden the review, not automatic approval

All 15 CWE types listed in this source concern application security. We will evaluate the entire set and then prioritize categories with clear Node.js relevance, reliable security evidence and sufficient diversity across repositories.

Example categories worth considering include:

- CWE-79: cross-site scripting
- CWE-22: path traversal
- CWE-78: OS command injection
- CWE-94: code injection
- CWE-287 and CWE-306: authentication failures
- CWE-352: CSRF
- CWE-434: unrestricted file upload
- CWE-502: unsafe deserialization
- CWE-611: XXE
- CWE-798: hard-coded credentials
- CWE-918: SSRF

These examples are **scope candidates**, not a declaration that any upstream record is correct or approved. Preserve the original repository, file, commit, issue lineage, CWE, release revision and licensing evidence before adapting any source material.

## How to reproduce the local coverage review

No GPU, network transfer or new Python dependency is required. Use the originally pinned and downloaded source:

```bash
cd /Users/smrivero/Documents/GitHub/PatchReason
source .venv/bin/activate
python scripts/review_cwe_scope.py
cat results/data_intake/cwe_coverage.json
```

Optionally produce a **separate** private review queue covering all CWEs while retaining the original five-CWE queue unchanged:

```bash
python scripts/review_cwe_scope.py --write-expanded-queue
```

The generated files are:

- `results/data_intake/cwe_coverage.json`: aggregate analysis, checksums, original vs broadened coverage
- `results/data_intake/cwe_coverage.csv`: per-CWE counts and MITRE reference links
- `datasets/private/external/security_vuln_patches/review_queue_expanded.jsonl`: optional private candidates marked `training_approved: false`

The script checks that the original full source hash still matches the initial intake manifest. It also independently reconstructs the original 11-row candidate selection before computing expanded coverage. It never alters `source_original.jsonl`, `review_queue.jsonl` or the earlier results.

## Release and quality gates

1. Review the real distribution of CWEs and surviving patches.
2. Inspect a stratified selection of original commits and confirm the code change fixes the described weakness.
3. Confirm relevant source licenses and retain attribution. Never publish third-party code automatically.
4. Detect shared repositories, CVEs, commits, patch variants and near-duplicates across sources.
5. Freeze an independent evaluation corpus by repository and issue lineage before fitting the adapter.
6. Approve a record for model adaptation only after independent annotation review.

### Known limitations

The upstream source uses LLM-assisted labeling, so record labels remain provisional. The original foundation model's complete training corpus is not public. Avoid claims that a public patch was never observed during Qwen3.5-27B pretraining.
