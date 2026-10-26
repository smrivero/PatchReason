#!/usr/bin/env python3
"""Prepare a provenance-only security patch review worklist for PatchReason.

Never approves examples for training; never exports source code or patch bodies.
Input is the private expanded queue created by review_cwe_scope.py.
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlparse

INPUT = Path('datasets/private/external/security_vuln_patches/review_queue_expanded.jsonl')
OUTPUT = Path('results/data_intake/candidate_review_worklist.csv')
REPORT = Path('results/data_intake/candidate_review_summary.json')
CWE_GROUPS = {
    'CWE-89': 'injection', 'CWE-79': 'injection', 'CWE-94': 'injection',
    'CWE-78': 'injection', 'CWE-22': 'filesystem', 'CWE-918': 'request_forgery',
    'CWE-287': 'authentication', 'CWE-306': 'authentication',
    'CWE-862': 'authorization', 'CWE-863': 'authorization', 'CWE-639': 'authorization',
    'CWE-352': 'request_forgery', 'CWE-434': 'file_upload',
    'CWE-798': 'credentials', 'CWE-611': 'xml', 'CWE-915': 'mass_assignment'
}
FIELDS = [
    'candidate_id', 'source', 'source_row_index', 'repository', 'source_url',
    'commit_sha', 'cwe', 'cwe_name', 'risk_group', 'changed_files',
    'review_priority', 'review_status', 'issue_verified', 'fix_verified',
    'license_reviewed', 'source_code_access', 'reviewer_notes'
]


def read_jsonl(p: Path) -> list[dict]:
    with p.open(encoding='utf-8') as f:
        return [json.loads(line) for line in f if line.strip()]


def csv_safe(value) -> str:
    """Avoid spreadsheet formula interpretation of arbitrary upstream metadata."""
    s = str(value or '').replace('\r', ' ').replace('\n', ' ')
    if s.lstrip().startswith(('=', '+', '-', '@')):
        return "'" + s
    return s


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', type=Path, default=INPUT)
    p.add_argument('--output', type=Path, default=OUTPUT)
    p.add_argument('--report', type=Path, default=REPORT)
    p.add_argument('--replace', action='store_true', help='Replace an existing worklist (discards manual edits).')
    args = p.parse_args()

    if not args.input.is_file():
        p.error(f'Missing private queue: {args.input}. Run review_cwe_scope.py --write-expanded-queue first.')
    if args.output.exists() and not args.replace:
        p.error(f'{args.output} exists. Preserving human edits. Use --replace explicitly to recreate.')

    items = read_jsonl(args.input)
    if not items:
        p.error('Expanded queue has zero records.')
    if len({r.get('id') for r in items}) != len(items):
        p.error('Duplicate candidate identifiers; resolve before manual review.')

    counts = Counter(r.get('cwe', 'unknown') for r in items)
    repo_counts = Counter(r.get('repo', 'unknown') for r in items)
    out_rows = []
    for r in sorted(items, key=lambda a: (counts[a.get('cwe', 'unknown')], a.get('cwe', ''), a.get('repo', ''), a.get('id', ''))):
        cwe = r.get('cwe', '')
        repo = r.get('repo') or ''
        flags = []
        if cwe == 'CWE-287':
            flags.append('MITRE: prefer a more specific CWE if applicable')
        if repo_counts[repo] > 1:
            flags.append('multiple candidates from same repository: check lineage')
        files = r.get('files', [])
        if not isinstance(files, list):
            files = [files]
        priority = 'high' if counts[cwe] <= 3 else 'normal'
        data = {
            'candidate_id': r.get('id', ''),
            'source': r.get('source_dataset', ''),
            'source_row_index': r.get('source_row_index', ''),
            'repository': repo,
            'source_url': r.get('source_url') or '',
            'commit_sha': r.get('commit_sha') or '',
            'cwe': cwe,
            'cwe_name': r.get('cwe_name') or '',
            'risk_group': CWE_GROUPS.get(cwe, 'other'),
            'changed_files': '; '.join(files),
            'review_priority': priority,
            'review_status': 'pending',
            'issue_verified': 'pending',
            'fix_verified': 'pending',
            'license_reviewed': 'pending',
            'source_code_access': 'pending',
            'reviewer_notes': '; '.join(flags),
        }
        out_rows.append({k: csv_safe(data[k]) for k in FIELDS})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8', newline='') as out:
        w = csv.DictWriter(out, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out_rows)

    report = {
        'project': 'PatchReason',
        'stage': 'candidate_manual_review',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'source_queue': str(args.input),
        'source_candidates': len(items),
        'unique_repositories': len(repo_counts),
        'distinct_cwe_categories': len(counts),
        'cwe_counts': dict(sorted(counts.items())),
        'risk_group_counts': dict(sorted(Counter(CWE_GROUPS.get(r.get('cwe', ''), 'other') for r in items).items())),
        'duplicate_repository_candidate_count': sum(n for n in repo_counts.values() if n > 1),
        'pending_human_review': len(items),
        'training_approved_rows': 0,
        'privacy': 'CSV includes upstream metadata but contains no raw source code or patch bodies.',
        'limitations': 'No label, fix, original-file context, license, or pretraining independence has been independently validated.',
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Candidates:', len(items))
    print('Unique repositories:', len(repo_counts))
    print('CWE categories:', len(counts))
    print('CWE distribution:', dict(sorted(counts.items())))
    print('Worklist:', args.output)
    print('Summary:', args.report)
    print('Approved for training: 0')


if __name__ == '__main__':
    main()
