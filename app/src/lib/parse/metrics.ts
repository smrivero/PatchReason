import type { ConfusionMatrix, Ratio } from "../../types/domain";
import { err, ok, type ParseResult } from "./result";
import { isRecord } from "./guards";

export function ratioFromCounts(numerator: number, denominator: number, emptyReason: string): Ratio {
  if (denominator === 0) return { kind: "undefined", reason: emptyReason };
  return { kind: "value", value: numerator / denominator };
}

export function f1FromRatios(precision: Ratio, recall: Ratio): Ratio {
  if (precision.kind === "undefined") return precision;
  if (recall.kind === "undefined") return recall;
  const sum = precision.value + recall.value;
  if (sum === 0) return { kind: "value", value: 0 };
  return { kind: "value", value: (2 * precision.value * recall.value) / sum };
}

export function metricsFromConfusion(confusion: ConfusionMatrix): {
  precision: Ratio;
  recall: Ratio;
  f1: Ratio;
  falsePositiveRate: Ratio;
} {
  const precision = ratioFromCounts(
    confusion.truePositive,
    confusion.truePositive + confusion.falsePositive,
    "Undefined because no case was predicted vulnerable.",
  );
  const recall = ratioFromCounts(
    confusion.truePositive,
    confusion.truePositive + confusion.falseNegative,
    "Undefined because no case was labeled vulnerable.",
  );
  const falsePositiveRate = ratioFromCounts(
    confusion.falsePositive,
    confusion.falsePositive + confusion.trueNegative,
    "Undefined because no case was labeled safe.",
  );
  return {
    precision,
    recall,
    f1: f1FromRatios(precision, recall),
    falsePositiveRate,
  };
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.000001;
}

export function readRatio(value: unknown, label: string): ParseResult<Ratio> {
  if (!isRecord(value)) return err(`${label} must be an object with kind value or undefined.`);
  const kind = value.kind;
  if (kind === "undefined") {
    const reason = value.reason;
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return err(`${label} is missing a reason.`);
    }
    return ok({ kind: "undefined", reason });
  }
  if (kind === "value") {
    const numeric = value.value;
    if (typeof numeric !== "number" || !Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
      return err(`${label} must be a ratio from 0 to 1.`);
    }
    return ok({ kind: "value", value: numeric });
  }
  return err(`${label} has an unknown kind.`);
}

export function ratiosMatch(label: string, provided: Ratio, computed: Ratio): ParseResult<true> {
  if (provided.kind !== computed.kind) {
    return err(`${label} does not match the confusion matrix.`);
  }
  if (provided.kind === "value" && computed.kind === "value" && !closeEnough(provided.value, computed.value)) {
    return err(`${label} does not match the confusion matrix.`);
  }
  return ok(true);
}
