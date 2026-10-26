#!/usr/bin/env python3
"""Build a length-bounded, private B200 training handoff."""

import gzip
import hashlib
import io
import json
import tarfile
from collections import Counter
from pathlib import Path

from transformers import AutoTokenizer
from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
MODEL = "Qwen/Qwen3.5-27B"
MAX_TOKENS = 2048

SOURCE = ROOT / "datasets/private/derived/nemo_chat"
OUTPUT = ROOT / "datasets/private/derived/nemo_chat_2048"
HANDOFF = ROOT / "artifacts/raw/b200_handoff_2048"
REPORT = ROOT / "results/data_intake/sequence_budget_2048.json"

SOURCE_REPORT = ROOT / "results/data_intake/nemo_data_readiness.json"
DATASET_MANIFEST = ROOT / "results/data_intake/js_binary_manifest.json"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def count_tokens(tokenizer, messages):
    rendered = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
        enable_thinking=False,
    )

    if not isinstance(rendered, str) or not rendered.strip():
        raise ValueError("Invalid rendered conversation")

    count = len(
        tokenizer.encode(rendered, add_special_tokens=False)
    )

    if count < 20:
        raise ValueError(f"Suspicious token count: {count}")

    return count


def main():
    readiness = json.loads(SOURCE_REPORT.read_text())
    manifest = json.loads(DATASET_MANIFEST.read_text())

    tokenizer_sha = HfApi().model_info(MODEL).sha
    if not tokenizer_sha:
        raise ValueError("Cannot resolve tokenizer revision")

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL,
        revision=tokenizer_sha,
        use_fast=True,
    )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    HANDOFF.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)

    results = {}
    files = {}

    for split in ("train", "validation"):
        source = SOURCE / f"{split}.jsonl"
        original = source.read_bytes()

        expected = readiness["splits"][split]["nemo_chat_sha256"]

        if sha256(original) != expected:
            raise ValueError(f"{split}: source integrity mismatch")

        retained = []
        labels = Counter()
        excluded = Counter()
        total = 0

        for number, line in enumerate(
            original.decode("utf-8").splitlines(), 1
        ):
            if not line.strip():
                continue

            total += 1
            row = json.loads(line)
            messages = row["messages"]

            label = json.loads(
                messages[-1]["content"]
            )["vulnerable"]

            if type(label) is not bool:
                raise ValueError(f"{split}:{number}: invalid label")

            category = "vulnerable" if label else "safe"
            tokens = count_tokens(tokenizer, messages)

            if tokens > MAX_TOKENS:
                excluded[category] += 1
                continue

            labels[category] += 1
            retained.append(
                json.dumps(row, ensure_ascii=False, sort_keys=True)
            )

        if total != manifest["selected_counts"][split]:
            raise ValueError(f"{split}: unexpected record count")

        if sum(labels.values()) + sum(excluded.values()) != total:
            raise ValueError(f"{split}: count mismatch")

        payload = ("\n".join(retained) + "\n").encode("utf-8")

        destination = OUTPUT / f"{split}.jsonl"
        destination.write_bytes(payload)
        files[f"{split}.jsonl"] = payload

        results[split] = {
            "original": total,
            "retained": len(retained),
            "excluded_over_2048": sum(excluded.values()),
            "retained_labels": dict(labels),
            "excluded_labels": dict(excluded),
            "source_sha256": sha256(original),
            "output_sha256": sha256(payload),
        }

        print(
            f"{split}: {len(retained)}/{total} retained, "
            f"excluded={dict(excluded)}, "
            f"labels={dict(labels)}"
        )

    report = {
        "project": "PatchReason",
        "model": MODEL,
        "tokenizer_commit": tokenizer_sha,
        "max_sequence_tokens": MAX_TOKENS,
        "includes_chat_template_and_response": True,
        "held_out_test_inspected": False,
        "training_admission": manifest["training_admission"],
        "source_revision": manifest["source_revision"],
        "splits": results,
        "limitations": [
            "Source labels and code licenses are pending review.",
            "Text-only token lengths do not establish VLM GPU memory use.",
            "Long sequences are excluded rather than truncated.",
            "Length filtering can change class proportions.",
        ],
    }

    REPORT.write_text(json.dumps(report, indent=2) + "\n")

    files["handoff_manifest.json"] = (
        json.dumps(report, indent=2) + "\n"
    ).encode("utf-8")

    archive = HANDOFF / "patchreason-train-validation-2048.tar.gz"

    with archive.open("wb") as raw:
        with gzip.GzipFile(
            fileobj=raw, mode="wb", filename="", mtime=0
        ) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as tar:
                for name, content in sorted(files.items()):
                    info = tarfile.TarInfo(name)
                    info.size = len(content)
                    info.mode = 0o600
                    info.mtime = 0
                    tar.addfile(info, io.BytesIO(content))

    archive.chmod(0o600)

    checksum = sha256(archive.read_bytes())
    checksum_file = HANDOFF / (archive.name + ".sha256")

    checksum_file.write_text(
        checksum + "  " + archive.name + "\n"
    )

    print("Package:", archive)
    print("SHA256:", checksum)
    print("Final evaluation data included: NO")
    print("Training authorization: PENDING")


if __name__ == "__main__":
    main()
