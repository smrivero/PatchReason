# PatchReason UI

Local React interface for PatchReason. It shows the recorded dataset manifest, empty states for measurements that have not been collected, and labeled fixtures when demo data is turned on.

This is not a production deployment. The browser does not call vLLM.

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

Leave `VITE_API_BASE_URL` empty to browse the UI with live review disabled. To call the Jetson model, set it to `http://127.0.0.1:8000` and start the FastAPI gateway in `api/`. The browser talks only to that gateway. Ollama stays on the Mac SSH tunnel. Do not put the Jetson address, the Ollama URL, a vLLM URL, or a token in any `VITE_` variable. Vite exposes those variables to the browser. The gateway CORS list allows the dev server on port 5173.

## What the screens show

| Route | Default content |
| --- | --- |
| `/` | Original selection, 2,048-token budget counts, pipeline status, label chart |
| `/review` | Split editor. Sample code stays labeled as a reference annotation. Review code calls `POST /api/reviews` when Jetson Qwen3.5:4B is ready |
| `/compare` | Side-by-side baseline and LoRA cards. Empty state says Awaiting evaluation |
| `/evaluation` | `No scored evaluation results available`, with pending metric shells |
| `/gpu` | Reserved telemetry sections. No readings until a capture is loaded |
| `/evidence` | Empty slots for Nsight, nvtop, nvidia-smi, training metrics, evaluation, and GPU charts |
| `/runs` | Empty history until a verified recorded run exists, plus the artifact checklist |
| `/methodology` | Simulated brief, provenance, token budget, candidate LoRA status, evaluation design |

Sample code on the review page fills the editor from `datasets/reference_examples.jsonl`. Its reference annotation is labeled separately from Jetson findings. Check gateway keeps a persistent status of Checking, Connected, Disconnected, or Error.

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

Dataset pipelines, `scripts/`, `configs/`, and the existing Markdown notes are unchanged by the UI except for the status line and links in the root README.

## Screenshots

Save real captures under `screenshots/` using the names in `docs/OBSERVABILITY.md`. Leave that folder empty of benchmark images until a model response, a score file, or a GPU capture exists. `docs/UI_CAPTURE_GUIDE.md` says which route to shoot and when.
