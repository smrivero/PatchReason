#!/usr/bin/env python3
"""Ingest original Hugging Face patch records into a private review queue.

No records are approved for model training by this script.
The Hugging Face revision is resolved and recorded for reproducibility.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re

SOURCE_ID = 'rgaucher/security-vuln-patches'
DEFAULT_CWES = {89, 862, 863, 639, 915}
EXTENSIONS = ('.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs')
DIFF_HEADER = re.compile(r'^diff --git a/(.*?) b/(.*?)\s*$', re.MULTILINE)


def extract_js_ts_sections(patch):
    """Retain complete diff sections for actual JS/TS paths, not language labels."""
    matches = list(DIFF_HEADER.finditer(patch))
    results = []
    for pos, m in enumerate(matches):
        filename = m.group(2)
        if not filename.lower().endswith(EXTENSIONS):
            continue
        if filename.lower().endswith('.min.js'):
            continue
        end = matches[pos + 1].start() if pos + 1 < len(matches) else len(patch)
        results.append((filename, patch[m.start():end]))
    return results


def dump_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as out:
        for row in rows:
            out.write(json.dumps(row, sort_keys=True, ensure_ascii=False) + '\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--fixture', type=Path, help='Offline input: JSONL of source-shaped records')
    ap.add_argument('--out', type=Path, default=Path('datasets/private/external/security_vuln_patches'))
    ap.add_argument('--report', type=Path, default=Path('results/data_intake/security_vuln_patches.json'))
    ap.add_argument('--max-rows', type=int, default=0, help='0 = full 355-row source, otherwise max loaded records')
    ap.add_argument('--max-patch-chars', type=int, default=100000)
    ap.add_argument('--cwes', default='89,862,863,639,915', help='Comma-separated IDs, or all')
    args = ap.parse_args()
    accepted_cwes = None if args.cwes.lower() == 'all' else {int(x.strip()) for x in args.cwes.split(',')}

    if args.fixture:
        source_rows = [json.loads(line) for line in args.fixture.read_text(encoding='utf-8').splitlines() if line.strip()]
        revision = 'offline-fixture'
    else:
        try:
            from datasets import load_dataset
            from huggingface_hub import HfApi
        except ImportError as exc:
            raise SystemExit('Install dependencies: python3 -m pip install -r requirements-data.txt') from exc
        revision = HfApi().dataset_info(SOURCE_ID).sha
        # Load the full original content. Dataset Viewer API may truncate long diff cells.
        ds = load_dataset(SOURCE_ID, split='train', revision=revision)
        source_rows = [dict(row) for row in ds]

    if args.max_rows:
        source_rows = source_rows[:args.max_rows]
    args.out.mkdir(parents=True, exist_ok=True)
    dump_jsonl(args.out / 'source_original.jsonl', source_rows)

    candidates, rejected = [], Counter()
    seen = set()
    for index, row in enumerate(source_rows):
        language = str(row.get('language') or '').lower()
        if language not in {'javascript', 'typescript'}:
            rejected['language_not_js_ts'] += 1
            continue
        try:
            cwe_id = int(str(row.get('cwe_id') or '').upper().replace('CWE-', ''))
        except ValueError:
            rejected['missing_cwe_id'] += 1
            continue
        if accepted_cwes is not None and cwe_id not in accepted_cwes:
            rejected['out_of_scope_cwe'] += 1
            continue
        if row.get('remediation_class') != 'code_fix':
            rejected['non_code_remediation'] += 1
            continue
        diff = str(row.get('diff') or '')
        if not diff:
            rejected['missing_diff'] += 1
            continue
        files = extract_js_ts_sections(diff)
        if not files:
            rejected['no_js_ts_file_in_patch'] += 1
            continue
        js_patch = ''.join(section for _, section in files)
        if len(js_patch) > args.max_patch_chars:
            rejected['oversized_diff'] += 1
            continue
        patch_hash = sha256(js_patch.encode('utf-8')).hexdigest()
        if patch_hash in seen:
            rejected['duplicate_patch'] += 1
            continue
        seen.add(patch_hash)
        repo = str(row.get('repo') or '').strip()
        if not repo:
            rejected['missing_repo'] += 1
            continue
        uid = sha256((repo + '\0' + str(row.get('commit_sha') or '') + '\0' + patch_hash).encode('utf-8')).hexdigest()[:20]
        candidates.append({
            'id': 'hf-patches-' + uid,
            'source_dataset': SOURCE_ID,
            'source_revision': revision,
            'source_row_index': index,
            'repo': repo,
            'source_url': row.get('url'),
            'commit_sha': row.get('commit_sha') or None,
            'commit_date': row.get('commit_date') or None,
            'language_declared': language,
            'files': sorted({f for f, _ in files}),
            'cwe': 'CWE-' + str(cwe_id),
            'cwe_name': row.get('cwe_name'),
            'validation_reason_from_source': row.get('validation_reason'),
            'patch_sha256': patch_hash,
            'patch': js_patch,
            'annotation_status': 'requires_independent_human_review',
            'license_status': 'pending_upstream_code_review',
            'training_approved': False,
        })

    dump_jsonl(args.out / 'review_queue.jsonl', candidates)
    manifest = {
        'project': 'PatchReason',
        'stage': 'external_source_intake_only',
        'source_url': 'https://huggingface.co/datasets/' + SOURCE_ID,
        'source_revision': revision,
        'collected_at_utc': datetime.now(timezone.utc).isoformat(),
        'rows_read': len(source_rows),
        'review_candidates': len(candidates),
        'exclusions': dict(sorted(rejected.items())),
        'candidate_cwes': dict(sorted(Counter(c['cwe'] for c in candidates).items())),
        'candidate_repositories': len({c['repo'] for c in candidates}),
        'raw_sha256': sha256((args.out / 'source_original.jsonl').read_bytes()).hexdigest(),
        'candidates_sha256': sha256((args.out / 'review_queue.jsonl').read_bytes()).hexdigest(),
        'review_notice': 'No records are validated for training or final scoring. Original upstream repository rights require review.',
        'selection': {'languages': ['javascript', 'typescript'], 'cwes': sorted(accepted_cwes) if accepted_cwes else 'all', 'file_extensions': list(EXTENSIONS), 'remediation': 'code_fix', 'max_patch_chars': args.max_patch_chars},
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Source revision:', revision)
    print('Read:', len(source_rows), 'records | review candidates:', len(candidates))
    print('Reasons excluded:', dict(rejected))
    print('Private records:', (args.out / 'review_queue.jsonl').resolve())
    print('Shareable metadata:', args.report.resolve())


if __name__ == '__main__':
    main()
