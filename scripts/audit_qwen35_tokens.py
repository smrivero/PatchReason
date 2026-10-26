#!/usr/bin/env python3
"""Audit Qwen3.5-27B sequence lengths without downloading model weights."""

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "datasets/private/derived/nemo_chat"
OUTPUT = ROOT / "results/data_intake/qwen35_token_audit.json"
MODEL = "Qwen/Qwen3.5-27B"
LIMITS = (512, 1024, 2048, 4096)


def summary(values):
    values = sorted(values)

    if not values:
        raise ValueError("No samples in group")

    def percentile(p):
        index = round((len(values) - 1) * p)
        return values[index]

    return {
        "count": len(values),
        "mean": round(mean(values), 2),
        "p50": percentile(0.50),
        "p90": percentile(0.90),
        "p95": percentile(0.95),
        "p99": percentile(0.99),
        "max": values[-1],
        "would_exceed_sequence_limit": {
            str(n): sum(t > n for t in values)
            for n in LIMITS
        },
    }


def main():
    print(f"Loading tokenizer only: {MODEL}")

    tokenizer = AutoTokenizer.from_pretrained(
        MODEL,
        use_fast=True,
    )

    report = {
        "project": "PatchReason",
        "model_tokenizer": MODEL,
        "model_revision_resolved": tokenizer.init_kwargs.get(
            "_commit_hash"
        ),
        "generated_at_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "includes_held_out_test": False,
        "splits": {},
    }

    for split in ("train", "validation"):
        path = DATA_DIR / f"{split}.jsonl"

        counts = []
        by_label = defaultdict(list)

        for line in path.open(encoding="utf-8"):
            if not line.strip():
                continue

            record = json.loads(line)
            messages = record["messages"]

            label = json.loads(
                messages[-1]["content"]
            )["vulnerable"]

            if type(label) is not bool:
                raise ValueError("Invalid vulnerability label")

            rendered = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
                enable_thinking=False,
            )

            if not isinstance(rendered, str) or not rendered.strip():
                raise RuntimeError("Invalid rendered chat template")

            token_ids = tokenizer.encode(
                rendered,
                add_special_tokens=False,
            )

            count = len(token_ids)

            if count < 20:
                raise RuntimeError(
                    f"Suspicious token count: {count}. "
                    "Check tokenizer output before training."
                )
            counts.append(count)

            by_label[
                "vulnerable" if label else "safe"
            ].append(count)

        report["splits"][split] = {
            "all": summary(counts),
            "vulnerable": summary(by_label["vulnerable"]),
            "safe": summary(by_label["safe"]),
        }

        result = report["splits"][split]["all"]

        print(f"\n{split.upper()}")
        print("Records:", result["count"])
        print("P50 tokens:", result["p50"])
        print("P95 tokens:", result["p95"])
        print("P99 tokens:", result["p99"])
        print("Maximum:", result["max"])
        print(
            "Exceeding limits:",
            result["would_exceed_sequence_limit"],
        )

    report["limitations"] = [
        "Token counts include the complete chat template.",
        "Single-GPU LoRA memory compatibility is not established.",
        "Upstream label quality and source licenses remain pending.",
        "The held-out test partition was not inspected.",
    ]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )

    print("\nReport:", OUTPUT)


if __name__ == "__main__":
    main()
