import { artifactChecklist } from "../lib/runs/artifacts";
import { buildPlannedRun } from "../lib/runs/plannedRun";
import { datasetFacts } from "../lib/parse/facts";
import { parseJsonText } from "../lib/parse/guards";
import { parseRunDocument, serializeRun } from "../lib/parse/runRecord";
import { downloadText } from "../lib/download";
import type { ParsedRun, PlannedRun, RecordedRun, ScalarPoint } from "../types/domain";
import { usePageTitle } from "../hooks/usePageTitle";
import { useRemoteRuns } from "../hooks/useRemoteRuns";
import { useWorkspace } from "../hooks/useWorkspace";
import { LossLines } from "../components/charts/SimpleCharts";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { EmptyState } from "../components/status/EmptyState";

type ShownRun =
  | { sourceLabel: string; run: PlannedRun | RecordedRun }
  | { sourceLabel: string; missingFacts: string };

export function RunsPage() {
  usePageTitle("Training runs");
  const remote = useRemoteRuns();
  const { runImport, setRunImport } = useWorkspace();
  const shown = selectRun(runImport.kind === "record" ? runImport : null, remote);

  async function onFile(file: File): Promise<void> {
    const parsedJson = parseJsonText(await file.text());
    if (parsedJson.kind === "error") {
      setRunImport({ kind: "error", message: parsedJson.message });
      return;
    }
    const document = parseRunDocument(parsedJson.value);
    if (document.kind === "error") {
      setRunImport({ kind: "error", message: document.message });
      return;
    }
    if (document.kind === "empty") {
      setRunImport({ kind: "none" });
      return;
    }
    setRunImport({ kind: "record", fileName: file.name, run: document.value });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Training runs"
        lede="History lists a row only after a verified recorded run is imported or returned by the gateway. The reference plan stays in the details below."
      />
      <section className="panel flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-mute">Import run JSON</span>
          <input
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
        {"run" in shown ? (
          <button
            type="button"
            className="btn"
            onClick={() => downloadText("patchreason-run.json", serializeRun(shown.run), "application/json")}
          >
            Export JSON
          </button>
        ) : null}
        {runImport.kind === "record" ? (
          <button type="button" className="btn" onClick={() => setRunImport({ kind: "none" })}>
            Clear import
          </button>
        ) : null}
      </section>
      {runImport.kind === "error" ? <Callout tone="error">{runImport.message}</Callout> : null}
      {remote.kind === "error" && runImport.kind !== "record" ? <Callout tone="error">{remote.message}</Callout> : null}
      {remote.kind === "loading" ? <p className="text-sm">Checking the gateway for runs.</p> : null}
      {"missingFacts" in shown ? <Callout tone="error">{shown.missingFacts}</Callout> : <RunHistory shown={shown} />}
      <ArtifactTable />
    </div>
  );
}

function selectRun(
  imported: { fileName: string; run: ParsedRun } | null,
  remote: ReturnType<typeof useRemoteRuns>,
): ShownRun {
  if (imported !== null) {
    const label =
      imported.run.kind === "planned"
        ? `Imported plan ${imported.fileName}. This file does not mean a run happened.`
        : `Imported JSON ${imported.fileName}. This screen does not verify that a B200 session produced it.`;
    return { sourceLabel: label, run: imported.run.run };
  }
  if (remote.kind === "recorded") {
    return {
      sourceLabel: "GET /api/runs. This screen shows the gateway payload and does not add measurements of its own.",
      run: remote.run,
    };
  }
  if (datasetFacts.kind === "error") {
    return { sourceLabel: "plan", missingFacts: datasetFacts.message };
  }
  return {
    sourceLabel: "Local plan. No training process has been started.",
    run: buildPlannedRun(datasetFacts.facts.binary.sourceRevision),
  };
}

