#!/usr/bin/env python3
"""PatchReason held-out binary evaluation: vLLM -> MLflow REST.

Runs on the B200 host with Python standard library only. Strict separation of
held-out test data from NeMo training/validation. Saves private, resumable
predictions; MLflow receives aggregate metrics and non-sensitive run metadata.

Source labels are unverified upstream annotations, not independent security truth.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

MODEL_IDS = ("Qwen/Qwen3.5-27B", "patchreason-lora")
EXPERIMENT = "PatchReason-B200-Heldout-Evaluation"


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def now_ms() -> int:
    return int(time.time() * 1000)


def request_json(url: str, payload=None, timeout: int = 120):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    req = urllib.request.Request(url, headers=headers, data=data, method="POST" if data else "GET")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def mlflow_api(base: str, path: str, payload=None):
    return request_json(f"{base.rstrip('/')}/api/2.0/mlflow/{path}", payload, timeout=15)


def load_records(path: Path, expected_count: int):
    raw = path.read_bytes()
    result = []
    for index, line in enumerate(raw.decode("utf-8").splitlines()):
        if not line.strip():
            continue
        rec = json.loads(line)
        messages = rec["messages"]
        assert [m["role"] for m in messages] == ["system", "user", "assistant"], f"bad roles: {index}"
        assert all(isinstance(m["content"], str) and m["content"] for m in messages)
        ground_truth = json.loads(messages[2]["content"])
        assert set(ground_truth) == {"vulnerable"}
        assert type(ground_truth["vulnerable"]) is bool
        result.append({
            "index": len(result),
            "expected": ground_truth["vulnerable"],
            "messages": messages[:2],  # CRITICAL: never send assistant answer to vLLM
            "input_sha256": digest(messages[1]["content"].encode("utf-8")),
        })
    if len(result) != expected_count:
        raise ValueError(f"Expected {expected_count} held-out examples, found {len(result)}")
    return result, digest(raw)


def fetch_models(base: str):
    obj = request_json(f"{base.rstrip('/')}/v1/models", timeout=12)
    found = {m["id"] for m in obj.get("data", [])}
    missing = set(MODEL_IDS) - found
    if missing:
        raise RuntimeError(f"vLLM is missing models: {sorted(missing)}; available: {sorted(found)}")
    return found


def experiment_id(base: str):
    encoded = urllib.parse.urlencode({"experiment_name": EXPERIMENT})
    try:
        response = mlflow_api(base, f"experiments/get-by-name?{encoded}")
        return response["experiment"]["experiment_id"]
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
    try:
        return mlflow_api(base, "experiments/create", {"name": EXPERIMENT})["experiment_id"]
    except urllib.error.HTTPError as e:
        if e.code in (400, 409):
            response = mlflow_api(base, f"experiments/get-by-name?{encoded}")
            return response["experiment"]["experiment_id"]
        raise


def create_runs(base, expid, sha, count):
    results = {}
    for model in MODEL_IDS:
        display = "Qwen3.5-27B Pretrained" if model == MODEL_IDS[0] else "PatchReason-LoRA Epoch1"
        run = mlflow_api(base, "runs/create", {
            "experiment_id": str(expid), "run_name": display,
            "start_time": now_ms(),
            "tags": [
                {"key": "evaluation.protocol", "value": "strict-json-binary-v1"},
                {"key": "evaluation.split", "value": "heldout_test_not_trained"},
                {"key": "evaluation.label_quality", "value": "upstream_unverified"},
            ]
        })["run"]
        rid = run["info"]["run_id"]
        mlflow_api(base, "runs/log-batch", {
            "run_id": rid,
            "params": [
                {"key": "model", "value": model},
                {"key": "dataset", "value": "sijjeel/js-vuln-dataset heldout test"},
                {"key": "dataset_sha256", "value": sha},
                {"key": "dataset_count", "value": str(count)},
                {"key": "temperature", "value": "0"},
                {"key": "max_tokens", "value": "96"},
                {"key": "enable_thinking", "value": "false"},
                {"key": "response_protocol", "value": "exactly {vulnerable: bool} JSON"},
            ]
        })
        results[model] = rid
    return results


def inference(base, record, model):
    payload = {
        "model": model,
        "messages": record["messages"],
        "temperature": 0,
        "max_tokens": 96,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    started = time.perf_counter()
    error_type = ""
    content = ""
    tokens = {}
    try:
        result = request_json(f"{base.rstrip('/')}/v1/chat/completions", payload, timeout=120)
        content = result["choices"][0]["message"].get("content") or ""
        tokens = result.get("usage") or {}
        try:
            obj = json.loads(content.strip())
            predicted = obj["vulnerable"]
            if set(obj) != {"vulnerable"} or type(predicted) is not bool:
                raise ValueError("Not the exact required JSON object")
            status = "valid"
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            status = "invalid_response"
            predicted = None
    except urllib.error.HTTPError as e:
        status = "api_error"
        predicted = None
        error_type = f"HTTP_{e.code}"
    except (urllib.error.URLError, TimeoutError, OSError, KeyError, IndexError) as e:
        status = "api_error"
        predicted = None
        error_type = type(e).__name__

    return {
        "index": record["index"], "model": model,
        "input_sha256": record["input_sha256"],
        "expected": record["expected"], "predicted": predicted,
        "status": status, "error_type": error_type,
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        "prompt_tokens": tokens.get("prompt_tokens"),
        "completion_tokens": tokens.get("completion_tokens"),
        "output_sha256": digest(content.encode()) if content else "",
    }


def aggregate(rows, expected_count):
    by_status = defaultdict(int)
    tp = tn = fp = fn = 0
    lat = []
    good_lat = []
    outtok = []
    for r in rows:
        by_status[r["status"]] += 1
        lat.append(float(r["latency_ms"]))
        if r["status"] != "valid":
            continue
        good_lat.append(float(r["latency_ms"]))
        if isinstance(r.get("completion_tokens"), int):
            outtok.append(r["completion_tokens"])
        true, pred = r["expected"], r["predicted"]
        if true and pred: tp += 1
        elif true and not pred: fn += 1
        elif not true and pred: fp += 1
        else: tn += 1
    valid = by_status["valid"]
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    srt = sorted(good_lat)
    p95 = srt[max(0, math.ceil(0.95 * len(srt)) - 1)] if srt else 0.0
    return {
        "attempted": len(rows), "test_total": expected_count, "valid": valid,
        "invalid": by_status["invalid_response"], "api_errors": by_status["api_error"],
        "coverage": valid / expected_count if expected_count else 0,
        "accuracy_valid": (tp + tn) / valid if valid else 0,
        "accuracy_all": (tp + tn) / expected_count if expected_count else 0,
        "precision": precision, "recall": recall, "f1": f1,
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "latency_mean_ms": statistics.mean(good_lat) if good_lat else 0,
        "latency_p95_ms": p95,
        "completion_tokens_mean": statistics.mean(outtok) if outtok else 0,
    }


def log_metrics(base, run_id, metrics, step):
    timestamp = now_ms()
    all_metrics = [
        {"key": str(k), "value": float(v), "timestamp": timestamp, "step": step}
        for k, v in metrics.items() if isinstance(v, (int, float)) and math.isfinite(v)
    ]
    mlflow_api(base, "runs/log-batch", {"run_id": run_id, "metrics": all_metrics})


def confusion_svg(model, stats):
    vals = [stats["tn"], stats["fp"], stats["fn"], stats["tp"]]
    cells = []
    for i, n in enumerate(vals):
        x = (220, 405, 220, 405)[i]
        y = (130, 130, 275, 275)[i]
        shade = ["#e3f3ec", "#fce8e6", "#fce8e6", "#e3f3ec"][i]
        cells.append(f'<rect x="{x}" y="{y}" width="165" height="125" rx="8" fill="{shade}"/>')
        cells.append(f'<text x="{x+82}" y="{y+74}" text-anchor="middle" font-family="Arial" font-size="44" fill="#152235">{n}</text>')
    title = model.replace("&", "&amp;").replace("<", "&lt;")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="630" height="460" viewBox="0 0 630 460">
<rect width="630" height="460" fill="#fff"/>
<text x="25" y="37" font-family="Arial" font-size="20" font-weight="bold" fill="#172236">{title}</text>
<text x="25" y="63" font-family="Arial" font-size="13" fill="#667085">Held-out source labels (not independently verified), valid model outputs only</text>
<text x="395" y="102" text-anchor="middle" font-family="Arial" font-size="16" fill="#172236">Predicted</text>
<text x="305" y="122" font-family="Arial" font-size="13" fill="#172236">Safe</text>
<text x="476" y="122" font-family="Arial" font-size="13" fill="#172236">Vulnerable</text>
<text x="28" y="188" font-family="Arial" font-size="15" fill="#172236">Actual safe</text>
<text x="28" y="337" font-family="Arial" font-size="15" fill="#172236">Actual vulnerable</text>
{''.join(cells)}
<text x="25" y="439" font-family="Arial" font-size="13" fill="#667085">Valid {stats['valid']}/{stats['test_total']}, invalid {stats['invalid']}, API errors {stats['api_errors']}</text>
</svg>'''


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--test", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--vllm", default="http://127.0.0.1:8000")
    p.add_argument("--mlflow", default="http://127.0.0.1:5000")
    p.add_argument("--count", type=int, default=300)
    p.add_argument("--sha256", help="Expected held-out test file SHA-256")
    p.add_argument("--preflight", action="store_true", help="Verify test data and APIs, do not create runs or run inference")
    args = p.parse_args()
    records, actual_sha = load_records(args.test, args.count)
    if args.sha256 and args.sha256 != actual_sha:
        raise SystemExit(f"SHA-256 mismatch: expected {args.sha256} but found {actual_sha}")
    print(f"TEST FILE: {args.test}\nTEST COUNT: {len(records)}\nSHA256: {actual_sha}", flush=True)
    print(f"Label distribution: vulnerable={sum(x['expected'] for x in records)} safe={sum(not x['expected'] for x in records)}", flush=True)
    print(f"vLLM MODELS: {sorted(fetch_models(args.vllm))}", flush=True)
    mlflow_api(args.mlflow, "experiments/search", {"max_results": 1})
    print("MLFLOW: REACHABLE", flush=True)
    if args.preflight:
        print("PREFLIGHT PASSED. NO INFERENCE, NO MLFLOW RUNS CREATED.", flush=True)
        return

    output = args.out
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o700)
    state_path = output / "state.json"
    predictions_path = output / "predictions.jsonl"
    if state_path.exists():
        state = json.loads(state_path.read_text())
        if state["test_sha256"] != actual_sha or state["test_count"] != len(records):
            raise RuntimeError("Output directory holds results for a different test dataset")
        if state["vllm"] != args.vllm or state["mlflow"] != args.mlflow:
            raise RuntimeError("Resume requires same vLLM and MLflow endpoints")
        runs = state["runs"]
        print("Resuming existing MLflow runs", flush=True)
    else:
        if predictions_path.exists():
            raise RuntimeError("Found predictions but no state.json; refusing ambiguous resume")
        eid = experiment_id(args.mlflow)
        runs = create_runs(args.mlflow, eid, actual_sha, len(records))
        state = {"test_sha256": actual_sha, "test_count": len(records), "vllm": args.vllm,
                 "mlflow": args.mlflow, "runs": runs, "started_utc": datetime.now(timezone.utc).isoformat()}
        state_path.write_text(json.dumps(state, indent=2) + "\n")
        state_path.chmod(0o600)

    done = {}
    if predictions_path.exists():
        for line in predictions_path.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                done[(r["index"], r["model"])] = r
    print(f"Existing results: {len(done)}/{len(records)*len(MODEL_IDS)}", flush=True)
    with predictions_path.open("a", encoding="utf-8") as stream:
        predictions_path.chmod(0o600)
        for record in records:
            for model in MODEL_IDS:
                key = (record["index"], model)
                if key in done:
                    continue
                item = inference(args.vllm, record, model)
                stream.write(json.dumps(item, separators=(",", ":")) + "\n")
                stream.flush()
                done[key] = item
                model_rows = [r for (i, m), r in done.items() if m == model]
                if len(model_rows) % 10 == 0 or len(model_rows) == len(records):
                    stats = aggregate(model_rows, len(records))
                    try:
                        log_metrics(args.mlflow, runs[model], stats, len(model_rows))
                    except Exception as e:
                        print(f"MLflow temporary logging issue for {model}: {type(e).__name__}: {e}", flush=True)
                    print(f"{model}: {len(model_rows)}/{len(records)}; valid={stats['valid']} "
                          f"accuracy_valid={stats['accuracy_valid']:.3f} f1={stats['f1']:.3f} "
                          f"invalid={stats['invalid']} api_errors={stats['api_errors']}", flush=True)

    summary = {"project": "PatchReason", "dataset": "heldout-test", "test_sha256": actual_sha,
               "source_labels_verified": False, "status": "complete", "models": {}}
    for model in MODEL_IDS:
        rows = [r for (i, m), r in sorted(done.items()) if m == model]
        stats = aggregate(rows, len(records))
        summary["models"][model] = {"mlflow_run_id": runs[model], **stats}
        suffix = "base" if model == MODEL_IDS[0] else "lora"
        (output / f"confusion_{suffix}.svg").write_text(confusion_svg(model, stats))
        log_metrics(args.mlflow, runs[model], stats, len(rows))
        status = "FINISHED" if len(rows) == len(records) else "FAILED"
        mlflow_api(args.mlflow, "runs/update", {"run_id": runs[model], "status": status, "end_time": now_ms()})
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (output / "summary.json").chmod(0o600)
    with (output / "predictions.csv").open("w", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["index", "model", "input_sha256", "expected", "predicted",
                      "status", "error_type", "latency_ms", "prompt_tokens",
                      "completion_tokens", "output_sha256"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(r for _, r in sorted(done.items()))
    (output / "predictions.csv").chmod(0o600)
    print("\nEVALUATION FINISHED", flush=True)
    print(json.dumps(summary["models"], indent=2), flush=True)
    print(f"Files: {output}", flush=True)
    print(f"MLflow dashboard: {args.mlflow} / experiment {EXPERIMENT}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FATAL: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
