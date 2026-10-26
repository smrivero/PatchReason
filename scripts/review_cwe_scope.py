#!/usr/bin/env python3
"""Review all CWE categories in the pinned PatchReason Hugging Face source.

Reads local upstream JSONL; does not download or change existing intake files.
Produces aggregate CWE coverage reports and optionally a separate private queue.
This step does not approve any external data for model adaptation.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
from hashlib import sha256
import json
from pathlib import Path
import sys

# Use the exact JS/TS diff-section extraction as the existing intake pipeline.
from ingest_hf_security_patches import extract_js_ts_sections

BASELINE_CWES = {89, 639, 862, 863, 915}
SOURCE_ID = 'rgaucher/security-vuln-patches'
DEFAULT_SOURCE = Path('datasets/private/external/security_vuln_patches/source_original.jsonl')
DEFAULT_MANIFEST = Path('results/data_intake/security_vuln_patches.json')
DEFAULT_ORIGINAL_QUEUE = Path('datasets/private/external/security_vuln_patches/review_queue.jsonl')
DEFAULT_EXPANDED_QUEUE = Path('datasets/private/external/security_vuln_patches/review_queue_expanded.jsonl')
DEFAULT_JSON = Path('results/data_intake/cwe_coverage.json')
DEFAULT_CSV = Path('results/data_intake/cwe_coverage.csv')


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def cwe_number(value) -> int | None:
    try:
        return int(str(value or '').upper().replace('CWE-', '').strip())
    except (TypeError, ValueError):
        return None


def gather(rows: list[dict], allowed_cwes: set[int] | None, max_patch_chars: int):
    """Match existing intake filter order and its first-reason exclusion logic."""
    accepted, reasons, seen = [], {}, set()
    for i, row in enumerate(rows):
        lang = str(row.get('language') or '').lower()
        cwe = cwe_number(row.get('cwe_id'))
        reason = None
        if lang not in {'javascript', 'typescript'}:
            reason = 'language_not_js_ts'
        elif cwe is None:
            reason = 'missing_cwe_id'
        elif allowed_cwes is not None and cwe not in allowed_cwes:
            reason = 'out_of_scope_cwe'
        elif row.get('remediation_class') != 'code_fix':
            reason = 'non_code_remediation'
        else:
            diff = str(row.get('diff') or '')
            if not diff:
                reason = 'missing_diff'
            else:
                sections = extract_js_ts_sections(diff)
                if not sections:
                    reason = 'no_js_ts_file_in_patch'
                else:
                    patch = ''.join(section for _, section in sections)
                    if len(patch) > max_patch_chars:
                        reason = 'oversized_diff'
                    else:
                        patch_hash = sha256(patch.encode('utf-8')).hexdigest()
                        if patch_hash in seen:
                            reason = 'duplicate_patch'
                        else:
                            # Existing pipeline marks the patch as seen before validating repo.
                            seen.add(patch_hash)
                            repo = str(row.get('repo') or '').strip()
                            if not repo:
                                reason = 'missing_repo'
                            else:
                                uid = sha256((repo + '\0' + str(row.get('commit_sha') or '') + '\0' + patch_hash).encode('utf-8')).hexdigest()[:20]
                                accepted.append({
                                    'id': 'hf-patches-' + uid,
                                    'source_dataset': SOURCE_ID,
                                    'source_row_index': i,
                                    'repo': repo,
                                    'source_url': row.get('url'),
                                    'commit_sha': row.get('commit_sha') or None,
                                    'commit_date': row.get('commit_date') or None,
                                    'language_declared': lang,
                                    'files': sorted({f for f, _ in sections}),
                                    'cwe': f'CWE-{cwe}',
                                    'cwe_name': row.get('cwe_name'),
                                    'validation_reason_from_source': row.get('validation_reason'),
                                    'patch_sha256': patch_hash,
                                    'patch': patch,
                                    'annotation_status': 'requires_independent_human_review',
                                    'license_status': 'pending_upstream_code_review',
                                    'training_approved': False,
                                })
        reasons[i] = reason or 'candidate'
    return accepted, reasons


def write_jsonl(path: Path, items: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        for item in items:
            f.write(json.dumps(item, sort_keys=True, ensure_ascii=False) + '\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    ap.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument('--original-queue', type=Path, default=DEFAULT_ORIGINAL_QUEUE)
    ap.add_argument('--json-report', type=Path, default=DEFAULT_JSON)
    ap.add_argument('--csv-report', type=Path, default=DEFAULT_CSV)
    ap.add_argument('--write-expanded-queue', action='store_true', help='Write extra private review queue; never approve records')
    ap.add_argument('--expanded-queue', type=Path, default=DEFAULT_EXPANDED_QUEUE)
    args = ap.parse_args()

    if not args.source.is_file():
        ap.error(f'Source not found: {args.source}. Run the existing intake first.')
    if not args.manifest.is_file():
        ap.error(f'Original manifest not found: {args.manifest}')
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    source_bytes = args.source.read_bytes()
    source_sha = sha256(source_bytes).hexdigest()
    if source_sha != manifest.get('raw_sha256'):
        ap.error('Source SHA-256 differs from original intake manifest. Do not mix revisions.')

    rows = read_jsonl(args.source)
    max_chars = int(manifest.get('selection', {}).get('max_patch_chars', 100000))
    baseline, baseline_reasons = gather(rows, BASELINE_CWES, max_chars)
    expanded, expanded_reasons = gather(rows, None, max_chars)
    baseline_ids = {r['source_row_index'] for r in baseline}
    expanded_ids = {r['source_row_index'] for r in expanded}
    original_queue_count = None
    if args.original_queue.exists():
        original_queue = read_jsonl(args.original_queue)
        original_queue_count = len(original_queue)
        recorded_hashes = {r.get('patch_sha256') for r in original_queue}
        calculated_hashes = {r.get('patch_sha256') for r in baseline}
        if original_queue_count != len(baseline) or recorded_hashes != calculated_hashes:
            ap.error('Original queue does not match reconstructed baseline. Review pipeline compatibility first.')
    if len(baseline) != int(manifest.get('review_candidates', -1)):
        ap.error(f'Baseline reconstruction returned {len(baseline)}, expected {manifest.get("review_candidates")}.')

    excluded = [i for i, reason in baseline_reasons.items() if reason == 'out_of_scope_cwe']
    by_cwe = defaultdict(lambda: {'discarded_by_original_cwe_filter': 0, 'eligible_after_removing_cwe_filter': 0, 'other_reasons_after_expansion': Counter(), 'label': None})
    for i in excluded:
        cwe = cwe_number(rows[i].get('cwe_id'))
        key = f'CWE-{cwe}'
        part = by_cwe[key]
        part['label'] = rows[i].get('cwe_name') or part['label']
        part['discarded_by_original_cwe_filter'] += 1
        if i in expanded_ids:
            part['eligible_after_removing_cwe_filter'] += 1
        else:
            part['other_reasons_after_expansion'][expanded_reasons[i]] += 1

    summary = []
    for key, v in by_cwe.items():
        summary.append({
            'cwe': key,
            'name_from_source': v['label'],
            'original_scope_exclusions': v['discarded_by_original_cwe_filter'],
            'additional_review_candidates': v['eligible_after_removing_cwe_filter'],
            'remaining_exclusion_reasons': dict(sorted(v['other_reasons_after_expansion'].items())),
            'mitre_reference': f'https://cwe.mitre.org/data/definitions/{key.split("-")[1]}.html',
        })
    summary.sort(key=lambda r: (-r['original_scope_exclusions'], r['cwe']))
    report = {
        'project': 'PatchReason',
        'stage': 'cwe_scope_review_only',
        'source': manifest.get('source_url'),
        'source_revision': manifest.get('source_revision'),
        'source_sha256': source_sha,
        'original_intake_candidates': len(baseline),
        'original_scope_exclusions': len(excluded),
        'expanded_scope_candidates': len(expanded),
        'new_candidate_rows': len(expanded_ids - baseline_ids),
        'original_candidate_rows_displaced_by_deduplication': len(baseline_ids - expanded_ids),
        'training_approved_rows': 0,
        'baseline_counts_by_cwe': dict(sorted(Counter(r['cwe'] for r in baseline).items())),
        'expanded_counts_by_cwe': dict(sorted(Counter(r['cwe'] for r in expanded).items())),
        'expanded_exclusion_reasons': dict(sorted(Counter(v for v in expanded_reasons.values() if v != 'candidate').items())),
        'previously_out_of_scope_cwes': summary,
        'limitations': [
            'Candidate records are not independently reviewed or approved for training.',
            'Dataset classifications originated in an LLM-assisted validation process.',
            'CWE counts do not establish security validity, source license rights, or model pretraining independence.',
            'Removing the CWE restriction can change deduplication priority when duplicate patches exist.',
        ],
    }
    args.json_report.parent.mkdir(parents=True, exist_ok=True)
    args.csv_report.parent.mkdir(parents=True, exist_ok=True)
    args.json_report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    with args.csv_report.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['cwe', 'name_from_source', 'original_scope_exclusions', 'additional_review_candidates', 'remaining_exclusion_reasons', 'mitre_reference'])
        writer.writeheader()
        for r in summary:
            writer.writerow({**r, 'remaining_exclusion_reasons': json.dumps(r['remaining_exclusion_reasons'], sort_keys=True)})
    if args.write_expanded_queue:
        revision = manifest.get('source_revision')
        for record in expanded:
            record['source_revision'] = revision
        write_jsonl(args.expanded_queue, expanded)

    print('PatchReason CWE coverage review')
    print(f"Source: {len(rows)} records, revision: {report['source_revision']}")
    print(f'Original candidates: {len(baseline)}; excluded by original CWE filter: {len(excluded)}')
    print(f'Candidates with all CWE categories: {len(expanded)}')
    print(f"Additional candidates: {report['new_candidate_rows']}")
    print(f"Original candidates displaced: {report['original_candidate_rows_displaced_by_deduplication']}")
    print('\nPREVIOUSLY EXCLUDED CWE       ROWS  RECOVERABLE')
    for r in summary:
        print(f"{r['cwe']:<25} {r['original_scope_exclusions']:>4}  {r['additional_review_candidates']:>11}  {r['name_from_source']}")
    print('\nAggregate reports:', args.json_report, args.csv_report)
    if args.write_expanded_queue:
        print('Private expanded review queue:', args.expanded_queue)
    print('Approved for training: 0')


if __name__ == '__main__':
    main()
