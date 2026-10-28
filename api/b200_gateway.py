"""PatchReason: OpenAI-compatible vLLM bridge for the B200 deployment.

Runs on the Mac, connecting only through an SSH tunnel to a loopback-bound
vLLM server on the B200. This project currently supervises binary vulnerability
classification, not CWEs, location, severity, or remediation.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

load_dotenv(Path(__file__).with_name(".env.b200"))
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://127.0.0.1:18000/v1").rstrip("/")
VLLM_BASE_MODEL = os.getenv("VLLM_BASE_MODEL", "Qwen/Qwen3.5-27B")
VLLM_LORA_NAME = os.getenv("VLLM_LORA_NAME", "patchreason-lora")
TIMEOUT = float(os.getenv("VLLM_TIMEOUT_SECONDS", "180"))
MAX_CODE_CHARS = int(os.getenv("MAX_CODE_CHARS", "10000"))
BASE_ID = "Qwen/Qwen3.5-27B"
LORA_ID = "Qwen/Qwen3.5-27B+lora"
ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if x.strip()]

app = FastAPI(title="PatchReason B200 Inference Gateway", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
generation_semaphore = asyncio.Semaphore(1)

SYSTEM_PROMPT = (
    "You are PatchReason, an AI security code reviewer. Classify the following "
    "JavaScript function based only on the code provided. Return exactly one "
    "JSON object containing a boolean field named vulnerable. Do not add a "
    "CWE classification or a remediation recommendation."
)


class ReviewRequest(BaseModel):
    code: str = Field(min_length=10)
    language: Literal["javascript", "typescript", "js", "ts", "jsx", "tsx"] = "javascript"
    model: str = BASE_ID
    filename: str | None = Field(default=None, max_length=255)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if len(value) > MAX_CODE_CHARS or not value.strip() or "\x00" in value:
            raise ValueError("Invalid code input or maximum code length exceeded")
        return value


def upstream_model(model_id: str) -> str:
    if model_id == BASE_ID:
        return VLLM_BASE_MODEL
    if model_id == LORA_ID:
        return VLLM_LORA_NAME
    raise HTTPException(status_code=409, detail=f"Unsupported model: {model_id}")


async def available_models() -> set[str]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(8, connect=3), follow_redirects=False) as client:
        response = await client.get(f"{VLLM_BASE_URL}/models")
        response.raise_for_status()
        return {str(x.get("id")) for x in response.json().get("data", []) if isinstance(x, dict)}


@app.get("/api/health")
def health():
    return {"ok": True, "service": "patchreason-b200-gateway"}


@app.get("/api/status")
async def status():
    try:
        names = await available_models()
        connected = True
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        names, connected = set(), False
    base_ready = VLLM_BASE_MODEL in names
    lora_ready = VLLM_LORA_NAME in names
    return {
        "status": "ready" if base_ready or lora_ready else "unavailable",
        "gateway": "PatchReason B200 FastAPI",
        "provider": "vllm",
        "connected": connected,
        "inference_ready": base_ready or lora_ready,
        "model": BASE_ID if base_ready else LORA_ID if lora_ready else None,
        "upstream_model": VLLM_BASE_MODEL,
        "model_trained_with_lora": lora_ready,
        "message": "B200 vLLM ready" if base_ready or lora_ready else "vLLM not available through the Mac SSH tunnel",
    }


@app.get("/api/models")
async def models():
    try:
        names = await available_models()
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        names = set()
    return {
        "default_model": BASE_ID,
        "models": [
            {"id": BASE_ID, "name": "Qwen3.5-27B (pretrained)", "provider": "vllm", "upstream_model": VLLM_BASE_MODEL,
             "available": VLLM_BASE_MODEL in names, "adapted": False, "description": "B200 base model"},
            {"id": LORA_ID, "name": "Qwen3.5-27B + PatchReason LoRA", "provider": "vllm", "upstream_model": VLLM_LORA_NAME,
             "available": VLLM_LORA_NAME in names, "adapted": True, "description": "LoRA: binary classification only; source labels not independently verified"},
        ],
    }


def parse_binary_reply(content: str) -> bool:
    # Prefer strict JSON; tolerate Qwen <think> wrappers or code fences.
    try:
        obj = json.loads(content)
    except json.JSONDecodeError:
        candidates = re.findall(r'\{\s*"vulnerable"\s*:\s*(?:true|false)\s*\}', content, re.I)
        if len(candidates) != 1:
            raise ValueError("Exactly one binary JSON object was not returned")
        obj = json.loads(candidates[0])
    if not isinstance(obj, dict) or set(obj) != {"vulnerable"} or type(obj["vulnerable"]) is not bool:
        raise ValueError("Expected only a boolean vulnerable field")
    return obj["vulnerable"]


@app.post("/api/reviews")
async def review(body: ReviewRequest):
    target = upstream_model(body.model)
    try:
        names = await available_models()
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="vLLM unavailable. Check SSH tunnel and B200 inference service.") from exc
    if target not in names:
        raise HTTPException(status_code=409, detail=f"Requested model is not served by vLLM: {body.model}")
    prompt = f"Review the following JavaScript function:\n\n```{body.language}\n{body.code}\n```"
    payload = {
        "model": target,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 64,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    start = time.perf_counter()
    try:
        async with generation_semaphore:
            async with httpx.AsyncClient(timeout=httpx.Timeout(TIMEOUT, connect=5), follow_redirects=False) as client:
                response = await client.post(f"{VLLM_BASE_URL}/chat/completions", json=payload)
                response.raise_for_status()
                raw = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="vLLM inference timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="vLLM returned a connection or HTTP error") from exc
    try:
        content = raw["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise ValueError("Missing model message content")
        prediction = parse_binary_reply(content)
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Model did not return valid binary JSON; classification cannot be established") from exc
    usage = raw.get("usage", {})
    if not isinstance(usage, dict):
        usage = {}
    return {
        "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(),
        "model": body.model, "model_id": body.model,
        "model_name": target, "provider": "vllm", "mode": "live", "is_demo": False,
        "vulnerable": prediction,
        "summary": "Binary classification: vulnerable." if prediction else "Binary classification: not marked vulnerable.",
        "findings": [],
        "latency_ms": round((time.perf_counter() - start) * 1000),
        "usage": {"prompt_tokens": usage.get("prompt_tokens"), "completion_tokens": usage.get("completion_tokens")},
        "limitations": [
            "The adapter was supervised only on binary labels; CWE, line, severity and remediation were not generated.",
            "Dataset label quality and underlying source-code licenses are pending review.",
            "Predictions are unverified and can contain false positives or false negatives.",
        ],
    }


@app.get("/api/evaluations/summary")
async def evaluations_summary():
    return {"status": "pending_collection", "metrics": None}


@app.get("/api/gpu/telemetry")
async def gpu_telemetry(run_id: str | None = None):
    return {"status": "not_collected", "run_id": run_id, "samples": []}


@app.get("/api/runs")
async def runs():
    return {"status": "not_started", "runs": []}
