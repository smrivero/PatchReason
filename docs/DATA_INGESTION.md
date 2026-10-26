# PatchReason — External Source Intake

Status: Implemented intake scripts; no external record is approved for model adaptation.

## Business requirement

PatchReason specializes Qwen3.5-27B for security-focused reviews of TypeScript/Node.js code. The purpose of the collection process is to produce a traceable, curated selection of real source-code security changes and safe counterexamples. The record-selection stage is distinct from model training and independent evaluation.

## Source selection and interpretation

1. [Security Vulnerability Fix Patches on Hugging Face](https://huggingface.co/datasets/rgaucher/security-vuln-patches) is the first intake source: 355 public GitHub patches, including rows *labelled* JavaScript or TypeScript. The source card records a model-assisted validation process; its findings must not be treated as human-verified security labels. Important: actual modified file extensions can disagree with dataset-level `language` metadata. The script inspects each `diff --git` section and retains only JS/TS sections.
2. [CVEfixes](https://github.com/secureIT-project/CVEfixes) links CVEs, fixing commits, file changes and before/after code. The [official database archive](https://doi.org/10.5281/zenodo.4476563) is on Zenodo; see [installation instructions](https://github.com/secureIT-project/CVEfixes/blob/main/INSTALL.md) and [schema dictionary](https://github.com/secureIT-project/CVEfixes/blob/main/Doc/DataDictionary.md). CVE-related commits can modify code unrelated to the security defect. Do not equate every changed file with a verified vulnerability.
3. [JS Vulnerability Detection Dataset](https://huggingface.co/datasets/sijjeel/js-vuln-dataset) and [JsVul](https://github.com/jsvul/jsvul) remain deferred because of upstream overlap with CVEfixes and less consistent provenance.
4. [ReviewBench](https://github.com/review-bench/ReviewBench) and [SWE-PRBench](https://huggingface.co/datasets/foundry-ai/swe-prbench) are reserved exclusively for independent evaluation; no benchmark reference answers are used for fine-tuning, adapter selection or prompt tuning.

## Local prerequisites

macOS, Python 3.10+ and `git`. No GPU, CUDA, NVIDIA NeMo, Docker or Vast.ai instance is needed for source intake. Use Python's `venv` and the official macOS installer from [python.org](https://www.python.org/downloads/macos/) if your current Python version is older. Do not install dependencies globally.

```bash
cd /Users/smrivero/Documents/GitHub/PatchReason
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-data.txt
```

## A. Ingest Hugging Face patches

The ingestion uses the Hugging Face `HfApi` to resolve the current source revision SHA, then `datasets.load_dataset` with that revision so the full data is used (rather than potentially truncated previews from the dataset viewer).

```bash
python scripts/ingest_hf_security_patches.py
python scripts/audit_data_intake.py
cat results/data_intake/security_vuln_patches.json
cat results/data_intake/audit.json
```

Outputs:

- `datasets/private/external/security_vuln_patches/source_original.jsonl`: original source records, including upstream author information; never commit or publish without rights review.
- `datasets/private/external/security_vuln_patches/review_queue.jsonl`: JS/TS code changes that match the selected CWEs, marked `training_approved: false`.
- `results/data_intake/security_vuln_patches.json`: aggregate intake report, resolved source revision, counts and hashes; safe to review for Git publication.
- `results/data_intake/audit.json`: overlap summary, not a full semantic-duplicate audit.

Default CWE scope: 89, 862, 863, 639, 915. Other categories can be inspected without changing code:

```bash
python scripts/ingest_hf_security_patches.py --cwes all
```

Only *code-fix* patches are considered. The script excludes records without supported JS/TS file sections, empty diffs, minified JavaScript, oversized patches and exact duplicate patches. It does **not** interpret a patch as an independent verified training target.

If there are few relevant records in the first source, that is a reason to expand source selection or refine scope, not to fabricate a sample count.

## B. Ingest CVEfixes from the official SQLite database

CVEfixes' dataset is distributed separately from its GitHub code. Open the [Zenodo archive](https://doi.org/10.5281/zenodo.4476563), choose the version to preserve, download its SQL dump on your Mac, and record the version in the collection report. Depending on the archive, file sizes can be substantial. Do not start a full recollection from GitHub when an official database dump is available.

After placing the compressed SQL file at `datasets/private/external/cvefixes/CVEfixes.sql.gz`:

```bash
mkdir -p datasets/private/external/cvefixes
# Convert the official dump to SQLite (long-running on large archives):
gzip -dc datasets/private/external/cvefixes/CVEfixes.sql.gz | \
  sqlite3 datasets/private/external/cvefixes/CVEfixes.db

python scripts/ingest_cvefixes_sqlite.py \
  --database datasets/private/external/cvefixes/CVEfixes.db \
  --max-records 1000

python scripts/audit_data_intake.py --inputs \
  datasets/private/external/security_vuln_patches/review_queue.jsonl \
  datasets/private/external/cvefixes/review_queue.jsonl
```

The extraction operates read-only on SQLite and selects JS/TS changes with before/after code and CWE association. It keeps only reasonably sized records for manual annotation. Changes may occur in vulnerability-fixing commits without themselves being vulnerable.

## Integrity, contamination and quality gates

- Preserve upstream source revision SHA or release, source link, original repository, commit, CWE/CVE, file paths and full record hashes.
- Make a source-license review of the original repositories before distributing any code or admitting records for training. The Hugging Face dataset's MIT metadata does not supersede original repositories' licensing conditions.
- Remove exact, normalized and near duplicates across sources and partitions; group by originating repository and CVE/commit lineage. The automated audit currently detects only whitespace-normalized duplicates.
- Independently assess CWE attribution, affected line, vulnerable pre-fix behavior, evidence, severity and remediation. Reject ambiguous changes. A fixed file is not automatically a secure negative example.
- Separate training and validation from independent evaluation by repository and issue lineage. Freeze holdout records before tuning.
- The foundation model's full pretraining dataset is not public; absence from Qwen3.5-27B pretraining cannot be guaranteed. Record this residual risk in project documentation.
- Never publish raw records or credentials through Git. Store only scripts, decisions and aggregate manifests. Source intake is **not** equivalent to a training-ready corpus.

## Next delivery milestone

Review the intake reports, inspect a small stratified selection of records against original GitHub commits, document licensing and annotation decisions, and only then convert approved records to the PatchReason `input`/`expected.findings` schema. The initial 36 synthetic examples, if present, remain separate schema references rather than measured evidence.
