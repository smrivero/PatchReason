#!/usr/bin/env python3
"""Produce public-safe, aggregate audits of PatchReason's selected binary dataset.

Offline; never executes source code or exports code examples. This audit does
not validate labels, repository split leakage, licensing, or NeMo compatibility.
"""
import collections
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'datasets/private/derived/js_binary'
MANIFEST = ROOT / 'results/data_intake/js_binary_manifest.json'
REPORT = ROOT / 'results/data_intake/js_binary_readiness_audit.json'


def percentile(values, p):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * p / 100)]


def dist(values):
    return {'min': min(values), 'p50': percentile(values, 50), 'p90': percentile(values, 90),
            'p95': percentile(values, 95), 'max': max(values), 'mean': round(sum(values) / len(values), 1)}


def extract_code(user_text):
    prefix = '```javascript\n'
    if prefix not in user_text or '\n```' not in user_text:
        raise ValueError('Unexpected prompt/code fence structure')
    return user_text.split(prefix, 1)[1].rsplit('\n```', 1)[0]


def main():
    metadata = json.loads(MANIFEST.read_text(encoding='utf-8'))
    output = {'project': 'PatchReason', 'source_revision': metadata['source_revision'],
              'source': 'sijjeel/js-vuln-dataset', 'data_scope': 'binary JavaScript vulnerability labels only',
              'splits': {}, 'quality_gate': 'NOT APPROVED',
              'methodology': 'Local deterministic source-level summary. No tokenizer; length statistics are characters, not tokens.',
              'limitations': ['CWE labels and fixes unavailable', 'Per-repository/CVE overlap not measured',
                              'Upstream label quality not verified', 'Permissions/license review pending',
                              'Source code may be present in model pretraining',
                              'Length distributions may be confounded with source labels']}
    hashes = set()
    for split in ('train', 'validation', 'test'):
        path = SOURCE / (split + '_chat.jsonl')
        raw = path.read_bytes()
        actual = hashlib.sha256(raw).hexdigest()
        assert actual == metadata['private_files_sha256'][split], f'{split}: source hash mismatch'
        lengths = {'vulnerable': [], 'safe': []}
        fingerprints = set()
        n = 0
        for ln, line in enumerate(raw.decode('utf-8').splitlines(), 1):
            if not line.strip():
                continue
            row = json.loads(line)
            if len(row.get('messages', [])) != 3:
                raise ValueError(f'{split}:{ln}: unexpected message shape')
            answer = json.loads(row['messages'][2]['content'])
            if set(answer) != {'vulnerable'} or type(answer['vulnerable']) is not bool:
                raise ValueError(f'{split}:{ln}: invalid label schema')
            code = extract_code(row['messages'][1]['content'])
            fp = row['metadata']['normalized_sha256']
            computed_fp = hashlib.sha256(re.sub(r'\s+', '', code).encode('utf-8')).hexdigest()
            if computed_fp != fp:
                raise ValueError(f'{split}:{ln}: source-code fingerprint mismatch')
            if fp in fingerprints or fp in hashes:
                raise ValueError(f'{split}:{ln}: cross-partition or within-split duplicate')
            fingerprints.add(fp)
            lengths['vulnerable' if answer['vulnerable'] else 'safe'].append(len(code))
            n += 1
        assert n == metadata['selected_counts'][split], f'{split}: count mismatch'
        hashes.update(fingerprints)
        output['splits'][split] = {
            'count': n,
            'labels': {key: len(vals) for key, vals in lengths.items()},
            'code_character_lengths': {key: dist(vals) for key, vals in lengths.items()},
            'verified_original_sha256': actual,
        }
    train = output['splits']['train']['code_character_lengths']
    output['train_mean_code_length_ratio_vulnerable_to_safe'] = round(
        train['vulnerable']['mean'] / train['safe']['mean'], 3) if train['safe']['mean'] else None
    output['train_p95_code_chars'] = max(train['vulnerable']['p95'], train['safe']['p95'])
    output['readiness_flags'] = [
        'Chat JSONL format and hashes verified; semantic label reliability is not established.',
        'A 50:50 training split is balanced artificially and does not reflect vulnerability prevalence.',
        'Real token lengths require Qwen3.5 tokenizer and chat template; do not size GPU using character count alone.',
        'The final test set must remain held out until final model comparison.',
    ]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('Dataset audit saved:', REPORT)
    for name, info in output['splits'].items():
        print(f'{name}: {info["count"]} rows, {info["labels"]}')
    print('Train mean character length ratio vulnerable/safe:', output['train_mean_code_length_ratio_vulnerable_to_safe'])
    print('Training admission:', output['quality_gate'])


if __name__ == '__main__':
    main()
