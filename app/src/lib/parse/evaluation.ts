import type {
  ConfusionMatrix,
  CweCount,
  EvaluationDocument,
  EvaluationScores,
  JsonValidity,
} from "../../types/domain";
import { isRecord, readInt, readString, readStringList } from "./guards";
import { metricsFromConfusion, ratiosMatch, readRatio } from "./metrics";
import { err, ok, type ParseResult } from "./result";

const CWE_PATTERN = /^CWE-\d{1,5}$/;
const EVALUATION_SCHEMA = "patchreason.evaluation.v1";
const CASES_SCHEMA = "patchreason.evaluation.cases.v1";

function readConfusion(record: Record<string, unknown>): ParseResult<ConfusionMatrix> {
  const confusion = isRecord(record.confusion) ? record.confusion : null;
  if (confusion === null) return err("confusion must be an object.");
  const truePositive = readInt(confusion, "truePositive");
  const falsePositive = readInt(confusion, "falsePositive");
  const trueNegative = readInt(confusion, "trueNegative");
  const falseNegative = readInt(confusion, "falseNegative");
  if (truePositive.kind === "error") return truePositive;
  if (falsePositive.kind === "error") return falsePositive;
  if (trueNegative.kind === "error") return trueNegative;
  if (falseNegative.kind === "error") return falseNegative;
  return ok({
    truePositive: truePositive.value,
    falsePositive: falsePositive.value,
    trueNegative: trueNegative.value,
    falseNegative: falseNegative.value,
  });
}

function readPerCwe(record: Record<string, unknown>): ParseResult<readonly CweCount[]> {
  if (!Object.hasOwn(record, "perCwe")) return err("Missing perCwe.");
  const value = record.perCwe;
  if (!Array.isArray(value)) return err("perCwe must be an array.");
  if (value.length > 100) return err("perCwe has too many rows.");
  const rows: CweCount[] = [];
  for (const item of value) {
    if (!isRecord(item)) return err("A perCwe row must be an object.");
    const cwe = readString(item, "cwe");
    const count = readInt(item, "count");
    if (cwe.kind === "error") return cwe;
    if (count.kind === "error") return count;
    if (!CWE_PATTERN.test(cwe.value)) return err("perCwe.cwe must look like CWE-89.");
    if (count.value < 1) return err("perCwe.count must be at least 1.");
    rows.push({ cwe: cwe.value, count: count.value });
  }
  return ok(rows);
}

function readJsonValidity(record: Record<string, unknown>): ParseResult<JsonValidity> {
  if (!Object.hasOwn(record, "jsonValidity")) return ok({ kind: "not-provided" });
  const value = record.jsonValidity;
  if (!isRecord(value)) return err("jsonValidity must be an object.");
  if (value.kind === "not-provided") return ok({ kind: "not-provided" });
  const ratio = readRatio(value, "jsonValidity");
  if (ratio.kind === "error") return ratio;
  return ok(ratio.value);
}

function readIdentity(record: Record<string, unknown>): ParseResult<{ modelId: string; datasetRevision: string; notes: readonly string[] }> {
  const modelId = readString(record, "modelId");
  const datasetRevision = readString(record, "datasetRevision");
  const notes = readStringList(record, "notes", 30);
  if (modelId.kind === "error") return modelId;
  if (datasetRevision.kind === "error") return datasetRevision;
  if (notes.kind === "error") return notes;
  if (modelId.value.length > 200 || datasetRevision.value.length > 120) {
    return err("modelId or datasetRevision is too long.");
  }
  return ok({
    modelId: modelId.value,
    datasetRevision: datasetRevision.value,
    notes: notes.value,
  });
}

function finishScores(input: {
  identity: { modelId: string; datasetRevision: string; notes: readonly string[] };
  confusion: ConfusionMatrix;
  perCwe: readonly CweCount[];
  jsonValidity: JsonValidity;
  provided: {
    precision: RatioInput;
    recall: RatioInput;
    f1: RatioInput;
    falsePositiveRate: RatioInput;
  } | null;
}): ParseResult<EvaluationScores> {
  const computed = metricsFromConfusion(input.confusion);
  if (input.provided !== null) {
    const precision = ratiosMatch("precision", input.provided.precision, computed.precision);
    const recall = ratiosMatch("recall", input.provided.recall, computed.recall);
    const f1 = ratiosMatch("f1", input.provided.f1, computed.f1);
    const falsePositiveRate = ratiosMatch(
      "falsePositiveRate",
      input.provided.falsePositiveRate,
      computed.falsePositiveRate,
    );
    if (precision.kind === "error") return precision;
    if (recall.kind === "error") return recall;
    if (f1.kind === "error") return f1;
    if (falsePositiveRate.kind === "error") return falsePositiveRate;
  }
  return ok({
    modelId: input.identity.modelId,
    datasetRevision: input.identity.datasetRevision,
    precision: computed.precision,
    recall: computed.recall,
    f1: computed.f1,
    falsePositiveRate: computed.falsePositiveRate,
    jsonValidity: input.jsonValidity,
    confusion: input.confusion,
    perCwe: input.perCwe,
    notes: input.identity.notes,
  });
}

type RatioInput = EvaluationScores["precision"];

