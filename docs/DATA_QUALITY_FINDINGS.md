# Data Quality Findings

## Purpose

PatchReason performs source-level verification before accepting
security vulnerability annotations for model fine-tuning.

A public dataset label alone does not establish that a code change
addresses the stated weakness.

## Finding 001: Unsupported CWE-611 Classification

**Source:** [AmiKo-Web PR #133](https://github.com/zdavatz/amiko-web/pull/133)

**Upstream dataset:** [Security Vulnerability Fix Patches](https://huggingface.co/datasets/rgaucher/security-vuln-patches)

**Original classification:** CWE-611, XML External Entity (XXE)

**Decision:** Rejected from the training candidate selection.

### Evidence

The original issue and pull request describe an application feature
for importing prescription data using JSON and IndexedDB.

The code changes involve cross-window communication, prescription
processing, origin handling, and the import workflow.

No XML external entity vulnerability remediation could be established
from the documented changes.

The pull request is associated with commit 70936df and merge commit
f8d7cd3.

### Engineering decision

Retain upstream provenance and the rejection decision.

Exclude the record from fine-tuning and final scoring.

Do not automatically reclassify it as another security weakness.

### Reproducibility

Run:

    python3 scripts/apply_curation_decisions.py

This produces an updated local candidate selection without modifying
the original source dataset.
