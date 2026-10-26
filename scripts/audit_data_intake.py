#!/usr/bin/env python3
"""Summarize external-data candidates and flag potential exact/normalized cross-source overlaps."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re


def fingerprint(text):
    return sha256(re.sub(r'\s+', ' ', text).strip().encode('utf-8')).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--inputs', nargs='+', type=Path, default=[Path('datasets/private/external/security_vuln_patches/review_queue.jsonl')])
    ap.add_argument('--report', type=Path, default=Path('results/data_intake/audit.json'))
    args = ap.parse_args()
    records = []
    for path in args.inputs:
        if not path.is_file():
            ap.error('Missing input: ' + str(path))
        records.extend(json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip())
    index = defaultdict(list)
    source_counts = Counter()
    for r in records:
        source_counts[r.get('source_dataset', 'unknown')] += 1
        text = r.get('code_before') or r.get('patch') or ''
        if text:
            index[fingerprint(text)].append({'id': r['id'], 'source': r.get('source_dataset'), 'repo': r.get('repo')})
    duplicates = [v for v in index.values() if len(v) > 1]
    report = {
        'stage': 'external_source_intake_only',
        'rows': len(records),
        'source_counts': dict(sorted(source_counts.items())),
        'unique_repositories': len({r.get('repo', '') for r in records}),
        'exact_normalized_duplicate_groups': duplicates,
        'limits': 'Whitespace-normalized matching does not catch semantic near duplicates, shared CVEs, lineage, or pretraining contamination. Manual and repository/CVE overlap review required.',
        'training_approved_rows': sum(r.get('training_approved') is True for r in records),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'exact_normalized_duplicate_groups'}, indent=2))
    print('Duplicate groups:', len(duplicates))
    print('Report:', args.report.resolve())


if __name__ == '__main__':
    main()
