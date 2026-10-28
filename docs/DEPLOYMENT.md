# B200 deployment

PatchReason serves Qwen3.5-27B and its LoRA adapter through vLLM on an NVIDIA B200. The React application connects through `api/b200_gateway.py`.

## Service connection

Keep vLLM bound to the GPU host loopback interface and forward its port through SSH. Configure the gateway with `api/.env.b200` or environment variables:

- `VLLM_BASE_URL`: forwarded endpoint, default `http://127.0.0.1:18000/v1`.
- `VLLM_BASE_MODEL`: upstream base-model name, default `Qwen/Qwen3.5-27B`.
- `VLLM_LORA_NAME`: upstream adapter name, default `patchreason-lora`.
- `VLLM_TIMEOUT_SECONDS`: request timeout, default `180`.
- `CORS_ORIGINS`: allowed frontend origins.

From the repository root, after installing `api/requirements.txt`:

```bash
python3 -m uvicorn api.b200_gateway:app --host 127.0.0.1 --port 8000
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` in `app/.env.local`. Check `/api/health`, `/api/status`, and `/api/models` before requesting a review. The LoRA option requires the adapter to be loaded by vLLM.

## Training and evidence

See [NeMo configurations](../config/nemo/README.md), [observability](OBSERVABILITY.md), and [the recorded execution evidence](../README.md#training-on-nvidia-b200). Preserve model and tokenizer revisions, container digest, driver and framework versions, configuration, checkpoint identity, and profiler settings for each new run.

## Access controls

The gateway has no built-in user authentication. Keep it on loopback for local access; shared deployments require an authenticated proxy and network controls. Store credentials on the server, outside version control and frontend environment variables.
