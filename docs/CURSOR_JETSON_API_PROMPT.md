# Cursor prompt: connect PatchReason React to the Jetson inference gateway

Inspect the existing `app/` implementation in this repository, including its
API client, TypeScript response types, model selector, example fixtures and
Code Review page. The new `api/main.py` is implemented and runs on the Mac.

Implement a functional integration with these constraints:

1. Keep the current premium light theme and all existing routes/visual design.
2. Read the configured `VITE_API_BASE_URL` (e.g., `http://127.0.0.1:8000`).
3. When configured, use `GET /api/status` to determine `inference_ready`,
   then `GET /api/models` to populate the live model selector. The only current
   live model ID is `jetson-qwen35-4b` (actual Ollama model `qwen3.5:4b`).
4. On Review Code, send `POST /api/reviews`:
   `{ "code": "...", "language": "javascript" | "typescript", "model": "jetson-qwen35-4b", "filename": null }`.
5. Map its response `{id,created_at,model_id,model_name,provider,mode,
   vulnerable,summary,findings:[{title,severity,cwe,line,explanation,
   recommendation}],latency_ms,usage,limitations}` to the existing findings
   panel. Escaped text only, no unsafe HTML injection. Highlight the line if
   present. Use actual latency only when returned by the server.
6. Show a prominent but tasteful status label `Live inference · Jetson
   Qwen3.5:4B (pretrained)` when connected. Never display or describe the result
   as NVIDIA B200 inference, NeMo LoRA, or Qwen3.5-27B. Keep them separate
   in model selection and comparison screens.
7. Keep the existing illustrative examples as optional, explicitly labeled
   fixtures, independent of live inference.
8. If the gateway is unavailable, show connection instructions and retain
   the disabled review action. Handle loading, timeout, and HTTP 409/503/504
   errors clearly. Do not fall back silently to fabricated predictions.
9. Support `/api/status`, `/api/models`, `/api/reviews` rather than the
   obsolete singular `/api/review` endpoint. Preserve all other API contracts.
10. Do not modify dataset pipelines, NVIDIA configurations or scientific
    documentation. Update `app/README.md` and `docs/UI_IMPLEMENTATION.md`.
11. Run `npm run check` and `npm run build`, fix all errors. Do not commit or
    push automatically. Report the files changed.

The backend remains local, with Ollama reached over the Mac's SSH tunnel, not
via direct browser access to the Jetson.
