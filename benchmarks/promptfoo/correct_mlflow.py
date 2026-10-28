import json
import time
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent
data = json.loads((root / "results/b200-benchmark-120.json").read_text())
records = data["results"]["results"]
base = "http://127.0.0.1:15000/api/2.0/mlflow"

experiment_id = "2"
old_runs = {
    "Qwen3.5-27B-Base": "dc768415ccf34c5380de13e64554aa7c",
    "Qwen3.5-27B-LoRA": "218e38033b6e4e869811657ff7afef63"
}

def api(path, payload):
    req = urllib.request.Request(
        base + path,
        json.dumps(payload).encode(),
        {"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        return json.load(response)

# Retrieve actual experiment ID by name.
experiments = api("/experiments/search", {"max_results": 100})
experiment_id = next(
    e["experiment_id"] for e in experiments["experiments"]
    if e["name"] == "PatchReason-B200-Inference-Benchmark"
)

for model, old_id in old_runs.items():
    rows = []
    for r in records:
        provider = r.get("provider") or {}
        label = provider.get("label") if isinstance(provider, dict) else str(provider)
        if label == model:
            rows.append(r)

    tp = tn = fp = fn = 0
    latencies = []
    prompt_tokens = []
    completion_tokens = []
    transport_errors = 0

    for r in rows:
        resp = r.get("response") or {}
        if not isinstance(resp, dict):
            resp = {}

        metadata = resp.get("metadata") or {}
        raw = metadata.get("raw_response") or {}
        usage = raw.get("usage") or {}

        predicted = resp.get("output")
        expected = (r.get("testCase") or {}).get("vars", {}).get("expected_label")

        if predicted not in ("safe", "vulnerable") or expected not in ("safe", "vulnerable"):
            transport_errors += 1
            continue

        if expected == "vulnerable" and predicted == "vulnerable":
            tp += 1
        elif expected == "safe" and predicted == "safe":
            tn += 1
        elif expected == "safe":
            fp += 1
        else:
            fn += 1

        if isinstance(raw.get("latency_ms"), (int, float)):
            latencies.append(raw["latency_ms"])
        if isinstance(usage.get("prompt_tokens"), (int, float)):
            prompt_tokens.append(usage["prompt_tokens"])
        if isinstance(usage.get("completion_tokens"), (int, float)):
            completion_tokens.append(usage["completion_tokens"])

    def pct(values, p):
        if not values:
            return None
        values = sorted(values)
        x = (len(values)-1)*p/100
        lo = int(x)
        hi = min(lo+1, len(values)-1)
        return values[lo] + (values[hi]-values[lo])*(x-lo)

    n = tp+tn+fp+fn
    values = {
        "requests": len(rows),
        "valid_predictions": n,
        "transport_errors": transport_errors,
        "true_positive": tp,
        "true_negative": tn,
        "false_positive": fp,
        "false_negative": fn,
        "accuracy": (tp+tn)/n if n else None,
        "precision": tp/(tp+fp) if tp+fp else 0,
        "recall": tp/(tp+fn) if tp+fn else 0,
        "f1": 2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0,
        "latency_mean_ms": sum(latencies)/len(latencies) if latencies else None,
        "latency_p50_ms": pct(latencies, 50),
        "latency_p95_ms": pct(latencies, 95),
        "latency_p99_ms": pct(latencies, 99),
        "prompt_tokens_mean": sum(prompt_tokens)/len(prompt_tokens) if prompt_tokens else None,
        "completion_tokens_mean": sum(completion_tokens)/len(completion_tokens) if completion_tokens else None
    }

    run = api("/runs/create", {
        "experiment_id": experiment_id,
        "run_name": model + "-corrected-120"
    })
    run_id = run["run"]["info"]["run_id"]

    timestamp = int(time.time()*1000)
    api("/runs/log-batch", {
        "run_id": run_id,
        "metrics": [
            {"key": k, "value": float(v), "timestamp": timestamp, "step": 0}
            for k, v in values.items() if v is not None
        ],
        "tags": [
            {"key": "validation", "value": "corrected"},
            {"key": "source", "value": "Promptfoo B200 benchmark 120"},
            {"key": "correction_of", "value": old_id},
            {"key": "dataset_note", "value": "12 patterns with 10 variants each"}
        ]
    })
    api("/runs/update", {"run_id": run_id, "status": "FINISHED"})

    api("/runs/set-tag", {
        "run_id": old_id,
        "key": "validation",
        "value": "superseded_by_corrected_run"
    })

    print("\n", model, "NEW RUN:", run_id)
    for k, v in values.items():
        print(f"{k}: {v}")
