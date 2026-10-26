#!/usr/bin/env python3
"""Prepare private chat JSONL files for NVIDIA NeMo."""

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "datasets/private/derived/js_binary"
OUTPUT = ROOT / "datasets/private/derived/nemo_chat"
REVIEW = ROOT / "datasets/private/reviews/js_binary_spot_review.csv"
MANIFEST = ROOT / "results/data_intake/js_binary_manifest.json"
REPORT = ROOT / "results/data_intake/nemo_data_readiness.json"

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    OUTPUT.mkdir(parents=True, exist_ok=True)
    REVIEW.parent.mkdir(parents=True, exist_ok=True)

    seen = set()
    reports = {}
    reviews = []

    for split in ("train", "validation", "test"):
        source = SOURCE / f"{split}_chat.jsonl"
        raw = source.read_bytes()

        if digest(raw) != manifest["private_files_sha256"][split]:
            raise RuntimeError(f"{split}: source SHA-256 mismatch")

        rows = [
            json.loads(line)
            for line in raw.decode("utf-8").splitlines()
            if line.strip()
        ]

        expected = manifest["selected_counts"][split]
        if len(rows) != expected:
            raise RuntimeError(f"{split}: expected {expected}, found {len(rows)}")

        clean = []
        counts = Counter()
        candidates = {True: [], False: []}

        for row in rows:
            messages = row["messages"]
            roles = [m["role"] for m in messages]

            if roles != ["system", "user", "assistant"]:
                raise RuntimeError(f"{split}: invalid chat roles")

            answer = json.loads(messages[-1]["content"])
            if set(answer) != {"vulnerable"}:
                raise RuntimeError(f"{split}: unexpected answer format")

            label = answer["vulnerable"]
            if type(label) is not bool:
                raise RuntimeError(f"{split}: invalid boolean label")

            metadata = row["metadata"]
            fingerprint = metadata["normalized_sha256"]

            if fingerprint in seen:
                raise RuntimeError(f"{split}: duplicate normalized code")

            seen.add(fingerprint)
            counts["vulnerable" if label else "safe"] += 1

            clean.append({"messages": messages})

            if split != "test":
                candidates[label].append(row)

        destination = OUTPUT / f"{split}.jsonl"
        destination.write_text(
            "".join(
                json.dumps(r, ensure_ascii=False, sort_keys=True) + "\n"
                for r in clean
            ),
            encoding="utf-8",
        )

        reports[split] = {
            "records": len(clean),
            "labels": dict(counts),
            "source_sha256": digest(raw),
            "nemo_chat_sha256": digest(destination.read_bytes()),
        }

        sample_size = 12 if split == "train" else 5 if split == "validation" else 0

        for label in (False, True):
            ordered = sorted(
                candidates[label],
                key=lambda r: hashlib.sha256(
                    str(r.get("id", "")).encode()
                ).hexdigest(),
            )

            for row in ordered[:sample_size]:
                reviews.append({
                    "id": row.get("id", ""),
                    "source_split": split,
                    "upstream_label": "vulnerable" if label else "safe",
                    "code_and_prompt": row["messages"][1]["content"],
                    "review_decision": "pending",
                    "review_notes": "",
                })

    with REVIEW.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "id", "source_split", "upstream_label",
            "code_and_prompt", "review_decision", "review_notes"
        ])
        writer.writeheader()
        writer.writerows(reviews)

    report = {
        "project": "PatchReason",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": manifest["source"],
        "source_revision": manifest["source_revision"],
        "source_training_admission": manifest["training_admission"],
        "nemo_dataset_format": "OpenAI-style messages JSONL",
        "splits": reports,
        "sample_pending_human_review": len(reviews),
        "training_approved_rows": 0,
        "integration_status": "Data prepared; single-B200 LoRA compatibility pending",
        "quality_caveats": [
            "Upstream labels not independently verified",
            "Original code rights review pending",
            "Repository/CVE-level contamination not fully excluded",
            "Final evaluation split must remain held out"
        ],
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    for split, info in reports.items():
        print(f"{split}: {info['records']} records, {info['labels']}")

    print(f"Human review candidates: {len(reviews)}")
    print("NeMo dataset preparation: OK")
    print("Training quality approval: PENDING")

if __name__ == "__main__":
    main()
