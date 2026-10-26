# PatchReason: Binary Vulnerability Data Pipeline

## Engineering decision

PatchReason's target product is an automated JavaScript/TypeScript security reviewer that reports specific findings, explains the vulnerable behavior, and proposes remediations. The present component only prepares **binary vulnerability classification** data. It does **not** produce CWE labels, vulnerability locations, severities, or fixes.

The earlier public patch source, [`rgaucher/security-vuln-patches`](https://huggingface.co/datasets/rgaucher/security-vuln-patches), supplied 71 JS/TS candidate records after scope expansion. Manual inspection found multiple unsupported CWE assignments. That source remains in a separate provenance and review workflow; no such record is automatically approved for model adaptation.

To make progress without training on unverified CWE annotations, PatchReason adds a second data source: [`sijjeel/js-vuln-dataset`](https://huggingface.co/datasets/sijjeel/js-vuln-dataset), documented as 6,990 train, 1,498 validation and 1,499 test records. The published columns are `code` and `label` (1 = vulnerable; 0 = safe). The dataset card describes it as a cleaned and balanced derivative of [CVEfixes](https://github.com/secureIT-project/CVEfixes). Dataset license is listed as CC BY 4.0; original source-code licensing and terms are still subject to review.

This dataset is **not** a source of independently established CWE/fix truth. Its label validity needs spot review. A before/after version may still share a vulnerability family or function context; upstream leakage controls cannot be assumed perfect. It is also not evidence that the base Qwen model did not see any of the code during pretraining.

## Process and reproducibility

1. Resolve the dataset's exact Hugging Face commit SHA using `HfApi().dataset_info()`.
2. Load its published splits with the resolved SHA using `datasets.load_dataset()`.
3. Require a function string and binary label; drop very short or overly long inputs.
4. Apply whitespace-normalized SHA-256 duplicate controls across selected partitions. Select evaluation first, then validation, then training, while respecting the **original upstream split** for every record. No reshuffling between source splits.
5. Select deterministically and balance each split. Record revision, record counts, class counts, output hashes, filters and remaining limitations in `results/data_intake/js_binary_manifest.json`.
6. Store code-containing data only under `datasets/private/derived/js_binary/`, excluded by `.gitignore`.
7. Format input/target as `messages` JSONL with the *only* expected assistant content `{ "vulnerable": true|false }`.
8. Inspect and approve source rights and a representative quality sample before admitting labels to model training.
9. Freeze `test_chat.jsonl` from any model selection, prompt selection or fine-tuning choices. A separate PR-level benchmark remains necessary for the final product claim.

## Local execution on macOS

```bash
cd /Users/smrivero/Documents/GitHub/PatchReason
source .venv/bin/activate
python -m pip install -r requirements-data.txt
python scripts/prepare_js_vulnerability_data.py --train 1500 --validation 200 --test 200
python scripts/validate_js_vulnerability_data.py
python -m json.tool results/data_intake/js_binary_manifest.json
```

The prepared `messages` JSONL is a portable intermediary format, **not yet a verified NeMo AutoModel recipe**. A pinned NeMo container configuration and its loader/collator contract will be established separately before renting the B200.

## Evaluation scope

For binary classification report precision, recall, F1, confusion matrix, false-positive rate, and JSON compliance; also show performance across safe and vulnerable subsets. A balanced evaluation split does not estimate production prevalence. Do not use the test partition during prompt, hyperparameter, or checkpoint selection.

Specific CWE identification and remediation generation require a separate provenance-checked annotation corpus, including safe counterexamples and source/commit evidence. Do not synthesize a CWE or remediation field from binary labels.

## Related references

- [Hugging Face: JS Vulnerability Detection Dataset](https://huggingface.co/datasets/sijjeel/js-vuln-dataset)
- [CVEfixes GitHub](https://github.com/secureIT-project/CVEfixes)
- [CVEfixes v1.0.8 archive](https://zenodo.org/records/13118970) (12.7 GB compressed; deferred)
- [NeMo AutoModel repository](https://github.com/NVIDIA-NeMo/Automodel)
- [NeMo AutoModel LoRA documentation](https://github.com/NVIDIA-NeMo/Automodel#llm-parameter-efficient-fine-tuning-peft)
- [Qwen3.5-27B model card](https://huggingface.co/Qwen/Qwen3.5-27B)
