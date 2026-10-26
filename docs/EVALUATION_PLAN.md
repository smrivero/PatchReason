# Evaluation Protocol

## Baselines

Compare (A) foundation model with a simple prompt, (B) foundation model with a well-engineered structured prompt, and (C) identical foundation model with task-specific LoRA. Use a consistent sampling policy and response schema.

## Data isolation

Separate training, validation and evaluation by **repository or originating codebase**, not merely by random line-level splits. Remove exact and near duplicates. Keep final evaluation examples out of prompt iteration and training.

## Metrics

- Precision = TP / (TP + FP).
- Recall = TP / (TP + FN).
- F1 = 2 * precision * recall / (precision + recall).
- Benign snippet false-positive rate = benign examples with any unsupported finding / all benign examples.
- JSON validity = responses matching the defined schema / all responses.
- Remediation usefulness = manually scored with a published rubric.

Record CWE matches separately from vulnerability presence. Require evidence for every claimed finding. Unresolvable cases receive an adjudication flag rather than being silently labelled.

## Performance

Record GPU model, driver, container digest, model revision, adapter revision, dtype, quantization, tokenizer revision, batch size, sequence length, concurrency, prompt/output lengths, and profiler settings. Report latency percentiles, tokens/sec, peak VRAM and measurement methodology.

## Reporting

Use tables and charts generated from stored results. Never populate example numbers as if measured. Preserve scripts, raw measurement files and methodology.
