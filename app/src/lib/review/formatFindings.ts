import type { Finding, Timing } from "../../types/domain";

export function formatLatency(latencyMs: number): string {
  return `${latencyMs.toFixed(1)} ms`;
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
}): string {
  const lines = [input.heading, `Model: ${input.modelId}`, `Timing: ${formatTiming(input.timing)}`];
  if (input.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }
  for (const finding of input.findings) {
    lines.push(
      "",
      `${finding.cwe} | ${finding.severity}`,
      `Evidence: ${finding.evidence}`,
      `Explanation: ${finding.explanation}`,
      `Remediation: ${finding.remediation}`,
    );
  }
  return lines.join("\n");
}
