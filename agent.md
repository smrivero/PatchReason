# Agent notes

## Completed

- Built the local PatchReason React UI in `app/` from `CURSOR_UI_PROMPT.md`.
- Wired overview counts to the committed intake manifests.
- Left dataset scripts, configs, and existing research notes in place.
- Documented routes and contracts in `docs/UI_IMPLEMENTATION.md`.
- Replaced the default dark shell with a light dashboard: sidebar, KPI cards, review workspace, and pending states for scores, GPU throughput, and training history.
- Split original selected counts from the 2,048-token budget, and showed the single-B200 LoRA candidate as prepared but not trained.
- Added an Evidence page with empty states, and let illustrative code reviews render before a gateway is connected.
- Connected Code review to the local FastAPI gateway. Live reviews use `jetson-qwen35-4b` (Ollama `qwen3.5:4b`) and keep that label separate from the B200 LoRA candidate.
- Removed the demo-data control. Sample code stays labeled as a reference annotation. Review progress, gateway status, corrected line highlights, and latency in seconds stay on screen.

## Open

- Label and license review for `sijjeel/js-vuln-dataset` revision `7f36e5e1f0868d963c109acae5db4b094950675b`.
- Human review of the security-patch candidate queue. Training-approved rows are still zero.
- A single-B200 NeMo LoRA file. The published recipe remains multi-GPU.
- A gateway path for Qwen3.5-27B and the B200 LoRA adapter. The current FastAPI process serves only the pretrained Jetson 4B model.
- Scored evaluation output and a real `nvidia-smi` capture.

## Next

- Run `cd app && npm run dev` locally and review the empty states before any fixture screenshots.
- Set `VITE_API_BASE_URL` to `http://127.0.0.1:8000`, start `api/main.py`, and confirm the SSH tunnel before a live review.
- Import score JSON, run JSON, and `gpu.csv` only from files produced by a real session.
- Capture `screenshots/01-overview.png` through `screenshots/12-artifacts.png` when the underlying evidence exists.
