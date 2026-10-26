import type { Finding, Timing } from "../../types/domain";
import { findingLineLabel, resolveFindingLine } from "./resolveFindingLine";

export function formatLatency(latencyMs: number): string {
  return `${(latencyMs / 1000).toFixed(1)} s`;
}

export function formatTiming(timing: Timing): string {
  if (timing.kind === "not-measured") return "Pending collection";
  return formatLatency(timing.latencyMs);
}

export function findingsToText(input: {
  heading: string;
  modelId: string;
  findings: readonly Finding[];
  timing: Timing;
  code?: string;
}): string {
  const lines = [input.heading, `Model: ${input.modelId}`, `Timing: ${formatTiming(input.timing)}`];
  if (input.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }
  for (const finding of input.findings) {
    const lineLabel = input.code === undefined ? null : findingLineLabel(resolveFindingLine(input.code, finding));
    lines.push(
      "",
      `${finding.cwe} | ${finding.severity}${lineLabel === null ? "" : ` | ${lineLabel}`}`,
      `Evidence: ${finding.evidence}`,
      `Explanation: ${finding.explanation}`,
      `Remediation: ${finding.remediation}`,
    );
  }
  return lines.join("\n");
}
