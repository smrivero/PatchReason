#!/usr/bin/env python3
"""Create a verifiable private train+validation handoff for a later B200 job.

Never includes final evaluation records, model weights, environment secrets or
project source. This is packaging, not authorization to train on source data.
"""
import hashlib
import gzip
import io
import json
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'datasets/private/derived/nemo_chat'
SOURCE_MANIFEST = ROOT / 'results/data_intake/js_binary_manifest.json'
READINESS = ROOT / 'results/data_intake/nemo_data_readiness.json'
OUTPUT = ROOT / 'artifacts/raw/b200_handoff'


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def main():
    source = json.loads(SOURCE_MANIFEST.read_text(encoding='utf-8'))
    readiness = json.loads(READINESS.read_text(encoding='utf-8'))
    files = {}
    for split in ('train', 'validation'):
        path = DATA / f'{split}.jsonl'
        payload = path.read_bytes()
        checksum = sha256(payload)
        expected = readiness['splits'][split]['nemo_chat_sha256']
        if checksum != expected:
            raise ValueError(f'Unexpected content hash for {path}: rerun prepare_nemo_data.py')
        num_records = sum(bool(x.strip()) for x in payload.splitlines())
        if num_records != source['selected_counts'][split]:
            raise ValueError(f'{split} count mismatch: {num_records}')
        files[f'{split}.jsonl'] = payload
    manifest = {
        'project': 'PatchReason', 'handoff_type': 'train_validation_only',
        'source_dataset': 'sijjeel/js-vuln-dataset',
        'source_revision': source['source_revision'],
        'training_admission': source['training_admission'],
        'model': 'Qwen/Qwen3.5-27B',
        'nemo_container_candidate': 'nvcr.io/nvidia/nemo-automodel:26.10.00',
        'files': {name: {'bytes': len(data), 'sha256': sha256(data),
                         'records': source['selected_counts'][name.removesuffix('.jsonl')]} for name, data in files.items()},
        'notes': ['The final test split is deliberately absent.',
                  'Model-specific Qwen3.5-27B VLM training recipe and single-B200 support require validation.',
                  'Licensing and upstream label review are not yet signed off.']
    }
    files['handoff_manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    target = OUTPUT / 'patchreason-train-validation.tar.gz'
    with target.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as gz:
            with tarfile.open(fileobj=gz, mode='w') as archive:
                for name, data in sorted(files.items()):
                    info = tarfile.TarInfo(name=name)
                    info.size = len(data)
                    info.mode = 0o600
                    info.mtime = 0
                    archive.addfile(info, io.BytesIO(data))
    target.chmod(0o600)
    checksum = sha256(target.read_bytes())
    (OUTPUT / (target.name + '.sha256')).write_text(checksum + '  ' + target.name + '\n')
    print('Prepared private handoff:', target)
    print('Archive SHA-256:', checksum)
    print('Training / validation:', source['selected_counts']['train'], '/', source['selected_counts']['validation'])
    print('Final test examples packaged: 0')
    print('Model training status: NOT YET APPROVED / NOT RUN')


if __name__ == '__main__':
    main()
