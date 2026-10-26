#!/usr/bin/env python3
"""Derive a low-overhead NeMo runtime compatibility configuration."""

from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]

source = ROOT / "config/nemo/qwen35_27b_b200_lora_candidate.yaml"
target = ROOT / "config/nemo/qwen35_27b_b200_compatibility.yaml"

config = yaml.safe_load(source.read_text())

assert config["model"]["pretrained_model_name_or_path"] == "Qwen/Qwen3.5-27B"
assert config["recipe"] == "FinetuneRecipeForVLM"

scheduler = config["step_scheduler"]
scheduler["max_steps"] = 2
scheduler["global_batch_size"] = 1
scheduler["local_batch_size"] = 1
scheduler["ckpt_every_steps"] = 1000
scheduler["val_every_steps"] = 1000

config["checkpoint"]["enabled"] = False

loader = (
    "/workspace/PatchReason/scripts/"
    "b200_synthetic_dataset.py:make_synthetic_dataset"
)

for key in ("dataset", "validation_dataset"):
    config[key]["_target_"] = loader
    config[key]["path_or_dataset"] = "synthetic"

target.write_text(
    "# PatchReason: synthetic-data GPU compatibility configuration.\n"
    "# Not a completed fine-tuning run or performance evaluation.\n"
    + yaml.safe_dump(config, sort_keys=False)
)

print("Created:", target)
print("Model:", config["model"]["pretrained_model_name_or_path"])
print("Optimizer steps:", scheduler["max_steps"])
print("Dataset: original synthetic examples")
print("Checkpoint writing:", config["checkpoint"]["enabled"])
print("GPU runtime validation: PENDING")
