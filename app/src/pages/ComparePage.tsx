import { useState } from "react";
import { CodeEditor } from "../components/review/CodeEditor";
import { ExampleSelect } from "../components/review/ExampleSelect";
import { FindingsPane } from "../components/review/FindingsPane";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { EmptyState } from "../components/status/EmptyState";
import { StatusChip } from "../components/status/StatusChip";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkspace } from "../hooks/useWorkspace";
import { postReview, readApiBase } from "../lib/api/client";
import { adaptedModelId, baselineModelId, catalogModelById, jetsonModelId } from "../lib/models/catalog";
import { diffFindings } from "../lib/review/diffFindings";
import { formatLatency, formatTiming } from "../lib/review/formatFindings";
import { buildReviewRequest } from "../lib/review/validateRequest";
import type { ReviewPaneState, Timing } from "../types/domain";

function latencyLine(baseline: Timing, adapted: Timing): string {
  if (baseline.kind !== "measured" || adapted.kind !== "measured") return "Pending collection";
  const delta = adapted.latencyMs - baseline.latencyMs;
  return `Baseline ${formatLatency(baseline.latencyMs)}. Adapted ${formatLatency(adapted.latencyMs)}. Adapted minus baseline ${formatLatency(delta)}.`;
}

export function ComparePage() {
  usePageTitle("Comparison");
  const { draft, setDraft, gateway } = useWorkspace();
  const [left, setLeft] = useState<ReviewPaneState>({ kind: "idle" });
  const [right, setRight] = useState<ReviewPaneState>({ kind: "idle" });
  const [formError, setFormError] = useState("");
  const base = readApiBase();
  const jetsonGateway = gateway.kind === "online" && gateway.status.liveModelId === jetsonModelId;
  const canCompare =
    base.kind === "ready" &&
    gateway.kind === "online" &&
    !jetsonGateway &&
    gateway.status.inference === "ready";

  function replaceCode(code: string): void {
    setDraft({ ...draft, code });
    setLeft({ kind: "idle" });
    setRight({ kind: "idle" });
    setFormError("");
  }

  async function requestBoth(): Promise<void> {
    const baselineRequest = buildReviewRequest({ draft, modelId: baselineModelId });
    const adaptedRequest = buildReviewRequest({ draft, modelId: adaptedModelId });
    if (baselineRequest.kind === "error") {
      setFormError(baselineRequest.message);
      return;
    }
    if (adaptedRequest.kind === "error") {
      setFormError(adaptedRequest.message);
      return;
    }
    if (jetsonGateway) {
      setFormError("This gateway serves Jetson Qwen3.5:4B. Qwen3.5-27B and the B200 LoRA adapter are reserved for a later gateway.");
      return;
    }
    if (!canCompare || base.kind !== "ready") {
      setFormError("Both requests stay disabled until a gateway reports the 27B models ready.");
      return;
    }
    setFormError("");
    setLeft({ kind: "loading" });
    setRight({ kind: "loading" });
    const [baselineResult, adaptedResult] = await Promise.all([
      postReview(base.baseUrl, baselineRequest.value),
      postReview(base.baseUrl, adaptedRequest.value),
    ]);
    setLeft(baselineResult.kind === "error" ? { kind: "error", message: baselineResult.message } : { kind: "model", review: baselineResult.value });
    setRight(adaptedResult.kind === "error" ? { kind: "error", message: adaptedResult.message } : { kind: "model", review: adaptedResult.value });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Model comparison"
        lede="The same input is prepared for Qwen3.5-27B and the B200 LoRA adapter. Live review of Jetson Qwen3.5:4B stays on the Code review page."
        actions={
          <StatusChip tone={canCompare ? "ok" : "pending"}>
            {jetsonGateway ? "Jetson 4B gateway" : canCompare ? "Gateway ready" : "Service not connected"}
          </StatusChip>
        }
      />
      <section className="space-y-3">
        <ExampleSelect
          onSelect={(example) => {
            setDraft({ language: example.language, filename: example.filename, code: example.code });
            setLeft({ kind: "idle" });
            setRight({ kind: "idle" });
          }}
        />
        <CodeEditor code={draft.code} readOnly={false} onChange={replaceCode} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={!canCompare || left.kind === "loading"} onClick={() => void requestBoth()}>
            Request both models
          </button>
        </div>
        {jetsonGateway ? (
          <p className="text-sm leading-6 text-mute">
            Request both models stays disabled. This gateway serves pretrained Jetson Qwen3.5:4B. Live review of that model is on the
            Code review page. These columns stay reserved for Qwen3.5-27B and the B200 LoRA adapter.
          </p>
        ) : canCompare ? null : (
          <p className="text-sm text-mute">Request both models stays disabled until a gateway reports those models ready.</p>
        )}
        {formError.length > 0 ? <Callout tone="error">{formError}</Callout> : null}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <CompareColumn title="Base Qwen3.5-27B" modelId={catalogModelById(baselineModelId).id} state={left} code={draft.code} />
        <CompareColumn title="Fine-tuned LoRA" note="Not trained" modelId={catalogModelById(adaptedModelId).id} state={right} code={draft.code} />
      </section>
      <DifferencePanel left={left} right={right} jetsonGateway={jetsonGateway} />
    </div>
  );
}

