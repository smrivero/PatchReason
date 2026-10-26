# Local Inference Gateway: Jetson Qwen3.5:4B

## Engineering objective

Provide a functioning end-to-end code review workflow for the PatchReason web
interface while the target NVIDIA B200 / NeMo LoRA pipeline is still being
prepared. The local Jetson Qwen3.5:4B acts as a **temporary pretrained
model**, not a surrogate for the proposed Qwen3.5-27B LoRA model.

## Architecture and trust boundaries

- React remains on the developer's Mac (`127.0.0.1:5173`).
- FastAPI listens on `127.0.0.1:8000`; browser origins are allowlisted.
- SSH local port forwarding connects Mac port 11435 to Jetson loopback 11434.
- Ollama's chat API is used with JSON output and no streaming for the first version.
- API credentials, if introduced later, remain server-side.
- Never expose local Ollama directly on an Internet-accessible interface.

## Contract

`GET /api/status`, `GET /api/models`, and `POST /api/reviews` follow the frontend
contract defined in the initial UI design. Additional planned endpoints
respond with accurate empty states.

A review response includes model name, provider, latency, raw model prediction
fields, and a clear caveat that findings are not independently adjudicated.
The gateway does not represent detections as ground truth or as results of LoRA.

## Transition to B200

Replace only the provider adapter with an authenticated OpenAI-compatible vLLM
endpoint, and add a separately identified LoRA-adapted model after its runtime
and adapter checkpoint are validated. Preserve request/response compatibility
with the frontend and independent model identifiers.

## Source documentation

- https://docs.ollama.com/api/chat
- https://fastapi.tiangolo.com/tutorial/cors/
- https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
