# Dataset contract

Data must be authorized for use, correctly labelled, and traceable to a source or approved synthetic example. This repository includes only a few illustrative synthetic records, **not** a complete training corpus.

## JSON Lines schema (v0.1)

Each line is an object with:

- `id` (string): unique stable identifier.
- `group_id` (string): repository/source grouping used to prevent leakage across partitions.
- `language` (string): e.g. `typescript`.
- `source_type` (`synthetic` | `licensed_public` | `authorized_internal`).
- `input` object: `context` (string), `code` (string).
- `expected` object: `findings` (array); empty list for safe samples.
- Each finding: `cwe`, `severity`, `evidence`, `explanation`, `remediation` (all strings).

## Data process

1. Select issue categories and positive/negative examples.
2. Record provenance, license and original repository group.
3. Perform label adjudication, especially for security findings.
4. Deduplicate and split by `group_id`.
5. Freeze the independent evaluation partition before training.
6. Exclude private code, secrets and personal data from Git.

`reference_examples.jsonl` is only a schema and annotation reference. The full partitions are intentionally ignored by `.gitignore` until redistribution permission is established.
