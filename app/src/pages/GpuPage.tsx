import { useState } from "react";
import { SeriesLine } from "../components/charts/SimpleCharts";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { EmptyState } from "../components/status/EmptyState";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkspace } from "../hooks/useWorkspace";
import { loadGpu, readApiBase } from "../lib/api/client";
import { downloadText } from "../lib/download";
import { illustrativeGpuSeries } from "../lib/fixtures/gpuSeries";
import { parseGpuCsv, serializeGpuCsv } from "../lib/parse/gpuCsv";
import type { GpuSample, GpuSeries, RemoteGpuState } from "../types/domain";

type WindowChoice = "all" | "first-half" | "second-half";

function sliceSamples(series: GpuSeries, choice: WindowChoice): readonly GpuSample[] {
  if (choice === "all" || series.origin.kind === "fixture") return series.samples;
  const midpoint = Math.ceil(series.samples.length / 2);
  const sliced = choice === "first-half" ? series.samples.slice(0, midpoint) : series.samples.slice(midpoint);
  return sliced.length === 0 ? series.samples : sliced;
}

function parseRunId(value: string): { kind: "ok"; value: string } | { kind: "error"; message: string } {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(value)) {
    return { kind: "error", message: "Run id must use letters, digits, dot, underscore, or dash." };
  }
  return { kind: "ok", value };
}