function parseSummary(record: Record<string, unknown>): ParseResult<EvaluationScores> {
  const identity = readIdentity(record);
  const confusion = readConfusion(record);
  const perCwe = readPerCwe(record);
  const jsonValidity = readJsonValidity(record);
  if (identity.kind === "error") return identity;
  if (confusion.kind === "error") return confusion;
  if (perCwe.kind === "error") return perCwe;
  if (jsonValidity.kind === "error") return jsonValidity;
  const precision = readRatio(record.precision, "precision");
  const recall = readRatio(record.recall, "recall");
  const f1 = readRatio(record.f1, "f1");
  const falsePositiveRate = readRatio(record.falsePositiveRate, "falsePositiveRate");
  if (precision.kind === "error") return precision;
  if (recall.kind === "error") return recall;
  if (f1.kind === "error") return f1;
  if (falsePositiveRate.kind === "error") return falsePositiveRate;
  return finishScores({
    identity: identity.value,
    confusion: confusion.value,
    perCwe: perCwe.value,
    jsonValidity: jsonValidity.value,
    provided: {
      precision: precision.value,
      recall: recall.value,
      f1: f1.value,
      falsePositiveRate: falsePositiveRate.value,
    },
  });
}

interface CaseRow {
  id: string;
  expected: "vulnerable" | "safe";
  predicted: "vulnerable" | "safe";
  cwe: string;
}

function readCase(value: unknown): ParseResult<CaseRow> {
  if (!isRecord(value)) return err("Each case must be an object.");
  const id = readString(value, "id");
  const expected = readString(value, "expected");
  const predicted = readString(value, "predicted");
  const cwe = readString(value, "cwe");
  if (id.kind === "error") return id;
  if (expected.kind === "error") return expected;
  if (predicted.kind === "error") return predicted;
  if (cwe.kind === "error") return cwe;
  if (expected.value !== "vulnerable" && expected.value !== "safe") {
    return err("case.expected must be vulnerable or safe.");
  }
  if (predicted.value !== "vulnerable" && predicted.value !== "safe") {
    return err("case.predicted must be vulnerable or safe.");
  }
  if (cwe.value !== "none" && !CWE_PATTERN.test(cwe.value)) {
    return err("case.cwe must be none or look like CWE-89.");
  }
  return ok({
    id: id.value,
    expected: expected.value,
    predicted: predicted.value,
    cwe: cwe.value,
  });
}

function parseCases(record: Record<string, unknown>): ParseResult<EvaluationScores> {
  const identity = readIdentity(record);
  if (identity.kind === "error") return identity;
  if (!Array.isArray(record.cases)) return err("cases must be an array.");
  if (record.cases.length === 0) return err("cases must include at least one row.");
  if (record.cases.length > 100_000) return err("cases is too large for this screen.");
  const seen = new Set<string>();
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  const cweCounts = new Map<string, number>();
  for (const item of record.cases) {
    const row = readCase(item);
    if (row.kind === "error") return row;
    if (seen.has(row.value.id)) return err(`Duplicate case id ${row.value.id}.`);
    seen.add(row.value.id);
    if (row.value.expected === "vulnerable" && row.value.predicted === "vulnerable") truePositive += 1;
    if (row.value.expected === "safe" && row.value.predicted === "vulnerable") falsePositive += 1;
    if (row.value.expected === "safe" && row.value.predicted === "safe") trueNegative += 1;
    if (row.value.expected === "vulnerable" && row.value.predicted === "safe") falseNegative += 1;
    if (row.value.cwe !== "none") {
      cweCounts.set(row.value.cwe, (cweCounts.get(row.value.cwe) ?? 0) + 1);
    }
  }
  const perCwe = [...cweCounts.entries()]
    .map((entry) => ({ cwe: entry[0], count: entry[1] }))
    .sort((left, right) => right.count - left.count || left.cwe.localeCompare(right.cwe));
  const note = "Metrics were computed in the browser from imported case labels.";
  return finishScores({
    identity: {
      ...identity.value,
      notes: [note, ...identity.value.notes],
    },
    confusion: { truePositive, falsePositive, trueNegative, falseNegative },
    perCwe,
    jsonValidity: { kind: "not-provided" },
    provided: null,
  });
}

function looksLikePromptfoo(record: Record<string, unknown>): boolean {
  if (!isRecord(record.results)) return false;
  const results = record.results;
  return Array.isArray(results.results) || isRecord(results.stats);
}

export function parseEvaluationDocument(value: unknown): EvaluationDocument {
  if (!isRecord(value)) {
    return { kind: "error", message: "The evaluation file must be a JSON object." };
  }
  if (value.kind === "empty") return { kind: "empty" };
  const schema = value.schema;
  if (schema === EVALUATION_SCHEMA) {
    const scores = parseSummary(value);
    if (scores.kind === "error") return scores;
    return { kind: "scored", scores: scores.value };
  }
  if (schema === CASES_SCHEMA) {
    const scores = parseCases(value);
    if (scores.kind === "error") return scores;
    return { kind: "scored", scores: scores.value };
  }
  if (looksLikePromptfoo(value)) {
    return {
      kind: "error",
      message:
        "This file looks like a Promptfoo export. Assertion pass rates are not precision, recall, or F1. Import patchreason.evaluation.v1 or patchreason.evaluation.cases.v1 after scoring.",
    };
  }
  return {
    kind: "error",
    message: "Unrecognized JSON. Expected schema patchreason.evaluation.v1 or patchreason.evaluation.cases.v1.",
  };
}

export function serializeEvaluation(scores: EvaluationScores): string {
  const payload = {
    schema: EVALUATION_SCHEMA,
    modelId: scores.modelId,
    datasetRevision: scores.datasetRevision,
    precision: scores.precision,
    recall: scores.recall,
    f1: scores.f1,
    falsePositiveRate: scores.falsePositiveRate,
    jsonValidity: scores.jsonValidity,
    confusion: scores.confusion,
    perCwe: scores.perCwe,
    notes: scores.notes,
  };
  return JSON.stringify(payload, null, 2);
}
