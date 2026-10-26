# PatchReason — Data Acquisition Release

This update adds source ingestion and data-quality tooling to the existing PatchReason repository. It does not overwrite existing training, README, evaluation or deployment files.

## Files

- `scripts/ingest_hf_security_patches.py`
- `scripts/ingest_cvefixes_sqlite.py`
- `scripts/audit_data_intake.py`
- `scripts/register_ingestion_docs.py`
- `docs/DATA_INGESTION.md`
- `requirements-data.txt`

## Apply from your Mac

```bash
cd /Users/smrivero/Documents/GitHub/PatchReason
unzip -o ~/Downloads/PatchReason-ingestion-v3.zip -d .
python3 scripts/register_ingestion_docs.py
python3 --version
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-data.txt
python scripts/ingest_hf_security_patches.py
python scripts/audit_data_intake.py
cat results/data_intake/security_vuln_patches.json
```

Inspect aggregates and diff before committing:

```bash
git status --short
git diff -- README.md docs/DECISIONS.md
git diff --check
```

Commit the pipeline and reports (only if aggregate reports contain no restricted data):

```bash
git add README.md docs/DECISIONS.md docs/DATA_INGESTION.md \
  scripts/ingest_hf_security_patches.py scripts/ingest_cvefixes_sqlite.py \
  scripts/audit_data_intake.py scripts/register_ingestion_docs.py \
  requirements-data.txt docs/START_DATA_INGESTION.md results/data_intake/*.json

git commit -m "Add traceable public security dataset intake pipeline"
git push origin main
```

`datasets/private/` is already excluded by `.gitignore`. Nothing from that folder should be force-added.