export function GpuPage() {
  usePageTitle("GPU telemetry");
  const { gpuImport, setGpuImport, gpuFixtureEnabled, setGpuFixtureEnabled } = useWorkspace();
  const [runId, setRunId] = useState("");
  const [requestState, setRequestState] = useState<RemoteGpuState>({ kind: "idle" });
  const [windowChoice, setWindowChoice] = useState<WindowChoice>("all");
  const base = readApiBase();
  const visible: GpuSeries | null =
    gpuImport.kind === "series" ? gpuImport.series : gpuFixtureEnabled ? illustrativeGpuSeries() : null;

  async function onCsv(file: File): Promise<void> {
    const parsed = parseGpuCsv(await file.text(), file.name);
    if (parsed.kind === "error") {
      setGpuImport({ kind: "error", message: parsed.message });
      return;
    }
    setGpuFixtureEnabled(false);
    setGpuImport({ kind: "series", series: parsed.value });
  }

  async function loadFromGateway(): Promise<void> {
    const parsedId = parseRunId(runId);
    if (parsedId.kind === "error") {
      setRequestState({ kind: "error", message: parsedId.message });
      return;
    }
    if (base.kind !== "ready") {
      setRequestState({ kind: "error", message: "Set VITE_API_BASE_URL before loading gateway telemetry." });
      return;
    }
    setRequestState({ kind: "loading" });
    const result = await loadGpu(base.baseUrl, parsedId.value);
    if (result.kind === "error") {
      setRequestState({ kind: "error", message: result.message });
      return;
    }
    if (result.kind === "empty") {
      setRequestState({ kind: "empty" });
      return;
    }
    setGpuFixtureEnabled(false);
    setGpuImport({ kind: "series", series: result.value });
    setRequestState({ kind: "idle" });
  }

  const samples = visible === null ? [] : sliceSamples(visible, windowChoice);
  const first = samples[0];
  const last = samples[samples.length - 1];

  return (
    <div className="space-y-5">
      <PageHeader
        title="GPU telemetry"
        lede="Charts read an nvidia-smi CSV from scripts/capture_gpu_telemetry.sh or a measured gateway payload. The illustrative switch is off by default."
      />
      <section className="panel space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={gpuFixtureEnabled}
            disabled={gpuImport.kind === "series"}
            onChange={(event) => setGpuFixtureEnabled(event.target.checked)}
          />
          <span>
            Show illustrative GPU fixture. Off by default. The series is synthetic and was not collected with nvidia-smi.
            {gpuImport.kind === "series" ? " Clear the import before using the fixture." : ""}
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-mute">Import gpu.csv</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const files = event.target.files;
              const file = files === null ? null : files.item(0);
              if (file === null) return;
              void onCsv(file);
              event.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-mute">
          Expected columns from the capture script: timestamp, name, utilization.gpu, utilization.memory, memory.used,
          memory.total, temperature.gpu, power.draw. An imported file is shown with its name. This screen does not prove that
          nvidia-smi produced it.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-mute">Run id</span>
            <input className="field" value={runId} onChange={(event) => setRunId(event.target.value)} aria-label="Run id" />
          </label>
          <button type="button" className="btn" disabled={base.kind !== "ready" || requestState.kind === "loading"} onClick={() => void loadFromGateway()}>
            Load gateway telemetry
          </button>
          {visible !== null && visible.origin.kind !== "fixture" ? (
            <button type="button" className="btn" onClick={() => downloadText("gpu.csv", serializeGpuCsv(visible), "text/csv")}>
              Export CSV
            </button>
          ) : null}
          {gpuImport.kind === "series" ? (
            <button type="button" className="btn" onClick={() => setGpuImport({ kind: "none" })}>
              Clear import
            </button>
          ) : null}
        </div>
        {base.kind === "ready" ? null : <p className="text-sm text-mute">Gateway telemetry stays disabled until the API URL is set.</p>}
      </section>
      {gpuImport.kind === "error" ? <Callout tone="error">{gpuImport.message}</Callout> : null}
      {requestState.kind === "error" ? <Callout tone="error">{requestState.message}</Callout> : null}
      {requestState.kind === "empty" ? (
        <Callout tone="info">The gateway has no telemetry for that run id.</Callout>
      ) : null}
      {visible === null || first === undefined || last === undefined ? (
        <section className="space-y-4">
          <EmptyState
            testId="gpu-empty"
            title="No GPU telemetry"
            body="Pending collection. Run bash scripts/gpu_preflight.sh and bash scripts/capture_gpu_telemetry.sh 300 training-run-01 on the host, then import artifacts/raw/telemetry/<run-id>/gpu.csv."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <PendingChart title="Utilization" />
            <PendingChart title="Memory" />
            <PendingChart title="Power" />
            <PendingChart title="Temperature" />
            <PendingChart title="Throughput" />
          </div>
        </section>
      ) : (
        <section className="space-y-4" data-testid={visible.origin.kind === "fixture" ? "gpu-fixture" : "gpu-series"}>
          {visible.origin.kind === "fixture" ? (
            <Callout tone="warning">
              Illustrative fixture / no GPU collection. These samples were written in the UI for layout checks. They are not a B200
              profile.
            </Callout>
          ) : null}
          <article className="panel grid gap-2 text-sm md:grid-cols-2">
            <p>Source: {visible.sourceLabel}</p>
            <p>GPU: {visible.gpuModel}</p>
            <p>Window start: {first.timestampText}</p>
            <p>Window end: {last.timestampText}</p>
            <p>Samples in view: {samples.length}</p>
            <p>Skipped rows: {visible.skippedRowCount}</p>
          </article>
          {visible.origin.kind === "fixture" ? null : (
            <label className="block max-w-xs text-sm">
              <span className="mb-1 block text-mute">Collection window</span>
              <select
                className="field"
                value={windowChoice}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "first-half" || value === "second-half" || value === "all") setWindowChoice(value);
                }}
              >
                <option value="all">All samples</option>
                <option value="first-half">First half</option>
                <option value="second-half">Second half</option>
              </select>
            </label>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Utilization" rows={samples.map((sample) => ({ label: sample.timestampText, value: sample.utilizationPercent }))} color="#4F46E5" valueLabel="percent" />
            <ChartCard title="Memory" rows={samples.map((sample) => ({ label: sample.timestampText, value: sample.vramUsedMiB }))} color="#2563EB" valueLabel="MiB" />
            <ChartCard title="Power" rows={samples.map((sample) => ({ label: sample.timestampText, value: sample.powerWatts }))} color="#D97706" valueLabel="watts" />
            <ChartCard title="Temperature" rows={samples.map((sample) => ({ label: sample.timestampText, value: sample.temperatureC }))} color="#0D9488" valueLabel="celsius" />
            <PendingChart title="Throughput" note="The capture has no throughput field." />
          </div>
          <article className="panel space-y-2 text-sm">
            <h2 className="text-base font-semibold">Nsight Systems</h2>
            <p>
              No .nsys-rep is stored for this project. React does not render that format. After a trace exists, open it in NVIDIA
              Nsight Systems on macOS. The planned screenshot path is screenshots/09-nsight-timeline.png. Collection notes are in
              docs/OBSERVABILITY.md.
            </p>
            <p>
              <a className="text-accentText" href="https://developer.nvidia.com/nsight-systems/get-started" rel="noreferrer" target="_blank">
                NVIDIA Nsight Systems download
              </a>
            </p>
          </article>
        </section>
      )}
    </div>
  );
}

function PendingChart({ title, note }: { title: string; note?: string }) {
  return (
    <article className="panel min-h-28">
      <h2 className="text-sm font-semibold">{title}</h2>
      {note === undefined ? null : <p className="mt-6 text-sm text-mute">{note}</p>}
    </article>
  );
}

function ChartCard({
  title,
  rows,
  color,
  valueLabel,
}: {
  title: string;
  rows: readonly { label: string; value: number }[];
  color: string;
  valueLabel: string;
}) {
  return (
    <article className="panel">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <SeriesLine rows={rows} color={color} valueLabel={valueLabel} />
    </article>
  );
}
