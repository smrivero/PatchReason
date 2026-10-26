# UI implementation

The PatchReason web UI lives in `app/`. It is a Vite, React, and TypeScript interface for the engineering case study. It is not a deployed product, and the repository still does not claim a paying client.

`npm run check` and `npm run build` are the verification commands. `npm run dev` serves the local app on port 5173.

## Routes

| Path | Screen | Default state |
| --- | --- | --- |
| `/` | Overview | Original selection and 2,048-token budget counts, pipeline status, label chart |
| `/review` | Code review | Editor. Sample code is labeled as a reference annotation. Review code posts to the FastAPI gateway when Jetson Qwen3.5:4B is ready |
| `/compare` | Baseline and LoRA columns | Same input. Empty state `Awaiting evaluation` |
| `/evaluation` | Scores and confusion matrix | `No scored evaluation results available` |
| `/gpu` | Utilization, memory, power, temperature, throughput | Empty. Illustrative switch off. Throughput stays unmeasured |
| `/evidence` | Nsight, nvtop, nvidia-smi, training, evaluation, GPU charts | Empty until real captures exist |
| `/runs` | Recorded-run history | Empty table until a verified recorded run exists. Plan stays in a disclosure |
| `/methodology` | Provenance, limitations, simulated brief | Text grounded in the existing docs |

Unknown paths render a short not-found page with a link back to the overview.

## Visual decisions

The default theme is light. The page background is `#F7F9FC`, cards are white, text is `#172033`, borders are `#E5EAF2`, and the accent is indigo `#4F46E5`. The sidebar is 248px from the `md` breakpoint up, with the wordmark PatchReason and the subtitle AI Code Security. Narrower windows use a stacked header and wrapped navigation. Page titles stay in sentence case.

Long methodological limits live on the methodology page. The overview states training has not started once, on the LoRA card. Label and license review uses a readable label. Internal enum strings stay in the intake details.

The code editor is a monospace textarea with a line gutter, a light token overlay drawn as React text nodes, and amber bands on the source line that supports a finding. A model line that does not match the source is kept in the finding text and is not painted on an unrelated line. That keeps Monaco out of the bundle. Sample code can show a reference annotation labeled separately from Jetson output. Review code posts to `/api/reviews`. While the request runs, the page shows a spinner, elapsed seconds, and Cancel review. Results and errors stay on screen until the next review or Clear results. Measured latency is shown in seconds with one decimal place. The connected label is `Live inference · Jetson Qwen3.5:4B (pretrained)`. The app does not inject review text or model text as HTML.

Charts use Recharts with animation off, so a screenshot does not catch a half-drawn line. The overview chart groups vulnerable and safe counts by the original train, validation, and held-out partitions. The token-budget retained counts come from `results/data_intake/sequence_budget_2048.json`. Ratio charts use a 0 to 100 axis. CWE count charts scale to the largest count in that file. GPU throughput has a reserved card and no derived number.

`config/nemo/qwen35_27b_b200_lora_candidate.yaml` is read at build time. The UI reports configuration prepared and structural validation completed only when the same offline checks as `scripts/validate_b200_candidate.py` pass. GPU runtime validation stays pending. The Evidence page does not draw captures that are not in the repository.

## Data sources

Overview counts are read from these committed files when Vite starts or builds:

- `results/data_intake/js_binary_manifest.json`
- `results/data_intake/candidate_review_summary.json`
- `results/data_intake/audit.json`
- `results/data_intake/sequence_budget_2048.json`
- `results/data_intake/nemo_data_readiness.json`
- `config/nemo/qwen35_27b_b200_lora_candidate.yaml`

The binary manifest supplies the original selected train, validation, and held-out counts. The sequence-budget file supplies the records kept under 2,048 tokens. The UI labels vulnerable and safe as upstream labels. It does not describe them as audited. Counts that disagree across those files are shown as a parse error instead of a blended number.

The candidate summary and the earlier intake audit stay on separate cards so their row counts are not merged. Upstream CWE tallies are not drawn as an evaluation chart.

`datasets/reference_examples.jsonl` supplies three sample snippets for the editor. On Code review they are labeled Sample code. Showing a reference annotation does not present it as model output, and it does not replace a Jetson review already on screen.

No screen invents F1, loss, or GPU samples. Empty slots say `Pending collection` or the empty sentence required for evaluation. A completed review shows the gateway latency in seconds.

## API contracts

`src/lib/api/paths.ts` holds the paths. `src/lib/api/client.ts` calls them with axios when `VITE_API_BASE_URL` is a credential-free `http` or `https` URL. The local Jetson gateway is `http://127.0.0.1:8000`. A 404 on the evaluation, run, and telemetry reads is treated as an empty result. Payloads whose `status` is `pending_collection`, `not_collected`, or `not_started` are also empty, so connecting the Jetson gateway does not fill those screens with parse errors.

