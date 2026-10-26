# PatchReason — Illustrative Client Requirement

**Engagement type:** Fictional client scenario used to define a realistic software-delivery objective. No actual customer or commercial deployment is claimed.

## Situation

A mid-sized company runs TypeScript and Node.js API services and handles frequent pull requests. Security-sensitive changes may bypass review attention during periods of high development volume. The engineering lead requests assisted review before a change is merged.

## Requested solution

A developer-facing service that accepts source code or a diff and returns concise, explainable findings with severity, location, CWE classification where applicable, and proposed remediation. The service must also correctly return zero findings for safe code.

## Intended users

Backend developers, engineering leads, application security engineers and pull-request reviewers.

## Functional requirements

FR-01: Accept TypeScript/Node.js code snippets and eventually unified diffs.
FR-02: Identify authorization, injection and unsafe update flaws within supported scope.
FR-03: Report evidence, CWE, severity and remediation in a machine-readable response.
FR-04: Allow a reviewer to view and compare baseline versus adapted-model responses.
FR-05: Track provenance and adjudication for labelled training and evaluation examples.
FR-06: Provide an API suitable for future pull-request automation.

## Non-functional requirements

NFR-01: No code execution of submitted snippets in the inference service.
NFR-02: Never send private code to an unapproved third-party endpoint.
NFR-03: Store secrets outside version control.
NFR-04: Record model, adapter, prompts, dataset version and inference configuration for every benchmark.
NFR-05: Export evidence and quality/performance metrics in reproducible formats.

## Proposed acceptance criteria

Compare an optimized-prompt baseline and an adapted model on the same held-out examples. Report finding-level precision, recall, F1 and false-positive rate. Track JSON schema compliance and human review of proposed fixes. No quality uplift or deployment readiness is assumed in advance.

## Delivery phases

1. Requirement definition and data curation.
2. Baseline inference and evaluation.
3. LoRA adaptation on NVIDIA B200 using NeMo AutoModel.
4. Independent evaluation and performance characterization.
5. Comparison UI, API integration and documented handoff.
