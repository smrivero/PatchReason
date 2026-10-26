import type { Ratio } from "../types/domain";

const countFormat = new Intl.NumberFormat("en-US");

export function readableStatus(value: string): string {
  switch (value) {
    case "pending_label_spot_review_and_license_review":
      return "Label and license review pending";
    case "candidate_manual_review":
      return "Manual candidate review";
    case "external_source_intake_only":
      return "External source intake only";
    default:
      return value.replaceAll("_", " ");
  }
}

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}% (${value.toFixed(3)})`;
}

export function formatRatioState(ratio: Ratio): string {
  if (ratio.kind === "undefined") return ratio.reason;
  return formatRatio(ratio.value);
}
