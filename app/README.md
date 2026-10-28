# PatchReason UI

React and TypeScript interface for PatchReason security screening, model comparison, dataset provenance, and GPU evidence. Screens display imported measurements or explicit empty states when evidence is unavailable.

The browser connects to the FastAPI gateway, which communicates with the configured inference backend.

## Requirements

- macOS
- Node.js 20 or newer
- npm

Python, a GPU, and a model server are not required to run the interface.

## Setup

From this directory:

```bash
cd app
npm install
cp .env.example .env.local
npm run check
npm run dev
```

Open `http://127.0.0.1:5173`.

`npm run build` typechecks and writes `dist/`. `npm run preview` serves that build on port 4173.

Leave `VITE_API_BASE_URL` empty to browse the UI with live review disabled. To call the configured model, set it to `http://127.0.0.1:8000` and start the FastAPI gateway in `api/`. The browser talks only to that gateway. The primary B200/vLLM backend uses `api.b200_gateway:app`; see `docs/DEPLOYMENT.md`. Do not put the Jetson address, the Ollama URL, a vLLM URL, or a token in any `VITE_` variable. Vite exposes those variables to the browser. The gateway CORS list allows the dev server on port 5173.

## What the screens show

| Route | Default content |
| --- | --- |
| `/` | Original selection, 2,048-token budget counts, pipeline status, label chart |
| `/review` | Split editor. Sample code stays labeled as a reference annotation. Review code calls `POST /api/reviews` when the selected model is ready |
| `/compare` | Side-by-side baseline and LoRA cards. Empty state says Awaiting evaluation |
| `/evaluation` | `No scored evaluation results available`, with pending metric shells |
| `/gpu` | Reserved telemetry sections. No readings until a capture is loaded |
| `/evidence` | Empty slots for Nsight, nvtop, nvidia-smi, training metrics, evaluation, and GPU charts |
| `/runs` | Empty history until a verified recorded run exists, plus the artifact checklist |
| `/methodology` | Product requirements, provenance, token budget, LoRA configuration, evaluation design |

Sample code on the review page fills the editor from `datasets/reference_examples.jsonl`. Its reference annotation is labeled separately from model predictions. Check gateway keeps a persistent status of Checking, Connected, Disconnected, or Error.

## Layout

```text
src/components/   Shell, editor, charts, findings
src/pages/        One route per screen
src/hooks/        Shared workspace, titles, gateway reads
src/lib/api/      Axios client and path constants
src/lib/fixtures/ Synthetic review text and the GPU fixture
src/lib/parse/    Manifest, evaluation, CSV, and run parsers
src/types/        Domain types
src/styles/       Tailwind entry
```

Counts on the overview come from `results/data_intake/js_binary_manifest.json`, `results/data_intake/sequence_budget_2048.json`, `results/data_intake/nemo_data_readiness.json`, `results/data_intake/candidate_review_summary.json`, and `results/data_intake/audit.json`. The LoRA card reads `config/nemo/qwen35_27b_b200_lora_candidate.yaml`. Vite reads those files at build time. The UI parses them again and shows an error if the shape changes.

## Screenshots

Save real captures under `screenshots/` using the names in `docs/OBSERVABILITY.md`. Keep each capture associated with the corresponding run and measured output. `docs/GPU_SCREENSHOT_MATRIX.md` says which route to shoot and when.
