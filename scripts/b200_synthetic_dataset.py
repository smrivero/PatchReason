#!/usr/bin/env python3
"""Original synthetic examples for B200 runtime compatibility checks."""

import json

SYSTEM = (
    "You are a JavaScript security classifier. "
    "Respond with JSON containing only the boolean field vulnerable."
)

EXAMPLES = {
    "train": [
        (
            "const result = await db.query("
            "'SELECT * FROM users WHERE id=' + req.query.id);",
            True,
        ),
        (
            "const result = await db.query("
            "'SELECT * FROM users WHERE id = ?', [id]);",
            False,
        ),
    ],
    "validation": [
        (
            "const path = req.query.file; "
            "res.sendFile('/data/' + path);",
            True,
        ),
        (
            "const result = await User.findByPk(userId);",
            False,
        ),
    ],
}


def make_synthetic_dataset(path_or_dataset=None, split="train"):
    if split not in EXAMPLES:
        raise ValueError(f"Unsupported split: {split}")

    records = []

    for code, vulnerable in EXAMPLES[split]:
        records.append({
            "conversation": [
                {
                    "role": "system",
                    "content": [{"type": "text", "text": SYSTEM}],
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": code}],
                },
                {
                    "role": "assistant",
                    "content": [{
                        "type": "text",
                        "text": json.dumps({"vulnerable": vulnerable}),
                    }],
                },
            ]
        })

    return records


if __name__ == "__main__":
    for split in EXAMPLES:
        data = make_synthetic_dataset(split=split)
        print(f"{split}: {len(data)} synthetic examples")
