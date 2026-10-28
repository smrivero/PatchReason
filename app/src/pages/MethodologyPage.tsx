import { datasetFacts } from "../lib/parse/facts";
import { readableStatus } from "../lib/format";
import { apiPaths } from "../lib/api/paths";
import { usePageTitle } from "../hooks/usePageTitle";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";

const documents = [
  ["Project brief", "docs/PROJECT_BRIEF.md"],
  ["Architecture", "docs/ARCHITECTURE.md"],
  ["Decisions", "docs/DECISIONS.md"],
  ["Binary dataset pipeline", "docs/BINARY_DATASET_PIPELINE.md"],
  ["Evaluation protocol", "docs/EVALUATION_PLAN.md"],
  ["Observability", "docs/OBSERVABILITY.md"],
  ["Evidence capture matrix", "docs/GPU_SCREENSHOT_MATRIX.md"],
  ["Data quality findings", "docs/DATA_QUALITY_FINDINGS.md"],
  ["CWE scope review", "docs/CWE_SCOPE_REVIEW.md"],
  ["Deployment notes", "docs/DEPLOYMENT.md"],
] as const;

export function MethodologyPage() {
  usePageTitle("Methodology");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Engineering methodology"
        lede="This page restates the repository notes that already constrain data, evaluation, and GPU evidence. The linked Markdown files stay the source of those decisions."
      />
      <section className="panel space-y-3 text-sm leading-6">
        <h2 className="text-base font-semibold">Project status</h2>
        <p>
          PatchReason provides private JavaScript and TypeScript security screening through a React interface, a FastAPI gateway,
          and model inference. The initial release returns binary vulnerable or safe classifications.
        </p>
        <p>
          Source-label review and pretraining overlap remain limitations. The root README documents the completed B200 LoRA run
          and held-out evaluation. The binary dataset has no CWE, severity, or fix labels.
        </p>
      </section>
      <section className="panel space-y-3 text-sm leading-6">
        <h2 className="text-base font-semibold">Data provenance</h2>
        <p>
          The binary corpus comes from sijjeel/js-vuln-dataset, described upstream as a cleaned derivative of CVEfixes. PatchReason
          pinned a Hugging Face revision, kept each record in its original train, validation, or test split, and selected evaluation
          before validation before training. Code-bearing JSONL stays under datasets/private and is gitignored.
        </p>
        {datasetFacts.kind === "error" ? (
          <Callout tone="error">{datasetFacts.message}</Callout>
        ) : (
          <>
            <p>
              Selected rows: train {datasetFacts.facts.binary.selectedCounts.train}, validation{" "}
              {datasetFacts.facts.binary.selectedCounts.validation}, held-out test {datasetFacts.facts.binary.selectedCounts.test}.
              Admission: {readableStatus(datasetFacts.facts.binary.trainingAdmission)}.
            </p>
            <p>
              The {datasetFacts.facts.sequenceBudget.maxSequenceTokens}-token budget keeps{" "}
              {datasetFacts.facts.sequenceBudget.train.retained} of {datasetFacts.facts.sequenceBudget.train.original} training records
              and {datasetFacts.facts.sequenceBudget.validation.retained} of {datasetFacts.facts.sequenceBudget.validation.original}{" "}
              validation records. The held-out split was not inspected by that filter.
            </p>
            <p>
              {datasetFacts.facts.loraCandidate.configPath} is prepared and passed the offline structural checks in
              scripts/validate_b200_candidate.py. This manifest records preparation-stage checks; completed training evidence is documented in the root README.
            </p>
            <p className="break-all font-mono text-xs">{datasetFacts.facts.binary.sourceRevision}</p>
            <p>{datasetFacts.facts.binary.sampling}</p>
          </>
        )}
        <p>
          A separate queue from rgaucher/security-vuln-patches remains under human review. Unsupported CWE assignments, including the
          CWE-611 rejection in docs/DATA_QUALITY_FINDINGS.md, stay out of training. The binary set has no CWE, severity, or fix label,
          so it cannot by itself train the full review response.
        </p>
      </section>
      <section className="panel space-y-3 text-sm">
        <h2 className="text-base font-semibold">Deduplication limits</h2>
        {datasetFacts.kind === "ready" ? (
          <ul className="list-disc space-y-2 pl-5 text-mute">
            {datasetFacts.facts.binary.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>The limitation list is unavailable until the manifest parses.</p>
        )}
      </section>
      <section className="panel space-y-3 text-sm">
        <h2 className="text-base font-semibold">Model comparison</h2>
        <p>
          docs/EVALUATION_PLAN.md compares three conditions on the same frozen items: a simple prompt, a structured prompt, and LoRA on
          the same foundation model. The UI can place two responses side by side. Until both responses and a score file exist, the
          comparison page has nothing to say about quality.
        </p>
        <p>
          Qwen3.5-27B is the selected base. The single-B200 configuration is maintained in config/nemo,
          alongside compatibility and full-epoch configurations.
        </p>
      </section>
      <section className="panel space-y-3 text-sm">
        <h2 className="text-base font-semibold">Evaluation design</h2>
        <p>
          Finding-level precision, recall, F1, benign false-positive rate, JSON validity, and a separate CWE check are defined in
          docs/EVALUATION_PLAN.md. This screen computes the four binary ratios from a confusion matrix. Per-CWE bars appear only when
          the imported file carries them. Promptfoo can call an OpenAI-compatible gateway later. Its assertion pass rate is a different
          number, so the parser refuses to relabel it as F1.
        </p>
        <p>
          The held-out file must stay out of prompt edits, checkpoint picks, and threshold picks. A balanced test split does not estimate
          how often vulnerable changes appear in review.
        </p>
      </section>
      <section className="panel space-y-3 text-sm">
        <h2 className="text-base font-semibold">GPU instrumentation</h2>
        <p>
          On the rented host, docs/OBSERVABILITY.md uses nvidia-smi, nvtop, and Nsight Systems. The capture command is bash
          scripts/capture_gpu_telemetry.sh 300 training-run-01. Raw CSV and .nsys-rep files stay under artifacts/raw, which is gitignored.
          The GPU page charts a CSV or a payload marked collection measured. It does not draw .nsys-rep.
        </p>
        <p>The root README links B200 execution and profiling captures. This page does not infer throughput from screenshots.</p>
      </section>
      <section className="panel space-y-3 text-sm">
        <h2 className="text-base font-semibold">Gateway contracts</h2>
        <p>The browser calls only these paths, and only when VITE_API_BASE_URL is an http or https URL without credentials.</p>
        <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
          <li>GET {apiPaths.status}</li>
          <li>GET {apiPaths.models}</li>
          <li>POST {apiPaths.reviews}</li>
          <li>GET {apiPaths.evaluationSummary}</li>
          <li>GET {apiPaths.gpuTelemetry}?run_id=...</li>
          <li>GET {apiPaths.runs}</li>
        </ul>
        <p>The FastAPI gateway connects to the inference backend. Keep backend credentials and network configuration on the server.</p>
      </section>
      <section className="panel">
        <h2 className="text-base font-semibold">Repository documents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {documents.map((item) => (
            <li key={item[1]}>
              {item[0]} <span className="font-mono text-xs text-mute">{item[1]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