function DifferencePanel({
  left,
  right,
  jetsonGateway,
}: {
  left: ReviewPaneState;
  right: ReviewPaneState;
  jetsonGateway: boolean;
}) {
  if (left.kind === "fixture" && right.kind === "fixture") {
    return (
      <section className="panel space-y-2">
        <h2 className="text-base font-semibold">Column differences</h2>
        <p className="text-sm">
          Both columns repeat the reference annotation for {left.review.exampleId}. No quality difference is claimed.
        </p>
        <p className="text-sm">Timing: {formatTiming(left.review.timing)}</p>
      </section>
    );
  }
  if (left.kind === "model" && right.kind === "model") {
    const diff = diffFindings(left.review.findings, right.review.findings);
    return (
      <section className="panel space-y-3">
        <h2 className="text-base font-semibold">Column differences</h2>
        <p className="text-sm">Timing: {latencyLine(left.review.timing, right.review.timing)}</p>
        <p className="text-sm">
          Shared findings: {diff.shared.length}. Only baseline: {diff.onlyBaseline.length}. Only adapted: {diff.onlyAdapted.length}.
        </p>
        <FindingNames title="Only baseline" findings={diff.onlyBaseline.map((finding) => finding.cwe)} />
        <FindingNames title="Only adapted" findings={diff.onlyAdapted.map((finding) => finding.cwe)} />
      </section>
    );
  }
  return (
    <EmptyState
      testId="compare-empty"
      title="Awaiting evaluation"
      body={
        jetsonGateway
          ? "These columns stay empty on the Jetson gateway. Live review of Qwen3.5:4B is on the Code review page."
          : "Request both models after a gateway reports Qwen3.5-27B and the LoRA adapter ready. No quality improvement is recorded."
      }
    />
  );
}

function CompareColumn({
  title,
  modelId,
  state,
  code,
  note,
}: {
  title: string;
  modelId: string;
  state: ReviewPaneState;
  code: string;
  note?: string;
}) {
  return (
    <article className="space-y-3">
      <header className="panel py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note === undefined ? null : <StatusChip tone="pending">{note}</StatusChip>}
        </div>
        <p className="mt-1 break-all font-mono text-xs text-mute">{modelId}</p>
      </header>
      <FindingsPane
        state={state}
        code={code}
        idleTitle="Awaiting evaluation"
        idleBody="This column stays empty until a gateway returns a review for Qwen3.5-27B or the B200 LoRA adapter."
      />
    </article>
  );
}

function FindingNames({ title, findings }: { title: string; findings: readonly string[] }) {
  if (findings.length === 0) return <p className="text-sm text-mute">{title}: none.</p>;
  return (
    <p className="text-sm">
      {title}: {findings.join(", ")}
    </p>
  );
}
