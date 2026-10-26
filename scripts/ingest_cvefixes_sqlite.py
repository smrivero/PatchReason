#!/usr/bin/env python3
"""Select provenance-rich JS/TS vulnerability-fix records from a local CVEfixes SQLite database.

The official compressed SQL dump must first be downloaded from Zenodo and imported
locally into SQLite. Nothing in this script downloads third-party source code.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import sqlite3

EXTENSIONS = ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')
DEFAULT_CWES = {89, 862, 863, 639, 915}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--database', type=Path, required=True, help='CVEfixes.db generated from official Zenodo SQL dump')
    ap.add_argument('--out', type=Path, default=Path('datasets/private/external/cvefixes'))
    ap.add_argument('--report', type=Path, default=Path('results/data_intake/cvefixes.json'))
    ap.add_argument('--max-records', type=int, default=1000)
    ap.add_argument('--max-code-chars', type=int, default=12000)
    ap.add_argument('--min-code-chars', type=int, default=100)
    ap.add_argument('--cwes', default='89,862,863,639,915', help='Comma-separated IDs or all')
    args = ap.parse_args()
    if not args.database.is_file():
        ap.error('Database missing: ' + str(args.database))
    accepted = None if args.cwes.lower() == 'all' else {int(x.strip()) for x in args.cwes.split(',')}
    uri = args.database.resolve().as_uri() + '?mode=ro'
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    required = {'fixes', 'file_change', 'cwe_classification'}
    available = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not required.issubset(available):
        raise SystemExit('Unexpected CVEfixes schema; missing: ' + ', '.join(sorted(required - available)))
    statement = '''
    SELECT fx.cve_id, fx.hash AS commit_sha, fx.repo_url, fc.file_change_id,
           fc.filename, fc.programming_language, fc.code_before, fc.code_after,
           fc.diff, cc.cwe_id
    FROM fixes fx
    JOIN file_change fc ON fc.hash = fx.hash
    JOIN cwe_classification cc ON cc.cve_id = fx.cve_id
    WHERE (lower(fc.filename) LIKE '%.js' OR lower(fc.filename) LIKE '%.jsx'
        OR lower(fc.filename) LIKE '%.ts' OR lower(fc.filename) LIKE '%.tsx'
        OR lower(fc.filename) LIKE '%.mjs' OR lower(fc.filename) LIKE '%.cjs')
      AND fc.code_before IS NOT NULL AND fc.code_after IS NOT NULL
    ORDER BY fx.cve_id, fx.hash, fc.file_change_id, cc.cwe_id
    '''
    candidates, rejected = [], Counter()
    fingerprints = set()
    for row in conn.execute(statement):
        row = dict(row)
        filename = row['filename'] or ''
        if filename.lower().endswith('.min.js'):
            rejected['minified_file'] += 1
            continue
        raw_cwe = str(row['cwe_id'] or '').upper()
        match = re.search(r'\d+', raw_cwe)
        if not match:
            rejected['unknown_cwe'] += 1
            continue
        cwe_id = int(match.group())
        if accepted is not None and cwe_id not in accepted:
            rejected['out_of_scope_cwe'] += 1
            continue
        before, after = str(row['code_before']), str(row['code_after'])
        if len(before) < args.min_code_chars or len(before) > args.max_code_chars or len(after) > args.max_code_chars:
            rejected['code_length'] += 1
            continue
        if before == after:
            rejected['unchanged_code'] += 1
            continue
        ref = (row['repo_url'], row['commit_sha'], filename, sha256(before.encode('utf-8')).hexdigest(), cwe_id)
        if ref in fingerprints:
            rejected['duplicate_record'] += 1
            continue
        fingerprints.add(ref)
        rid = sha256(json.dumps(ref).encode('utf-8')).hexdigest()[:20]
        candidates.append({
            'id': 'cvefixes-' + rid,
            'source_dataset': 'CVEfixes',
            'source_dataset_release': 'local_sqlite_dump; version requires external verification',
            'repo': row['repo_url'],
            'commit_sha': row['commit_sha'],
            'file_path': filename,
            'file_change_id': row['file_change_id'],
            'cve_id': row['cve_id'],
            'cwe': 'CWE-' + str(cwe_id),
            'code_before': before,
            'code_after': after,
            'diff': row['diff'],
            'code_before_sha256': sha256(before.encode('utf-8')).hexdigest(),
            'code_after_sha256': sha256(after.encode('utf-8')).hexdigest(),
            'annotation_status': 'requires_independent_human_review',
            'license_status': 'pending_upstream_code_review',
            'training_approved': False,
        })
        if len(candidates) >= args.max_records:
            break
    conn.close()
    args.out.mkdir(parents=True, exist_ok=True)
    out_file = args.out / 'review_queue.jsonl'
    with out_file.open('w', encoding='utf-8') as out:
        for item in candidates:
            out.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + '\n')
    manifest = {
        'project': 'PatchReason', 'stage': 'external_source_intake_only',
        'source_url': 'https://doi.org/10.5281/zenodo.4476563',
        'local_database': args.database.name,
        'local_database_bytes': args.database.stat().st_size,
        'collected_at_utc': datetime.now(timezone.utc).isoformat(),
        'review_candidates': len(candidates),
        'candidate_cwes': dict(sorted(Counter(c['cwe'] for c in candidates).items())),
        'candidate_repositories': len({c['repo'] for c in candidates}),
        'exclusions': dict(sorted(rejected.items())),
        'candidates_sha256': sha256(out_file.read_bytes()).hexdigest(),
        'review_notice': 'Vulnerability-fixing commits can include unrelated file edits. The extracted code is not yet adjudicated as vulnerable or secure.',
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('CVEfixes candidates:', len(candidates), '| repositories:', manifest['candidate_repositories'])
    print('Private records:', out_file.resolve())
    print('Shareable metadata:', args.report.resolve())


if __name__ == '__main__':
    main()
