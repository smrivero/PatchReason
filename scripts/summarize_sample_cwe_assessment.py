#!/usr/bin/env python3
"""Summarize PatchReason's metadata-only CWE source assessment."""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'datasets/sample_cwe_assessment.json').read_text())
entries = data['entries']
assert len(entries) == 14, 'Expected fourteen representatives'
assert len({row['cwe'] for row in entries}) == 14, 'CWE categories repeated'
assert all(row['source_url'].startswith('https://github.com/') for row in entries)
counts = Counter(row['status'] for row in entries)
print('PatchReason — preliminary source assessment')
print('Representative changes:', len(entries))
for status, count in sorted(counts.items()):
    print(f'{status}: {count}')
print('Approved for training:', data['approved_for_training'])
print('Scope: 14 representatives, not the full 71-candidate set')
