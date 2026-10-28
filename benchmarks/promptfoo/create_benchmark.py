import json
from pathlib import Path

root = Path(__file__).resolve().parent

patterns = [
    ("eval", True,
     "function task_N(input) { return eval(input); }"),
    ("command_injection", True,
     "const cp = require('child_process'); function task_N(input) { cp.exec('echo ' + input); }"),
    ("sql_injection", True,
     "function task_N(db, id) { return db.query('SELECT * FROM users WHERE id=' + id); }"),
    ("xss", True,
     "function task_N(element, input) { element.innerHTML = input; }"),
    ("hardcoded_secret", True,
     "function task_N() { return { apiKey: 'production-secret-N' }; }"),
    ("path_traversal", True,
     "const fs = require('fs'); function task_N(name) { return fs.readFileSync('/data/' + name); }"),

    ("safe_json", False,
     "function task_N(input) { return JSON.parse(input); }"),
    ("safe_text", False,
     "function task_N(element, input) { element.textContent = input; }"),
    ("safe_sql", False,
     "function task_N(db, id) { return db.query('SELECT * FROM users WHERE id = ?', [id]); }"),
    ("safe_math", False,
     "function task_N(a, b) { return Number(a) + Number(b); }"),
    ("safe_path", False,
     "const path = require('path'); function task_N() { return path.join('/data', 'public.txt'); }"),
    ("safe_validation", False,
     "function task_N(value) { return typeof value === 'string' && value.length < 100; }"),
]

tests = []

for category, vulnerable, template in patterns:
    for i in range(1, 11):
        code = template.replace("N", str(i))
        tests.append({
            "description": f"{category}-{i:02d}",
            "vars": {
                "code": code,
                "category": category,
                "expected_label": "vulnerable" if vulnerable else "safe"
            },
            "assert": [{
                "type": "equals",
                "value": "vulnerable" if vulnerable else "safe"
            }]
        })

parser = (
    "(json) => {"
    " if (typeof json.vulnerable !== 'boolean')"
    " throw new Error('Missing vulnerable boolean');"
    " return {"
    " output: json.vulnerable ? 'vulnerable' : 'safe',"
    " tokenUsage: {"
    " prompt: json.usage?.prompt_tokens,"
    " completion: json.usage?.completion_tokens,"
    " total: (json.usage?.prompt_tokens || 0) + (json.usage?.completion_tokens || 0)"
    " },"
    " metadata: {"
    " latency_ms: json.latency_ms,"
    " request_id: json.id,"
    " model_id: json.model_id,"
    " mode: json.mode,"
    " raw_response: json"
    " }"
    " };"
    "}"
)

models = [
    ("Qwen3.5-27B-Base", "Qwen/Qwen3.5-27B"),
    ("Qwen3.5-27B-LoRA", "Qwen/Qwen3.5-27B+lora")
]

providers = []

for label, model in models:
    providers.append({
        "id": "http",
        "label": label,
        "config": {
            "url": "http://127.0.0.1:8001/api/reviews",
            "method": "POST",
            "headers": {"Content-Type": "application/json"},
            "body": {
                "model": model,
                "language": "javascript",
                "filename": "benchmark.js",
                "code": "{{code}}"
            },
            "transformResponse": parser,
            "maxRetries": 0
        }
    })

config = {
    "description": "PatchReason B200 inference benchmark 120 cases Base vs LoRA",
    "prompts": ["{{code}}"],
    "providers": providers,
    "tests": tests,
    "evaluateOptions": {
        "maxConcurrency": 2,
        "cache": False,
        "timeoutMs": 180000
    }
}

output = root / "promptfooconfig-120.json"
output.write_text(json.dumps(config, indent=2))

print(f"Configuration: {output}")
print(f"Test cases: {len(tests)}")
print(f"Requests across both models: {len(tests)*len(models)}")
