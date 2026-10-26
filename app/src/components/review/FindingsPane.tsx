import { useState } from "react";
import { copyText, downloadText } from "../../lib/download";
import { FIXTURE_REVIEW_LABEL, type Finding, type ReviewPaneState, type Timing } from "../../types/domain";
import { affectedLineNumbers } from "../../lib/review/affectedLines";
import { findingsToText, formatTiming } from "../../lib/review/formatFindings";
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
      {findings.map((finding) => (
        <article key={`${finding.cwe}-${finding.evidence}`} className="rounded-xl border border-line bg-white p-3">
          <header className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-paper">{finding.cwe}</span>
            <StatusChip tone={severityTone(finding.severity)}>{finding.severity}</StatusChip>
            <LineChip code={code} evidence={finding.evidence} />
          </header>
          <p className="mt-2 text-sm leading-6 text-paper">{finding.explanation}</p>
          <p className="mt-3 text-xs font-medium text-mute">Reference</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-[#F8FAFC] px-3 py-2 font-mono text-xs leading-5 text-paper">
            {finding.evidence}
          </pre>
          <p className="mt-3 text-xs font-medium text-mute">Remediation</p>
          <p className="mt-1 text-sm leading-6">{finding.remediation}</p>
        </article>
      ))}
    </div>
  );
}

function CopyActions({ heading, modelId, findings, timing }: { heading: string; modelId: string; findings: readonly Finding[]; timing: Timing }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const text = findingsToText({ heading, modelId, findings, timing });

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

function LineChip({ code, evidence }: { code: string; evidence: string }) {
  const lines = affectedLineNumbers(code, evidence);
  const first = lines[0];
  if (first === undefined) return null;
  const label = lines.length === 1 ? `Line ${String(first)}` : `Lines ${lines.join(", ")}`;
  return <StatusChip tone="info">{label}</StatusChip>;
}

export function FindingsPane({
  state,
  code,
  idleTitle = "Review service not connected",
  idleBody = "Choose an illustrative sample to see a labeled reference review, or set VITE_API_BASE_URL before Review code can call the gateway. This page does not invent model findings.",
}: {
  state: ReviewPaneState;
  code: string;
  idleTitle?: string;
  idleBody?: string;
}) {
  switch (state.kind) {
    case "idle":
      return <EmptyState testId="review-idle" title={idleTitle} body={idleBody} />;
    case "loading":
      return (
        <div className="panel space-y-3" role="status" aria-label="Waiting for the gateway">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    case "error":
      return <Callout tone="error">{state.message}</Callout>;
    case "fixture":
      return (
        <section className="space-y-3" data-testid="review-fixture" aria-live="polite">
          <div className="panel space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{FIXTURE_REVIEW_LABEL}</h2>
            <StatusChip tone="pending">Not a model prediction</StatusChip>
          </div>
          <p className="text-sm leading-6 text-mute">
              Source {state.review.source}, example {state.review.exampleId}. {state.review.context} This text is the reference
              annotation, not an inference from {state.review.model.displayName}.
            </p>
            <p className="text-sm">Timing: {formatTiming(state.review.timing)}</p>
            <CopyActions
              heading={FIXTURE_REVIEW_LABEL}
              modelId={state.review.model.id}
              findings={state.review.findings}
              timing={state.review.timing}
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
              <h2 className="text-sm font-semibold">Gateway response</h2>
              <StatusChip tone="ok">Model output</StatusChip>
            </div>
            <p className="text-sm">
              {state.review.displayName} ({state.review.role})
            </p>
            <p className="break-all text-xs text-mute">{state.review.modelId}</p>
            <p className="text-sm text-mute">{state.review.revision}</p>
            <p className="text-sm">Timing: {formatTiming(state.review.timing)}</p>
            <CopyActions
              heading="Gateway response"
              modelId={state.review.modelId}
              findings={state.review.findings}
              timing={state.review.timing}
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
