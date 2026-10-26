#!/usr/bin/env python3
"""Verify a private PatchReason B200 data handoff without accessing training infrastructure."""
import argparse
import hashlib
import json
import tarfile
from pathlib import Path

ALLOWED = {'train.jsonl', 'validation.jsonl', 'handoff_manifest.json'}


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive', nargs='?', type=Path,
                   default=Path('artifacts/raw/b200_handoff/patchreason-train-validation.tar.gz'))
    args = p.parse_args()
    archive = args.archive
    checksum_file = archive.with_name(archive.name + '.sha256')
    recorded = checksum_file.read_text(encoding='utf-8').split()[0]
    actual = digest(archive.read_bytes())
    if actual != recorded:
        raise RuntimeError('Archive SHA-256 does not match checksum sidecar')
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        names = {m.name for m in members}
        if names != ALLOWED or len(members) != len(ALLOWED) or not all(m.isfile() for m in members):
            raise RuntimeError(f'Unexpected files in private handoff: {names}')
        contents = {m.name: tar.extractfile(m).read() for m in members}
    manifest = json.loads(contents['handoff_manifest.json'])
    if manifest.get('handoff_type') != 'train_validation_only':
        raise RuntimeError('Unexpected handoff type')
    if set(manifest['files']) != {'train.jsonl', 'validation.jsonl'}:
        raise RuntimeError('Unexpected manifest content')
    for name in ('train.jsonl', 'validation.jsonl'):
        payload = contents[name]
        expected = manifest['files'][name]
        count = 0
        for line in payload.splitlines():
            if line.strip():
                item = json.loads(line)
                if set(item) != {'messages'}:
                    raise RuntimeError(f'Unexpected data structure in {name}')
                count += 1
        if len(payload) != expected['bytes'] or digest(payload) != expected['sha256']:
            raise RuntimeError(f'Integrity mismatch for {name}')
        if count != expected['records']:
            raise RuntimeError(f'Record count mismatch for {name}')
        print(f'{name}: {count} records, SHA-256 verified')
    print(f'Archive SHA-256: {actual}')
    print('Final evaluation data: EXCLUDED')
    print('Training admission: ' + str(manifest.get('training_admission')))
    print('VERIFIED: Packaging integrity only; no LoRA execution or label approval claimed')


if __name__ == '__main__':
    main()
