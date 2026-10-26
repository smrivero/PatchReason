import { datasetFacts } from "../lib/parse/facts";
import { downloadText } from "../lib/download";
import { formatRatio, formatRatioState } from "../lib/format";
import { parseEvaluationDocument, serializeEvaluation } from "../lib/parse/evaluation";
import { parseJsonText } from "../lib/parse/guards";
import type { EvaluationScores, JsonValidity, Ratio } from "../types/domain";
import { usePageTitle } from "../hooks/usePageTitle";
import { useRemoteEvaluation } from "../hooks/useRemoteEvaluation";
import { useWorkspace } from "../hooks/useWorkspace";
import { MetricBars } from "../components/charts/SimpleCharts";
import { ConfusionTable } from "../components/evaluation/ConfusionTable";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { EmptyState } from "../components/status/EmptyState";
import { Skeleton } from "../components/status/Skeleton";
import { StatusChip } from "../components/status/StatusChip";

function metricRows(scores: EvaluationScores): { label: string; value: number }[] {
  const pairs: readonly { label: string; ratio: Ratio }[] = [
    { label: "Precision", ratio: scores.precision },
    { label: "Recall", ratio: scores.recall },
    { label: "F1", ratio: scores.f1 },
    { label: "False-positive rate", ratio: scores.falsePositiveRate },
  ];
  return pairs.flatMap((pair) => (pair.ratio.kind === "value" ? [{ label: pair.label, value: pair.ratio.value * 100 }] : []));
}

function validityText(validity: JsonValidity): string {
  if (validity.kind === "not-provided") return "Not included in this result.";
  if (validity.kind === "undefined") return validity.reason;
  return formatRatio(validity.value);
}

