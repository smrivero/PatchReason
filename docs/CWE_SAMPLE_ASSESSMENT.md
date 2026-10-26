# CWE Sample Assessment — PatchReason

## Purpose and scope

This engineering assessment examines **14 representative code-change excerpts**, one per selected CWE category, supplied as `cwe_examples.md`. These excerpts were selected from an intake of **71 review candidates** derived from [Security Vulnerability Fix Patches](https://huggingface.co/datasets/rgaucher/security-vuln-patches). The excerpt set is **not the entire 71-record intake**.

This review evaluates whether the *visible changes* support their security labels. It does not claim to validate every upstream pull request, reconstruct full vulnerable-to-fixed states, or establish model-training eligibility. All candidates remain unapproved for fine-tuning and final scoring.

## Decision terminology

- `hold_unsupported_label`: The provided change does not provide adequate evidence for the stated CWE. Set aside from the candidate pool pending independent source-level verification and, if appropriate, a new annotation.
- `review_source`: A security-related change is plausible, but the source issue, pull-request context, trust boundary and actual remediation must be confirmed before acceptance.

No row is marked as an accepted training example.

## Findings

| CWE | Repository | Preliminary status | Visible evidence and limitation |
|---|---|---|---|
| [CWE-22](https://github.com/n8n-io/n8n/pull/18889) | `n8n-io/n8n` | `hold_unsupported_label` | SSH path normalization, escaping and private-key file permissions are shown; the excerpt does not establish a path traversal defect. |
| [CWE-78](https://github.com/jeffcaldwellca/mkcertWeb/pull/19) | `jeffcaldwellca/mkcertWeb` | `review_source` | A shell-command allowlist was introduced before exec(); potential command-injection mitigation, but command sources and bypass conditions require verification. |
| [CWE-79](https://github.com/JU-DEV-Bootcamps/ERAS-FE/pull/159) | `JU-DEV-Bootcamps/ERAS-FE` | `hold_unsupported_label` | ApexCharts tooltip formatting was changed to interpolate labels into HTML. The excerpt does not show XSS remediation; direct interpolation may create an HTML-injection risk. |
| [CWE-89](https://github.com/Ali-Khan04/complaint-management-system/pull/1) | `Ali-Khan04/complaint-management-system` | `hold_unsupported_label` | A broad migration from parameterized MSSQL requests to Sequelize is visible. The removed requests already use bound parameters; a specific SQL-injection fix is not established. |
| [CWE-94](https://github.com/akaday/react/pull/20) | `akaday/react` | `review_source` | Dynamically generated inline JavaScript imports were replaced by script.src assignment. This may reduce code-construction risk, but trust boundaries for src remain unknown. |
| [CWE-287](https://github.com/govuk-one-login/ipv-cri-check-hmrc-front/pull/356) | `govuk-one-login/ipv-cri-check-hmrc-front` | `review_source` | A middleware requiring expected session fields was added to a route. The change plausibly addresses an authentication workflow gap, subject to confirmation of the original risk and middleware placement. |
| [CWE-306](https://github.com/pra719/final-repo/pull/3) | `pra719/final-repo` | `review_source` | The client switched from plain axios to a configured axiosInstance. Authentication effects depend on the axiosInstance implementation and the server-side authorization policy, neither shown. |
| [CWE-352](https://github.com/PhotonEntangled/LoadUp/pull/2) | `PhotonEntangled/LoadUp` | `review_source` | CSRF middleware was introduced for routes outside /api. Applicability to affected state-changing cookie-authenticated routes must be confirmed; API routes are exempted. |
| [CWE-434](https://github.com/Planning-Inspectorate/appeals-back-office/pull/1437) | `Planning-Inspectorate/appeals-back-office` | `hold_unsupported_label` | Browser-side file type recognition now falls back to a filename extension. This alone does not demonstrate server-side upload restrictions or remediation of dangerous file upload. |
| [CWE-611](https://github.com/zdavatz/amiko-web/pull/133) | `zdavatz/amiko-web` | `hold_unsupported_label` | Prescription JSON/IndexedDB import refactor contains no identifiable XML external entity configuration or XXE mitigation. |
| [CWE-798](https://github.com/Planning-Inspectorate/appeals-back-office/pull/54) | `Planning-Inspectorate/appeals-back-office` | `hold_unsupported_label` | Dynamic innerHTML construction was replaced by DOM creation and textContent; this resembles output-encoding/XSS mitigation, not removal of hard-coded credentials. |
| [CWE-862](https://github.com/hashicorp/boundary-ui/pull/3013) | `hashicorp/boundary-ui` | `hold_unsupported_label` | A frontend component dispatches to credential-library form types. No enforcement of an authorization check is visible. |
| [CWE-863](https://github.com/Resgrid/Core/pull/152) | `Resgrid/Core` | `review_source` | Role-management UI uses a corrected permission type identifier for View Group Users. May fix incorrect mapping, but backend enforcement and the original permission defect must be verified. |
| [CWE-918](https://github.com/airqo-platform/AirQo-api/pull/4856) | `airqo-platform/AirQo-api` | `hold_unsupported_label` | URL validation limits protocol, form, and length, but does not establish defenses against loopback/private networks, DNS rebinding, or server-side URL fetches. Not an evidenced SSRF correction. |


## Key quality findings

1. A real GitHub code change is not necessarily a security correction, even if a dataset labels it `confirmed`.
2. A pull request may include broad unrelated refactoring. A training pair must isolate the relevant defect and its resolution rather than use the full diff by default.
3. `CWE-798` in this sample contains DOM manipulation that is more closely related to XSS mitigation, while `CWE-79` introduces raw interpolated tooltip HTML. This shows why independently reviewing the security mechanism matters.
4. `CWE-89` is a large data-access migration: its old code already uses `.input(...)` bound parameters in the visible excerpt. Migrating to an ORM does not by itself prove SQL injection was fixed.
5. `CWE-918` validates URL syntax, which does not alone mitigate SSRF against internal resources.
6. Code licenses and third-party redistribution constraints must be checked separately before publishing excerpts or derivative training data. This metadata-only report does not republish code from the upstream sources.

## Required acceptance evidence

For each candidate, record the upstream pull request and its title/description, relevant commits and parent revisions, the specific vulnerable code path, trust-boundary analysis, a security-relevant behavior change, a minimal pre-fix input, a verified fixed behavior, license status, dataset duplication checks, and review decision.

Any records for model fine-tuning must be separated from final evaluation by repository lineage, CWE and patch similarity. Upstream classification alone is not sufficient to define ground truth.

## Reproducibility and local privacy

- Machine-readable decisions: `datasets/sample_cwe_assessment.json`.
- Counts: `python3 scripts/summarize_sample_cwe_assessment.py`.
- Source excerpts remain under `datasets/private/` and should stay outside the public repository.
- No classification in this document claims a security defect has been definitively verified or disproven from the diff alone.
