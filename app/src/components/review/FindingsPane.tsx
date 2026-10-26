import { useState } from "react";
import { copyText, downloadText } from "../../lib/download";
import { FIXTURE_REVIEW_LABEL, type Finding, type ReviewPaneState, type Timing } from "../../types/domain";
import { findingsToText, formatTiming } from "../../lib/review/formatFindings";
import { findingLineLabel, resolveFindingLine } from "../../lib/review/resolveFindingLine";
import { Callout } from "../status/Callout";
import { EmptyState } from "../status/EmptyState";
import { Skeleton } from "../status/Skeleton";
import { StatusChip } from "../status/StatusChip";

function severityTone(severity: string): "pending" | "ok" | "info" | "neutral" {
  const value = severity.toLowerCase();
  if (value === "high" || value === "critical") return "pending";
  if (value === "low" || value === "info") return "ok";
  if (value === "medium") return "info";
  return "neutral";
}

function FindingList({ findings, code }: { findings: readonly Finding[]; code: string }) {
  if (findings.length === 0) {
    return <p className="text-sm text-mute">No findings in this response.</p>;
  }
  return (
    <div className="space-y-3">
      {findings.map((finding, index) => (
        <article key={`${finding.cwe}-${String(finding.line ?? index)}-${finding.evidence}`} className="rounded-xl border border-line bg-white p-3">
          <header className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-paper">{finding.cwe}</span>
            <StatusChip tone={severityTone(finding.severity)}>{finding.severity}</StatusChip>
            <LineChip code={code} finding={finding} />
          </header>
          {finding.title === undefined ? null : <p className="mt-2 text-sm font-medium text-paper">{finding.title}</p>}
          <p className="mt-2 text-sm leading-6 text-paper">{finding.explanation}</p>
          {finding.title !== undefined && finding.evidence === finding.title ? null : (
            <>
              <p className="mt-3 text-xs font-medium text-mute">Reference</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-[#F8FAFC] px-3 py-2 font-mono text-xs leading-5 text-paper">
                {finding.evidence}
              </pre>
            </>
          )}
          <p className="mt-3 text-xs font-medium text-mute">Remediation</p>
          <p className="mt-1 text-sm leading-6">{finding.remediation}</p>
        </article>
      ))}
    </div>
  );
}

function CopyActions({
  heading,
  modelId,
  findings,
  timing,
  code,
}: {
  heading: string;
  modelId: string;
  findings: readonly Finding[];
  timing: Timing;
  code: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const text = findingsToText({ heading, modelId, findings, timing, code });

  async function copyFindings(): Promise<void> {
    const copied = await copyText(text);
    setCopyState(copied ? "copied" : "failed");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn" onClick={() => void copyFindings()}>
        Copy findings
      </button>
      <button type="button" className="btn" onClick={() => downloadText("patchreason-findings.txt", text, "text/plain")}>
        Export text
      </button>
      <span className="text-xs text-mute" role="status">
        {copyState === "copied" ? "Copied." : copyState === "failed" ? "Copy failed." : ""}
      </span>
    </div>
  );
}

function LineChip({ code, finding }: { code: string; finding: Finding }) {
  const label = findingLineLabel(resolveFindingLine(code, finding));
  if (label === null) return null;
  return <StatusChip tone="info">{label}</StatusChip>;
}

export function FindingsPane({
  state,
  code,
  idleTitle = "Review service not connected",
  idleBody = "Choose sample code to inspect a reference annotation, or set VITE_API_BASE_URL before Review code can call the gateway. This page does not invent model findings.",
  progress = null,
  onRetry,
}: {
  state: ReviewPaneState;
  code: string;
  idleTitle?: string;
  idleBody?: string;
  progress?: { elapsedSeconds: number; onCancel: () => void } | null;
  onRetry?: () => void;
}) {
  switch (state.kind) {
    case "idle":
      return <EmptyState testId="review-idle" title={idleTitle} body={idleBody} />;
    case "loading":
      if (progress === null) {
        return (
          <div className="panel space-y-3" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Waiting for the gateway</h2>
            </div>
          </div>
        );
      }
      return (
        <div className="panel space-y-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Analyzing code with Qwen3.5:4B on Jetson</h2>
          </div>
          <p className="text-sm text-paper">Model jetson-qwen35-4b. Elapsed {String(progress.elapsedSeconds)} s.</p>
          <p className="text-sm text-mute">The editor stays available. A second review waits until this one finishes or you cancel it.</p>
          <button type="button" className="btn" onClick={progress.onCancel}>
            Cancel review
          </button>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    case "error":
      return (
        <div className="space-y-3">
          <Callout tone="error">{state.message}</Callout>
          {onRetry === undefined ? null : (
            <button type="button" className="btn" onClick={onRetry}>
              Retry review
            </button>
          )}
        </div>
      );
    case "fixture":
      return (
        <section className="space-y-3" data-testid="review-fixture" aria-live="polite">
          <div className="panel space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{FIXTURE_REVIEW_LABEL}</h2>
            <StatusChip tone="pending">Sample code, not model output</StatusChip>
          </div>
          <p className="text-sm leading-6 text-mute">
              Source {state.review.source}, example {state.review.exampleId}. {state.review.context} This is a reference annotation
              for the sample. It is not a finding from Jetson Qwen3.5:4B.
            </p>
            <p className="text-sm">Timing: {formatTiming(state.review.timing)}</p>
            <CopyActions
              heading={FIXTURE_REVIEW_LABEL}
              modelId={state.review.model.id}
              findings={state.review.findings}
              timing={state.review.timing}
              code={code}
            />
          </div>
          <FindingList findings={state.review.findings} code={code} />
        </section>
      );
    case "model":
      return (
        <section className="space-y-3" data-testid="review-model" aria-live="polite">
          <div className="panel space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{state.review.headline}</h2>
              <StatusChip tone="ok">Model output</StatusChip>
            </div>
            <p className="text-sm">{state.review.displayName}</p>
            <p className="break-all text-xs text-mute">{state.review.modelId}</p>
            <p className="text-sm text-mute">Upstream model {state.review.revision}</p>
            {state.review.summary.length > 0 ? <p className="text-sm leading-6">{state.review.summary}</p> : null}
            {state.review.vulnerable === null ? null : (
              <p className="text-sm">{state.review.vulnerable ? "The model marked this snippet vulnerable." : "The model did not mark this snippet vulnerable."}</p>
            )}
            <p className="text-sm">Latency: {formatTiming(state.review.timing)}</p>
            {state.review.usage === null ? null : (
              <p className="text-sm text-mute">
                Prompt tokens {String(state.review.usage.promptTokens)}. Completion tokens {String(state.review.usage.completionTokens)}.
              </p>
            )}
            {state.review.limitations.length === 0 ? null : (
              <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-mute">
                {state.review.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <CopyActions
              heading={state.review.headline}
              modelId={state.review.modelId}
              findings={state.review.findings}
              timing={state.review.timing}
              code={code}
            />
          </div>
          <FindingList findings={state.review.findings} code={code} />
        </section>
      );
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
