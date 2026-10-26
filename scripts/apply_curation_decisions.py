import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]

source = root / "datasets/private/external/security_vuln_patches/review_queue_expanded.jsonl"
output = root / "datasets/private/external/security_vuln_patches/review_queue_curated.jsonl"
decisions_file = root / "datasets/curation_decisions.json"

decisions = json.loads(decisions_file.read_text())["decisions"]
rejected_urls = {
    d["source_url"] for d in decisions
    if d["decision"] == "reject"
}

records = [
    json.loads(line)
    for line in source.read_text().splitlines()
    if line.strip()
]

kept = []
rejected = []

for record in records:
    url = record.get("source_url", "")
    if url in rejected_urls:
        rejected.append(record)
    else:
        kept.append(record)

if len(rejected) != len(rejected_urls):
    raise RuntimeError("Not all rejected sources were found")

output.write_text(
    "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in kept)
)

print("Original candidates:", len(records))
print("Rejected:", len(rejected))
print("Remaining candidates:", len(kept))
print("Approved for training: 0")
