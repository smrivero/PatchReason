import json
import os
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESULT = ROOT / "results/b200-benchmark-120.json"
SERVER = os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:15000")
BASE = SERVER.rstrip("/") + "/api/2.0/mlflow"

def api(endpoint, payload):
    request = urllib.request.Request(
        BASE + endpoint,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def percentile(values, p):
    values = sorted(values)
    if not values:
        return None
    pos = (len(values)-1)*p/100
    a = int(pos)
    b = min(a+1, len(values)-1)
    return values[a] + (values[b]-values[a])*(pos-a)

def metric(run_id, key, value):
    if value is None:
        return
    api("/runs/log-metric", {
        "run_id": run_id,
        "key": key,
        "value": float(value),
        "timestamp": int(time.time()*1000),
        "step": 0
    })

data = json.loads(RESULT.read_text())
container = data.get("results", {})
if isinstance(container, dict):
    records = container.get("results") or container.get("outputs") or []
elif isinstance(container, list):
    records = container
else:
    records = []

if not records:
    raise SystemExit(
        "No se encontraron resultados. Revisar estructura del JSON de Promptfoo."
    )

grouped = {}
for entry in records:
    provider = entry.get("provider") or {}
    if isinstance(provider, dict):
        name = provider.get("label") or provider.get("id", "unknown")
    else:
        name = str(provider)

    response = entry.get("response") or {}
    if not isinstance(response, dict):
        response = {}

    metadata = response.get("metadata") or entry.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    raw = metadata.get("raw_response") or {}
    if not isinstance(raw, dict):
        raw = {}

    usage = response.get("tokenUsage") or raw.get("usage") or {}
    latency = metadata.get("latency_ms")
    if latency is None:
        latency = raw.get("latency_ms")
    if latency is None:
        latency = entry.get("latencyMs")

    output = response.get("output", entry.get("output"))
    if isinstance(output, dict):
        output = output.get("output")

    expected = (entry.get("testCase") or {}).get("vars", {}).get("expected_label")
    error = bool(entry.get("error") or response.get("error"))

    grouped.setdefault(name, []).append({
        "output": output,
        "expected": expected,
        "error": error,
        "latency_ms": latency,
        "prompt_tokens": usage.get("prompt", usage.get("prompt_tokens")),
        "completion_tokens": usage.get("completion", usage.get("completion_tokens"))
    })

experiment = "PatchReason-B200-Inference-Benchmark"
found = api("/experiments/search", {"max_results": 100})
existing = next(
    (x for x in found.get("experiments", []) if x["name"] == experiment),
    None
)
if existing:
    experiment_id = existing["experiment_id"]
else:
    experiment_id = api("/experiments/create", {
        "name": experiment
    })["experiment_id"]

for model, rows in grouped.items():
    run = api("/runs/create", {
        "experiment_id": experiment_id,
        "run_name": model + "-promptfoo-120"
    })
    run_id = run["run"]["info"]["run_id"]

    valid = [
        r for r in rows
        if not r["error"] and r["output"] in ("safe", "vulnerable")
    ]
    labeled = [r for r in valid if r["expected"] in ("safe", "vulnerable")]
    latencies = [float(r["latency_ms"]) for r in valid
                 if isinstance(r["latency_ms"], (int, float))]
    prompt_tokens = [float(r["prompt_tokens"]) for r in valid
                     if isinstance(r["prompt_tokens"], (int, float))]
    completion_tokens = [float(r["completion_tokens"]) for r in valid
                         if isinstance(r["completion_tokens"], (int, float))]

    tp = sum(r["expected"] == "vulnerable" and r["output"] == "vulnerable"
             for r in labeled)
    tn = sum(r["expected"] == "safe" and r["output"] == "safe"
             for r in labeled)
    fp = sum(r["expected"] == "safe" and r["output"] == "vulnerable"
             for r in labeled)
    fn = sum(r["expected"] == "vulnerable" and r["output"] == "safe"
             for r in labeled)

    metrics = {
        "requests": len(rows),
        "valid_predictions": len(valid),
        "errors": len(rows)-len(valid),
        "labeled_predictions": len(labeled),
        "true_positive": tp,
        "true_negative": tn,
        "false_positive": fp,
        "false_negative": fn,
        "accuracy": (tp+tn)/len(labeled) if labeled else None,
        "precision": tp/(tp+fp) if tp+fp else None,
        "recall": tp/(tp+fn) if tp+fn else None,
        "f1": 2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else None,
        "latency_mean_ms": statistics.mean(latencies) if latencies else None,
        "latency_p50_ms": percentile(latencies, 50),
        "latency_p95_ms": percentile(latencies, 95),
        "latency_p99_ms": percentile(latencies, 99),
        "prompt_tokens_mean": statistics.mean(prompt_tokens) if prompt_tokens else None,
        "completion_tokens_mean": statistics.mean(completion_tokens) if completion_tokens else None,
    }

    for key, value in metrics.items():
        metric(run_id, key, value)

    api("/runs/set-tag", {
        "run_id": run_id,
        "key": "source",
        "value": "promptfoo-0.125.1"
    })
    api("/runs/update", {
        "run_id": run_id,
        "status": "FINISHED"
    })

    print(f"\n{model}")
    print(f"MLflow run: {run_id}")
    for key, value in metrics.items():
        print(f"  {key}: {value}")

print("\nMLflow:", SERVER)
print("Experimento:", experiment)