| Method | Path | Body or query | Accepted payload |
| --- | --- | --- | --- |
| GET | `/api/status` | none | Jetson fields `inference_ready`, `gateway`, `model`, `upstream_model`, `model_trained_with_lora`, `message`, or the older `gatewayVersion` plus `inference` of `ready` or `unavailable` |
| GET | `/api/models` | none | `{ default_model, models: [{ id, name, upstream_model, description, available, adapted }] }`, or the older array of id, display name, role, revision, and availability |
| POST | `/api/reviews` | Live body `code`, `language`, `model` `jetson-qwen35-4b`, `filename` null or a basename. The older body still sends `modelId` for a non-Jetson gateway | Jetson review with `model_id`, `mode` `live`, `vulnerable`, `summary`, findings (`title`, `severity`, `cwe`, `line`, `explanation`, `recommendation`), `latency_ms`, `usage`, `limitations`. Older reviews still use `modelId`, `timing`, `evidence`, and `remediation` |
| GET | `/api/evaluations/summary` | none | `patchreason.evaluation.v1`, `patchreason.evaluation.cases.v1`, `{ "kind": "empty" }`, or `{ "status": "pending_collection" }` |
| GET | `/api/gpu/telemetry` | `run_id` | `patchreason.gpu.v1` with `collection: "measured"`, `{ "kind": "empty" }`, or `{ "status": "not_collected" }` |
| GET | `/api/runs` | none | `patchreason.run.v1`, `{ "kind": "empty" }`, or `{ "status": "not_started" }` |

A review payload that carries the fixture label is rejected. A served model may include `endpointLabel` as a short name. URLs in that field are rejected so the browser does not render a host address from the gateway.

The GPU JSON schema has to say `collection: "measured"`. CSV import is separate. The page shows the file name and says it did not prove that `nvidia-smi` wrote the file.

Numeric bounds for telemetry are utilization 0 to 100, VRAM 0 to 10,000,000 MiB, temperature -20 to 120 C, and power 0 to 5000 W. Rows outside those bounds are skipped in a CSV and rejected in JSON.

Evaluation ratios are recomputed from the confusion matrix. A file whose stated precision, recall, F1, or false-positive rate disagrees by more than 0.000001 is rejected. Promptfoo exports are recognized and refused, because an assertion pass rate is not an F1 score.

Case files use `expected` and `predicted` values of `vulnerable` or `safe`, and `cwe` of `none` or `CWE-` plus digits. The browser computes the matrix from those rows.

## Current limits

- `api/main.py` is the local FastAPI gateway for Jetson Qwen3.5:4B (`jetson-qwen35-4b`, Ollama model `qwen3.5:4b`). Review code stays disabled until `GET /api/status` reports that model ready. The comparison page does not send Qwen3.5-27B or the LoRA id to this gateway.
- No LoRA checkpoint, container digest, or B200 session is on disk.
- The B200 LoRA candidate is `config/nemo/qwen35_27b_b200_lora_candidate.yaml`. GPU runtime validation has not run, and training has not started.
- Label review and license review for the pinned `sijjeel/js-vuln-dataset` revision are still pending. The manifest field `training_admission` is shown as stored.
- Imported JSON and CSV live in memory for the browser tab. A refresh clears them. A review result stays until the next review or Clear results.
- The UI does not open `.nsys-rep` files.

## B200 integration

The current gateway serves the pretrained Jetson 4B model. When a B200 host is rented, keep that runtime behind its own gateway. Point `VITE_API_BASE_URL` at that gateway through an SSH tunnel or an authenticated proxy. Do not describe a Jetson Qwen3.5:4B response as B200, NeMo LoRA, or Qwen3.5-27B inference.

Collect telemetry with:

```bash
bash scripts/gpu_preflight.sh
bash scripts/capture_gpu_telemetry.sh 300 training-run-01
```

Import `artifacts/raw/telemetry/<run-id>/gpu.csv` on the GPU page. Open any `.nsys-rep` in NVIDIA Nsight Systems on the Mac and, if the timeline is worth keeping, save a real screenshot as `screenshots/09-nsight-timeline.png`.

After scoring, import `patchreason.evaluation.v1` or `patchreason.evaluation.cases.v1`. After training, import `patchreason.run.v1` with the recorded loss points. Export buttons write those same schemas back out.

## Screenshots

Do not add images for this implementation pass. `screenshots/README.md` already says illustrative dashboard shots are not measured evidence.

Take later captures under these names, from `docs/OBSERVABILITY.md`:

- `screenshots/01-overview.png` from `/` while the manifest counts are visible
- `screenshots/02-code-review.png` from `/review` after a gateway response
- `screenshots/03-model-comparison.png` from `/compare` after both model responses exist
- `screenshots/04-evaluation.png` from `/evaluation` after a score file is loaded
- `screenshots/05-gpu-telemetry.png` from `/gpu` after a real CSV or measured payload
- `screenshots/06-training-curves.png` from `/runs` after recorded loss exists
- `screenshots/07-nvtop.png` and `screenshots/08-nvidia-smi.png` from the SSH session
- `screenshots/09-nsight-timeline.png` from Nsight Systems
- `screenshots/10-throughput.png` after latency and tokens per second are measured
- `screenshots/11-promptfoo.png` from Promptfoo
- `screenshots/12-artifacts.png` from `/runs` once versions are pinned to that run

`docs/UI_CAPTURE_GUIDE.md` already maps routes to the same timing. Fixture mode is for implementation review. It should not be the image attached to a performance claim.

## Preserved work

Dataset scripts, ingestion docs, NeMo notes, Promptfoo notes, and result manifests were left in place. The root README now points at this file and at `app/`, and its frontend row says the UI is local. `app/README.md` replaced the previous three-line placeholder.
