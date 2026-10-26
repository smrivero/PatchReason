#!/usr/bin/env python3
"""Add versioned links and a decision note without replacing existing documentation."""
from pathlib import Path

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
marker = '## External dataset intake\n'
if marker not in text:
    text = text.rstrip() + '''\n\n## External dataset intake\n\nPatchReason ingests public-source vulnerability-fix records into a private review queue.\nThe ingestion scripts preserve provenance and source revisions. Ingested data are\n**not** automatically labelled as approved training examples. Dataset metadata\nmay be committed; unreviewed upstream code stays outside Git.\n\n- [Ingestion workflow and commands](docs/DATA_INGESTION.md)\n- [Data-source rationale](docs/DATASET_SOURCES.md)\n- [Curation methodology](docs/DATASET_METHODOLOGY.md)\n\nNo measured fine-tuning improvements or externally sourced training records are\nclaimed until their provenance and annotation status have been verified.\n'''
    readme.write_text(text, encoding='utf-8')

decisions = Path('docs/DECISIONS.md')
text = decisions.read_text(encoding='utf-8')
marker = '### External source intake: pinned revisions and review queue'
if marker not in text:
    text = text.rstrip() + '''\n\n### External source intake: pinned revisions and review queue\n\nDecision date: 2026-10-26.\n\nUse Hugging Face Security Vulnerability Fix Patches as the first lightweight\nsource of code-change candidates. Resolve and record a Hugging Face commit SHA.\nCheck actual changed JS/TS file paths because the declared language label can\ndiffer from the patched files. Prefer the official CVEfixes SQLite archive for\nadditional CVE-linked source, but ingest it separately due to download size\nand different annotation semantics.\n\nRaw source material, original diffs and candidate records remain untracked.\nOnly source links, transformations, manifests and aggregate reports go into Git.\nNo records enter NeMo fine-tuning without provenance, license and technical\nannotation approval. Reserve independent public code-review benchmarks for\nseparate evaluation rather than training.\n'''
    decisions.write_text(text, encoding='utf-8')
print('README.md and docs/DECISIONS.md are up to date.')