export function EvaluationPage() {
  usePageTitle("Evaluation");
  const remote = useRemoteEvaluation();
  const { evaluationImport, setEvaluationImport } = useWorkspace();
  const scores = evaluationImport.kind === "scored" ? evaluationImport.scores : remote.kind === "scored" ? remote.scores : null;
  const sourceLabel =
    evaluationImport.kind === "scored"
      ? `Imported file ${evaluationImport.fileName}`
      : remote.kind === "scored"
        ? "GET /api/evaluations/summary"
        : "";

  async function onFile(file: File): Promise<void> {
    const parsedJson = parseJsonText(await file.text());
    if (parsedJson.kind === "error") {
      setEvaluationImport({ kind: "error", message: parsedJson.message });
      return;
    }
    const document = parseEvaluationDocument(parsedJson.value);
    if (document.kind === "error") {
      setEvaluationImport({ kind: "error", message: document.message });
      return;
    }
    if (document.kind === "empty") {
      setEvaluationImport({ kind: "none" });
      return;
    }
    setEvaluationImport({ kind: "scored", fileName: file.name, scores: document.scores });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluation"
        lede="Scores appear after you import patchreason.evaluation.v1, import case labels, or the gateway returns a summary. Promptfoo assertion pass rates are not converted into F1."
      />
      <section className="panel flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-mute">Import evaluation JSON</span>
          <input
            className="text-sm"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const files = event.target.files;
              const file = files === null ? null : files.item(0);
              if (file === null) return;
              void onFile(file);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={scores === null}
          onClick={() => {
            if (scores === null) return;
            downloadText("patchreason-evaluation.json", serializeEvaluation(scores), "application/json");
          }}
        >
          Export JSON
        </button>
        {evaluationImport.kind === "scored" ? (
          <button type="button" className="btn" onClick={() => setEvaluationImport({ kind: "none" })}>
            Clear import
          </button>
        ) : null}
      </section>
      {evaluationImport.kind === "error" ? <Callout tone="error">{evaluationImport.message}</Callout> : null}
      {remote.kind === "error" && evaluationImport.kind !== "scored" ? <Callout tone="error">{remote.message}</Callout> : null}
      {remote.kind === "invalid" ? <Callout tone="error">{remote.message}</Callout> : null}
      {remote.kind === "loading" && scores === null ? (
        <div className="panel space-y-3" role="status" aria-label="Checking the gateway for a summary">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      <Provenance />
      {scores === null ? <PendingScores /> : <ScorePanel scores={scores} sourceLabel={sourceLabel} />}
    </div>
  );
}

function ScorePanel({ scores, sourceLabel }: { scores: EvaluationScores; sourceLabel: string }) {
  const rows = metricRows(scores);
  const manifestRevision = datasetFacts.kind === "ready" ? datasetFacts.facts.binary.sourceRevision : "";
  return (
    <section className="space-y-4" data-testid="evaluation-scores">
      <div className="panel space-y-2">
        <h2 className="text-base font-semibold">Loaded result</h2>
        <p className="text-sm">{sourceLabel}</p>
        <p className="break-all text-sm">Model {scores.modelId}</p>
        <p className="break-all text-sm">Dataset revision {scores.datasetRevision}</p>
        {manifestRevision.length > 0 && manifestRevision !== scores.datasetRevision ? (
          <p className="text-sm text-warn">
            This result names a different dataset revision than results/data_intake/js_binary_manifest.json.
          </p>
        ) : null}
        <p className="text-sm text-mute">
          The screen recomputes precision, recall, F1, and false-positive rate from the confusion matrix and rejects a file when
          the stated ratios disagree.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Precision" value={formatRatioState(scores.precision)} />
        <MetricCard label="Recall" value={formatRatioState(scores.recall)} />
        <MetricCard label="F1" value={formatRatioState(scores.f1)} />
        <MetricCard label="False-positive rate" value={formatRatioState(scores.falsePositiveRate)} />
      </div>
      <article className="panel">
        <h2 className="text-base font-semibold">JSON validity</h2>
        <p className="mt-2 text-sm">{validityText(scores.jsonValidity)}</p>
      </article>
      {rows.length > 0 ? (
        <article className="panel">
          <h2 className="mb-2 text-base font-semibold">Ratios on a 0 to 100 scale</h2>
          <MetricBars rows={rows} scale="percent" />
        </article>
      ) : null}
      <article className="panel">
        <ConfusionTable confusion={scores.confusion} />
      </article>
      <article className="panel">
        <h2 className="text-base font-semibold">Cases by CWE</h2>
        {scores.perCwe.length === 0 ? (
          <p className="mt-2 text-sm text-mute">
            This result has no per-CWE counts. The binary dataset does not include CWE labels.
          </p>
        ) : (
          <div className="mt-3">
            <MetricBars rows={scores.perCwe.map((row) => ({ label: row.cwe, value: row.count }))} scale="count" />
            <p className="mt-2 text-xs text-mute">
              Counts are taken from the imported file. They are not a second confusion matrix. The chart axis follows the largest
              count in this file.
            </p>
          </div>
        )}
      </article>
      {scores.notes.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 text-sm text-mute">
          {scores.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PendingScores() {
  const labels = ["Precision", "Recall", "F1", "False-positive rate"] as const;
  return (
    <div className="space-y-4">
      <EmptyState
        testId="evaluation-empty"
        title="No scored evaluation results available"
        body="Pending collection. A balanced held-out split is recorded in the manifest, and no model has been scored against it."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {labels.map((label) => (
          <article key={label} className="panel">
            <h2 className="text-sm text-mute">{label}</h2>
            <div className="mt-3">
              <StatusChip tone="pending">Pending collection</StatusChip>
            </div>
          </article>
        ))}
      </div>
      <article className="panel">
        <h2 className="text-sm font-semibold">Confusion matrix</h2>
        <p className="mt-2 text-sm text-mute">Pending collection. Cells appear after a scored result is imported or returned by the gateway.</p>
      </article>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="panel">
      <h2 className="text-sm text-mute">{label}</h2>
      <p className="mt-2 text-sm tabular-nums">{value}</p>
    </article>
  );
}

function Provenance() {
  if (datasetFacts.kind === "error") return <Callout tone="error">{datasetFacts.message}</Callout>;
  const binary = datasetFacts.facts.binary;
  return (
    <section className="panel space-y-2">
      <h2 className="text-base font-semibold">Dataset provenance</h2>
      <p className="text-sm">
        Held-out selection uses {binary.selectedCounts.test} rows from the upstream test split, with {binary.labels.test.vulnerable}{" "}
        vulnerable labels and {binary.labels.test.safe} safe labels. The balance is a sampling choice, not an estimate of production
        prevalence.
      </p>
      <p className="break-all font-mono text-xs">{binary.sourceRevision}</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-mute">
        {binary.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
