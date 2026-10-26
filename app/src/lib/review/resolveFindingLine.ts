import type { Finding } from "../../types/domain";

export interface ResolvedFindingLine {
  reported: number | null;
  highlight: number | null;
}

const PROMPT_PREAMBLE_LINES = 2;

const TRIVIAL_LINE = /^(?:[{}[\]();,]+|\/{2}.*|\/\*+|\*+\/?)$/;

const SQL_INJECTION_LINE = /(?:\b(?:query|execute|raw)\s*\(|\b(?:SELECT|INSERT|UPDATE|DELETE|UNION)\b)/i;
const SQL_INTERPOLATION = /\$\{|\+\s*[A-Za-z_$]/;

function isTrivial(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || TRIVIAL_LINE.test(trimmed) || trimmed.startsWith("```");
}

function quotedFragments(text: string): string[] {
  const fragments: string[] = [];
  const pattern = /`([^`\n]{6,180})`|"([^"\n]{6,180})"|'([^'\n]{6,180})'/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value !== undefined && value.trim().length >= 6) fragments.push(value.trim());
  }
  return fragments;
}

function lineSupports(line: string, corpus: string, fragments: readonly string[], cwe: string): boolean {
  if (isTrivial(line)) return false;
  const trimmed = line.trim();
  if (trimmed.length >= 12 && corpus.includes(trimmed)) return true;
  for (const fragment of fragments) {
    if (line.includes(fragment)) return true;
  }
  if (cwe === "CWE-89" && SQL_INJECTION_LINE.test(line) && SQL_INTERPOLATION.test(line)) return true;
  if (cwe === "CWE-915" && line.includes("req.body")) return true;
  if (cwe === "CWE-79" && /innerHTML|dangerouslySetInnerHTML|document\.write/.test(line)) return true;
  if (cwe === "CWE-639" && line.includes("req.params")) return true;
  if (cwe === "CWE-78" && /\b(?:exec|spawn)\s*\(/.test(line)) return true;
  return false;
}

function closest(lines: readonly number[], target: number): number {
  const first = lines[0];
  if (first === undefined) return target;
  return lines.reduce((best, line) => (Math.abs(line - target) < Math.abs(best - target) ? line : best), first);
}

export function resolveFindingLine(code: string, finding: Finding): ResolvedFindingLine {
  const lines = code.split("\n");
  const count = lines.length;
  const reported = finding.line !== undefined && Number.isInteger(finding.line) && finding.line >= 1 ? finding.line : null;
  const corpus = [finding.title ?? "", finding.evidence, finding.explanation, finding.remediation].join("\n");
  const fragments = quotedFragments(corpus);
  const supported: number[] = [];
  lines.forEach((line, index) => {
    if (lineSupports(line, corpus, fragments, finding.cwe)) supported.push(index + 1);
  });
  const inRange = reported !== null && reported <= count;
  if (inRange && supported.includes(reported)) return { reported, highlight: reported };
  if (supported.length === 1) {
    const only = supported[0] ?? null;
    return { reported, highlight: only };
  }
  const shifted = reported === null ? null : reported - PROMPT_PREAMBLE_LINES;
  if (shifted !== null && supported.includes(shifted)) return { reported, highlight: shifted };
  if (supported.length > 1 && reported !== null) {
    return { reported, highlight: closest(supported, reported) };
  }
  if (inRange) {
    const sourceLine = lines[reported - 1];
    if (sourceLine !== undefined && !isTrivial(sourceLine)) return { reported, highlight: reported };
  }
  return { reported, highlight: null };
}

export function findingLineLabel(resolved: ResolvedFindingLine): string | null {
  if (resolved.reported !== null && resolved.highlight !== null && resolved.reported !== resolved.highlight) {
    return `Model reported line ${String(resolved.reported)}. Source line ${String(resolved.highlight)}.`;
  }
  if (resolved.highlight !== null) return `Line ${String(resolved.highlight)}`;
  if (resolved.reported !== null) return `Model reported line ${String(resolved.reported)}.`;
  return null;
}
