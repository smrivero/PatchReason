#!/usr/bin/env python3
"""Validate the PatchReason JSONL data contract using only Python stdlib."""

import argparse
import json
from pathlib import Path

SEVERITIES = {"critical", "high", "medium", "low", "informational"}
SOURCES = {"synthetic", "licensed_public", "authorized_internal"}


def validate(path: Path):
    ids = set()
    count = 0
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw.strip():
            continue
        try:
            record = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Line {lineno}: invalid JSON: {exc}") from exc
        for field in ("id", "group_id", "language", "source_type", "input", "expected"):
            if field not in record:
                raise ValueError(f"Line {lineno}: missing {field}")
        for field in ("id", "group_id", "language"):
            if not isinstance(record[field], str) or not record[field].strip():
                raise ValueError(f"Line {lineno}: invalid {field}")
        if record["id"] in ids:
            raise ValueError(f"Line {lineno}: duplicate id {record['id']}")
        ids.add(record["id"])
        if record["source_type"] not in SOURCES:
            raise ValueError(f"Line {lineno}: invalid source_type")
        if not isinstance(record["input"], dict) or not all(
            isinstance(record["input"].get(k), str) and record["input"][k].strip()
            for k in ("context", "code")
        ):
            raise ValueError(f"Line {lineno}: invalid input")
        if not isinstance(record["expected"], dict) or not isinstance(record["expected"].get("findings"), list):
            raise ValueError(f"Line {lineno}: invalid findings")
        for index, finding in enumerate(record["expected"]["findings"], start=1):
            if not isinstance(finding, dict):
                raise ValueError(f"Line {lineno}: finding {index} is not an object")
            for field in ("cwe", "severity", "evidence", "explanation", "remediation"):
                if not isinstance(finding.get(field), str) or not finding[field].strip():
                    raise ValueError(f"Line {lineno}: finding {index} missing {field}")
            if finding["severity"] not in SEVERITIES:
                raise ValueError(f"Line {lineno}: invalid finding severity")
        count += 1
    if count == 0:
        raise ValueError("Empty dataset")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    try:
        n = validate(args.path)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"INVALID: {exc}\n")
    print(f"VALID: {n} JSONL examples in {args.path}")
