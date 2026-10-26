import type { Finding } from "../../types/domain";

export interface FindingDiff {
  onlyBaseline: readonly Finding[];
  onlyAdapted: readonly Finding[];
  shared: readonly Finding[];
}

function findingKey(finding: Finding): string {
  return [finding.cwe, finding.severity, finding.evidence, finding.explanation, finding.remediation].join("\n");
}

export function diffFindings(baseline: readonly Finding[], adapted: readonly Finding[]): FindingDiff {
  const adaptedKeys = new Set(adapted.map(findingKey));
  const baselineKeys = new Set(baseline.map(findingKey));
  return {
    onlyBaseline: baseline.filter((finding) => !adaptedKeys.has(findingKey(finding))),
    onlyAdapted: adapted.filter((finding) => !baselineKeys.has(findingKey(finding))),
    shared: baseline.filter((finding) => adaptedKeys.has(findingKey(finding))),
  };
}
