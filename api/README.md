# PatchReason Inference Gateway

A FastAPI service that connects the React code-review UI to Ollama running
Qwen3.5:4B on an NVIDIA Jetson. This temporary inference target is **not**
the fine-tuned Qwen3.5-27B model planned for the NVIDIA B200.

## Architecture

`React (Mac, :5173) -> FastAPI (Mac, :8000) -> SSH tunnel (:11435) -> Ollama (Jetson, :11434)`

Ollama stays bound to the Jetson's loopback interface. Do not expose port
11434 to the public Internet. Keep FastAPI bound to `127.0.0.1` on the Mac.

## Quick start

From the repository root on macOS:

```bash
source .venv/bin/activate
python3 -m pip install -r api/requirements.txt
cp -n api/.env.example api/.env
python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

On the Mac, in a second terminal, forward the Jetson Ollama port:

```bash
ssh -o ExitOnForwardFailure=yes -N -L 11435:127.0.0.1:11434 srivero@JETSON_IP
```

The address is the Jetson's LAN address, which can be obtained there using
`hostname -I`. Do not insert a guessed IP address.

Test from the Mac:

```bash
curl -sS http://127.0.0.1:11435/api/tags
curl -sS http://127.0.0.1:8000/api/status
curl -sS http://127.0.0.1:8000/api/models
```

For a code review, send a POST request to `/api/reviews` with `code`,
`language`, and `model: "jetson-qwen35-4b"`.

## API contracts

- `GET /api/health`: gateway process only.
- `GET /api/status`: Ollama connectivity and model availability.
- `GET /api/models`: discover the available Jetson inference model.
- `POST /api/reviews`: structured, live model predictions.
- `GET /api/evaluations/summary`, `GET /api/gpu/telemetry`, `GET /api/runs`: explicitly unpopulated until genuine evidence exists.

The output includes actual model identity, inference latency, token counts
when supplied by Ollama, and model-generated findings. The API never
fabricates a vulnerability result when upstream inference is unavailable.

## Constraints

This gateway is for local development. It has no user authentication and
should never be exposed directly to the Internet. Do not submit proprietary
or sensitive code unless you control the destination and have permission.
Model-produced vulnerability findings need manual verification. The source
security-classification dataset does not train the model used here.

For frontend wiring, use `docs/CURSOR_JETSON_API_PROMPT.md`.
