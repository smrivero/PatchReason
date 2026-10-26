# Qwen3.5-27B Sequence Length Policy

## Selected configuration

Initial maximum sequence length: 2048 tokens.

Token counts use the Qwen3.5-27B tokenizer, with its
chat template and the expected assistant response.

## Measured distribution

Training: 4,000 original records.
- P50: 247 tokens
- P95: 934 tokens
- P99: 2,129 tokens
- Above 2048: 47 records

Validation: 300 original records.
- P50: 245 tokens
- P95: 1,037 tokens
- P99: 2,897 tokens
- Above 2048: 6 records

## Data handling

Records exceeding 2048 tokens are excluded from the
initial training and validation exports, not truncated.

Original records remain unchanged.

The final held-out evaluation dataset is not inspected
or included in the B200 handoff.

The filtering process records the class distribution
before and after exclusion.

## Engineering limitations

The 2048-token setting is a starting configuration, not
a validated single-GPU memory limit.

Qwen3.5-27B uses a vision-language architecture.
NeMo runtime integration requires separate verification.

Upstream label reliability, repository-level overlap,
and source code usage rights remain pending review.

No GPU training or performance result is claimed.

## Evidence

Machine-readable results:
results/data_intake/sequence_budget_2048.json

Official references:
- https://huggingface.co/Qwen/Qwen3.5-27B
- https://docs.nvidia.com/nemo/automodel/v0.7/
