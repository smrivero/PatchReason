#!/usr/bin/env python3
"""Offline static check of the candidate YAML without loading model weights."""
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/nemo/qwen35_27b_b200_lora_candidate.yaml"
REPORT = ROOT / "results/data_intake/sequence_budget_2048.json"


def main():
    c = yaml.safe_load(CONFIG.read_text())
    r = json.loads(REPORT.read_text())
    assert c["recipe"] == "FinetuneRecipeForVLM"
    assert c["model"]["pretrained_model_name_or_path"] == "Qwen/Qwen3.5-27B"
    assert (c["distributed"]["tp_size"], c["distributed"]["pp_size"]) == (1, 1)
    assert c["step_scheduler"]["max_steps"] == 2
    assert c["dataloader"]["collate_fn"]["max_length"] == r["max_sequence_tokens"] == 2048
    assert not c["peft"]["match_all_linear"] and len(c["peft"]["target_modules"]) >= 4
    assert c["dataset"]["split"] == "train"
    assert c["validation_dataset"]["split"] == "validation"
    assert "test" not in str(c["dataset"]) + str(c["validation_dataset"])
    assert c["freeze_config"]["freeze_vision_tower"]
    print("STATIC CONFIG: OK")
    print("Qwen3.5-27B, LoRA r=16 alpha=32, tp=1 pp=1, max_steps=2, seq_length=2048")
    print("Source labels and licensing: NOT APPROVED")
    print("NeMo runtime, GPU memory and adapter attachment: NOT YET VERIFIED")


if __name__ == "__main__":
    main()
