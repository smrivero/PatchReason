#!/usr/bin/env python3
"""Convert private PatchReason chat JSONL into NeMo AutoModel VLM conversations.

This loader handles training and validation only. It does not load the held-out
final evaluation partition, approve source licenses, or claim a GPU run.
"""
import argparse
import json
from pathlib import Path


def make_patchreason_dataset(path_or_dataset, split="train"):
    if split not in ("train", "validation"):
        raise ValueError("Only train and validation are supported here")
    path = Path(path_or_dataset) / (split + ".jsonl")
    if not path.is_file():
        raise FileNotFoundError(f"Missing private dataset: {path}")
    examples = []
    with path.open(encoding="utf-8") as stream:
        for number, line in enumerate(stream, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            messages = record["messages"]
            if [m.get("role") for m in messages] != ["system", "user", "assistant"]:
                raise ValueError(f"{path}:{number}: invalid conversation roles")
            if any(not isinstance(m.get("content"), str) or not m["content"] for m in messages):
                raise ValueError(f"{path}:{number}: invalid message content")
            answer = json.loads(messages[-1]["content"])
            if set(answer) != {"vulnerable"} or type(answer["vulnerable"]) is not bool:
                raise ValueError(f"{path}:{number}: invalid boolean classification target")
            examples.append({"conversation": [
                {"role": m["role"], "content": [{"type": "text", "text": m["content"]}]}
                for m in messages
            ]})
    if not examples:
        raise ValueError(f"Empty dataset: {path}")
    return examples


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    args = parser.parse_args()
    for split in ("train", "validation"):
        rows = make_patchreason_dataset(args.data_dir, split)
        print(f"{split}: {len(rows)} VLM conversation records, structure OK")
    print("Held-out evaluation partition: not read")
