# Cursor implementation prompt: PatchReason web application

You are implementing the web interface for **PatchReason**, a professional AI-assisted source-code security review product. Work inside the existing Git repository at `/Users/smrivero/Documents/GitHub/PatchReason`.

## Project context

- The business requirement is documented as a **simulated stakeholder brief**, not an actual commissioned customer engagement. Do not claim a real client.
- Scope: security review of JavaScript/TypeScript, initially Node.js APIs. Later inference via Qwen3.5-27B, base model vs LoRA adapter adapted with NVIDIA NeMo on a B200.
- Current dataset facts: 4,000 training records (2,000 vulnerable / 2,000 safe), 300 validation (150/150), 300 held-out evaluation (150/150), from `sijjeel/js-vuln-dataset`, pinned revision `7f36e5e1f0868d963c109acae5db4b094950675b`. The ingestion and structural validation ran, but label review and licensing are pending. Do not portray dataset labels as audited or final quality outcomes.
- No model has yet been fine-tuned, no measured improvement or speed numbers exist, and no B200 profiling report has been collected. **Never fabricate measurements or show sample data as real**.

## Before editing

1. Inspect the existing repository (README, docs, `app/`, `api/`, `results/`, `screenshots/`, `.gitignore`) to preserve existing work and conventions.
2. Implement the frontend under `app/`. Keep the root scripts, dataset pipeline and documentation intact; do not overwrite existing content unrelated to frontend development.
3. Use a clean Vite + React + TypeScript setup, Tailwind CSS, Lucide icons and Recharts for charts. Prefer few dependencies and current stable compatible versions. Avoid introducing a production backend until interface/data contracts are clear.
4. Use npm, not Homebrew. Include a functioning `package.json`, lockfile, README instructions and `.env.example` for the frontend. Never commit credentials.

## Visual direction

A serious AI engineering dashboard rather than a landing page or generic chat app. Dark graphite/navy background, subdued steel/slate surfaces, blue accent, excellent contrast, restrained typography, clean alignment. Small vertical navigation and full-width content optimized for sharp 1440x900 and 1920x1080 desktop screenshots. Add mobile-responsive fallbacks. Product title: `PatchReason`. Subtitle: `AI-Assisted Code Security Review`. Include project architecture information without claiming the solution is in production.

## Screens / routes

1. `/` Overview: architecture strip (source → base Qwen3.5-27B → NVIDIA NeMo LoRA → adapted inference → evaluation), actual curated dataset counts, and clear implementation status. Tiles for model baseline, adapter, evaluation and GPU observation. If measurements do not exist, write `Pending collection`, never numeric placeholders that resemble real data.
2. `/review` Code Review: Monaco editor if reasonable (otherwise good styled textarea/code editor), JavaScript/TypeScript selector, base/fine-tuned model selector, submit action, typed structured response pane with severity, CWE, explanation and remediation. In demo mode use two or three local code examples and clearly label each output `Illustrative fixture / no model inference`. Actual inference controls should be disabled gracefully when no API is configured.
3. `/compare` Model Comparison: identical input shown side-by-side for baseline and adapted responses, differences, model identifiers, timings only if measured. When no model response exists, use empty states or prominently labeled fixture mode. Never imply LoRA improves quality before evaluation.
4. `/evaluation` Evaluation: real scoring data model (precision, recall, F1, false-positive rate, confusion matrix, per-CWE distributions where available), charts powered by actual imported JSON artifacts. Empty-state panel: `No scored evaluation results available`. Surface dataset provenance and potential pretraining contamination limitations. Build adapters/parsers so that future Promptfoo and benchmark JSON can populate the screen.
5. `/gpu` GPU Telemetry: utilization, VRAM, power, temperature and time series charts from a backend or imported `nvidia-smi` CSV, with source, timestamp, GPU model and collection window shown. Include a clearly identified demo-data switch that is off by default. Add an Nsight report link/file description when available; do not pretend to render an `.nsys-rep` directly in React.
6. `/runs` Training & Artifacts: dataset revisions, model identifier, container tag, LoRA configuration, run lifecycle, recorded scalar curves (train/validation loss only if available), links to selected screenshots/reports. No fake run results.
7. `/methodology` Engineering Methodology: concise explanation of data provenance, split sizes, deduplication limitations, model comparisons, evaluation design, and GPU instrumentation. Link to existing Markdown documentation in the Git repo or provide an internal view based on grounded text.

## Architecture and contracts

Create typed TypeScript interfaces for ReviewRequest, ReviewResponse, ModelInfo, EvaluationSummary, ConfusionMatrix, GpuSample, RunMetadata and Artifact. Split the frontend into `components/`, `pages/`, `lib/api/`, `lib/fixtures/`, `types/`, and `styles/` where useful. Do not force a backend dependency to launch the UI. Add a mock adapter with an explicitly visible `Demo data` banner when enabled.

Reserve these API contracts for a later FastAPI gateway, but keep them encapsulated in a typed client so paths can be changed:
- GET `/api/status`
- GET `/api/models`
- POST `/api/reviews` with code, language, model selector and optional filename
- GET `/api/evaluations/summary`
- GET `/api/gpu/telemetry?run_id=...`
- GET `/api/runs`

Never access vLLM directly from the public browser or expose server credentials. A future Python gateway must handle remote inference securely behind an SSH tunnel or authorized reverse proxy. Validate user input and keep rendering of code/LLM output escaped; never inject untrusted HTML into the DOM.

## Interaction requirements

- Functional navigation, example-code selection, copy findings action, loading/error/empty states, time-range selector for telemetry if actual data exists, export/import JSON or CSV for results where sensible.
- Demo mode must be opt-in and persist visibly on every screen while active. In default mode show only actual known dataset facts plus honest unavailable states.
- Support screenshot-friendly states without fabricated statistics; distinguish `data available` from `no results yet`.
- Build quality: `npm install`, `npm run build`, and `npm run dev` must work. Add a basic front-end check command if feasible. Check browser console and TypeScript errors.
- Provide a short implementation summary and commands to run locally on macOS. Do not automatically commit or push; leave Git operations to the user.

## Documentation and evidence

Update `app/README.md` with setup and architecture, and add `docs/UI_IMPLEMENTATION.md` with routes, design decisions, data sources, contracts, current limitations, and future B200 integration. Recommend screenshot locations in `screenshots/` without creating or labeling fabricated benchmark captures as genuine.

If any existing file conflicts with these instructions, preserve it and explain the decision. Build a functioning application, not mockup images or empty component stubs.