function RunHistory({ shown }: { shown: { sourceLabel: string; run: PlannedRun | RecordedRun } }) {
  const recorded = shown.run.kind === "recorded" ? shown.run : null;
  return (
    <section className="space-y-4">
      <article className="panel">
        <h2 className="text-sm font-semibold">Run history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-mute">
                <th className="px-2 py-2 font-medium">Run ID</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">Sequence length</th>
                <th className="px-2 py-2 font-medium">Timestamp</th>
                <th className="px-2 py-2 font-medium">Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {recorded === null ? (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-sm text-mute">
                    No verified training runs yet.
                  </td>
                </tr>
              ) : (
                <tr className="border-t border-line align-top">
                  <td className="px-2 py-3 font-mono text-xs">{recorded.id}</td>
                  <td className="px-2 py-3">{lifecycleLabel(recorded.lifecycle)}</td>
                  <td className="break-all px-2 py-3 font-mono text-xs">{recorded.modelId}</td>
                  <td className="px-2 py-3 text-mute">Not recorded</td>
                  <td className="px-2 py-3 text-mute">Not recorded</td>
                  <td className="px-2 py-3">
                    <a className="text-accentText" href="#artifact-checklist">
                      Checklist
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      {shown.run.kind === "planned" ? (
        <details className="panel">
          <summary className="cursor-pointer text-sm font-medium">Reference plan</summary>
          <PlanBody sourceLabel={shown.sourceLabel} run={shown.run} />
        </details>
      ) : (
        <RecordedBody sourceLabel={shown.sourceLabel} run={shown.run} />
      )}
    </section>
  );
}

function PlanBody({ sourceLabel, run }: { sourceLabel: string; run: PlannedRun }) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p>{sourceLabel}</p>
      <p>Lifecycle: {lifecycleLabel(run.lifecycle)}</p>
      <p className="break-all">Model: {run.modelId}</p>
      <p className="break-all">Dataset revision: {run.datasetRevision}</p>
      <p className="break-all">Container tag: {run.containerTag}</p>
      <p>Container digest: not recorded.</p>
      <p>LoRA configuration: {run.lora.reason}</p>
      {run.notes.map((note) => (
        <p key={note} className="text-mute">
          {note}
        </p>
      ))}
      <EmptyState testId="loss-empty" title="Pending collection" body={run.scalars.reason} />
    </div>
  );
}

function RecordedBody({ sourceLabel, run }: { sourceLabel: string; run: RecordedRun }) {
  return (
    <section className="space-y-4">
      <article className="panel space-y-2 text-sm">
        <h2 className="text-sm font-semibold">Recorded run {run.id}</h2>
        <p>{sourceLabel}</p>
        <p className="break-all">Dataset revision: {run.datasetRevision}</p>
        <p className="break-all">Container tag: {run.containerTag}</p>
        <p>{run.containerDigest.kind === "not-recorded" ? "Container digest: not recorded." : `Container digest: ${run.containerDigest.value}`}</p>
        {run.lora.kind === "not-derived" ? (
          <p>LoRA configuration: {run.lora.reason}</p>
        ) : (
          <p>
            LoRA rank {run.lora.rank}, alpha {run.lora.alpha}, dropout {run.lora.dropout}, targets {run.lora.targetModules.join(", ")}.
          </p>
        )}
        <p className="text-mute">Sequence length: Not recorded. Timestamp: Not recorded.</p>
        {run.notes.map((note) => (
          <p key={note} className="text-mute">
            {note}
          </p>
        ))}
      </article>
      {run.scalars.kind === "unavailable" ? (
        <EmptyState testId="loss-empty" title="Pending collection" body={run.scalars.reason} />
      ) : (
        <LossCard points={run.scalars.points} />
      )}
    </section>
  );
}

function lifecycleLabel(lifecycle: PlannedRun["lifecycle"] | RecordedRun["lifecycle"]): string {
  switch (lifecycle) {
    case "not-started":
      return "Not started";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default: {
      const exhaustive: never = lifecycle;
      return exhaustive;
    }
  }
}

function LossCard({ points }: { points: readonly [ScalarPoint, ...ScalarPoint[]] }) {
  const showValidation = points.every((point) => point.validationLoss.kind === "recorded");
  const rows = points.map((point) => ({
    step: String(point.step),
    trainLoss: point.trainLoss,
    validationLoss: point.validationLoss.kind === "recorded" ? point.validationLoss.value : null,
  }));
  return (
    <article className="panel">
      <h2 className="mb-2 text-base font-semibold">Recorded loss</h2>
      {showValidation ? null : (
        <p className="mb-2 text-sm text-mute">Validation loss is missing on at least one step, so only train loss is drawn.</p>
      )}
      <LossLines rows={rows} showValidation={showValidation} />
    </article>
  );
}

function ArtifactTable() {
  return (
    <section className="panel" id="artifact-checklist">
      <h2 className="text-base font-semibold">Artifact checklist</h2>
      <p className="mt-2 text-sm text-mute">
        Paths follow docs/OBSERVABILITY.md and docs/GPU_SCREENSHOT_MATRIX.md. A screenshot becomes evidence only after the underlying
        measurement exists.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-mute">
              <th className="px-2 py-2 font-medium">Item</th>
              <th className="px-2 py-2 font-medium">Path</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {artifactChecklist.map((artifact) => (
              <tr key={artifact.id} className="border-t border-line align-top">
                <th className="px-2 py-2 font-medium">{artifact.title}</th>
                <td className="break-all px-2 py-2 font-mono text-xs">{artifact.path}</td>
                <td className="px-2 py-2">
                  {artifact.presence.kind === "in-repo" ? "In the repository" : "Not captured"}
                  <span className="mt-1 block text-mute">{artifact.presence.note}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
