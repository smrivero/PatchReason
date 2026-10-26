import type {
  DigestState,
  LoraState,
  ParsedRun,
  PlannedRun,
  RecordedRun,
  ScalarPoint,
  ScalarSeries,
  ValidationLoss,
} from "../../types/domain";
import { isRecord, readString, readStringList } from "./guards";
import { err, ok, type ParseResult } from "./result";

const RUN_SCHEMA = "patchreason.run.v1";
const MODULE_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

function readDigest(value: unknown): ParseResult<DigestState> {
  if (!isRecord(value)) return err("containerDigest must be an object.");
  if (value.kind === "not-recorded") return ok({ kind: "not-recorded" });
  if (value.kind === "recorded" && typeof value.value === "string" && /^sha256:[0-9a-f]{64}$/.test(value.value)) {
    return ok({ kind: "recorded", value: value.value });
  }
  return err("containerDigest must be not-recorded or a sha256 digest.");
}

function readLora(value: unknown): ParseResult<LoraState> {
  if (!isRecord(value)) return err("lora must be an object.");
  if (value.kind === "not-derived") {
    if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
      return err("lora.reason is missing.");
    }
    return ok({ kind: "not-derived", reason: value.reason });
  }
  if (value.kind !== "recorded") return err("lora.kind is unknown.");
  const rank = readPositiveInt(value.rank, "lora.rank");
  const alpha = readPositiveInt(value.alpha, "lora.alpha");
  if (rank.kind === "error") return rank;
  if (alpha.kind === "error") return alpha;
  if (typeof value.dropout !== "number" || !Number.isFinite(value.dropout) || value.dropout < 0 || value.dropout > 1) {
    return err("lora.dropout must be between 0 and 1.");
  }
  if (!Array.isArray(value.targetModules) || value.targetModules.length === 0 || value.targetModules.length > 32) {
    return err("lora.targetModules must list 1 to 32 names.");
  }
  const targetModules: string[] = [];
  for (const moduleName of value.targetModules) {
    if (typeof moduleName !== "string" || !MODULE_PATTERN.test(moduleName)) {
      return err("A LoRA target module name is invalid.");
    }
    targetModules.push(moduleName);
  }
  return ok({
    kind: "recorded",
    rank: rank.value,
    alpha: alpha.value,
    dropout: value.dropout,
    targetModules,
  });
}

function readPositiveInt(value: unknown, label: string): ParseResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 4096) {
    return err(`${label} must be an integer from 1 to 4096.`);
  }
  return ok(value);
}

function readLoss(value: unknown, label: string): ParseResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
    return err(`${label} must be a finite loss from 0 upward.`);
  }
  return ok(value);
}

function readValidationLoss(value: unknown): ParseResult<ValidationLoss> {
  if (!isRecord(value)) return err("validationLoss must be an object.");
  if (value.kind === "not-recorded") return ok({ kind: "not-recorded" });
  if (value.kind !== "recorded") return err("validationLoss.kind is unknown.");
  const parsed = readLoss(value.value, "validationLoss");
  if (parsed.kind === "error") return parsed;
  return ok({ kind: "recorded", value: parsed.value });
}

function readScalars(value: unknown, lifecycle: RecordedRun["lifecycle"]): ParseResult<ScalarSeries> {
  if (!isRecord(value)) return err("scalars must be an object.");
  if (value.kind === "unavailable") {
    if (lifecycle === "completed") return err("A completed run needs recorded loss points.");
    if (typeof value.reason !== "string" || value.reason.trim().length === 0) {
      return err("scalars.reason is missing.");
    }
    return ok({ kind: "unavailable", reason: value.reason });
  }
  if (value.kind !== "recorded") return err("scalars.kind is unknown.");
  if (!Array.isArray(value.points) || value.points.length === 0 || value.points.length > 5000) {
    return err("scalars.points must contain 1 to 5000 points.");
  }
  const points: ScalarPoint[] = [];
  let previousStep = -1;
  for (const item of value.points) {
    if (!isRecord(item)) return err("A scalar point must be an object.");
    if (typeof item.step !== "number" || !Number.isInteger(item.step) || item.step < 0) {
      return err("scalar step must be a non-negative integer.");
    }
    if (item.step <= previousStep) return err("scalar steps must increase.");
    previousStep = item.step;
    const trainLoss = readLoss(item.trainLoss, "trainLoss");
    const validationLoss = readValidationLoss(item.validationLoss);
    if (trainLoss.kind === "error") return trainLoss;
    if (validationLoss.kind === "error") return validationLoss;
    points.push({
      step: item.step,
      trainLoss: trainLoss.value,
      validationLoss: validationLoss.value,
    });
  }
  const first = points[0];
  if (first === undefined) return err("scalars.points is empty.");
  return ok({ kind: "recorded", points: [first, ...points.slice(1)] });
}

function readCommon(record: Record<string, unknown>): ParseResult<{
  id: string;
  modelId: string;
  datasetRevision: string;
  containerTag: string;
  notes: readonly string[];
}> {
  const id = readString(record, "id");
  const modelId = readString(record, "modelId");
  const datasetRevision = readString(record, "datasetRevision");
  const containerTag = readString(record, "containerTag");
  const notes = readStringList(record, "notes", 30);
  if (id.kind === "error") return id;
  if (modelId.kind === "error") return modelId;
  if (datasetRevision.kind === "error") return datasetRevision;
  if (containerTag.kind === "error") return containerTag;
  if (notes.kind === "error") return notes;
  if (id.value.length > 80 || modelId.value.length > 200 || datasetRevision.value.length > 120 || containerTag.value.length > 200) {
    return err("A run identity field is too long.");
  }
  return ok({
    id: id.value,
    modelId: modelId.value,
    datasetRevision: datasetRevision.value,
    containerTag: containerTag.value,
    notes: notes.value,
  });
}

export function parseRunDocument(value: unknown): ParseResult<ParsedRun> | { kind: "empty" } {
  if (!isRecord(value)) return err("The run file must be a JSON object.");
  if (value.kind === "empty") return { kind: "empty" };
  if (value.schema !== RUN_SCHEMA) return err("Expected schema patchreason.run.v1.");
  const common = readCommon(value);
  const digest = readDigest(value.containerDigest);
  const lora = readLora(value.lora);
  if (common.kind === "error") return common;
  if (digest.kind === "error") return digest;
  if (lora.kind === "error") return lora;
  const lifecycle = value.lifecycle;
  if (lifecycle === "not-started") {
    if (value.scalars !== undefined && isRecord(value.scalars) && value.scalars.kind !== "unavailable") {
      return err("A not-started run cannot include recorded scalars.");
    }
    if (lora.value.kind !== "not-derived") return err("A not-started run cannot include a recorded LoRA config.");
    if (digest.value.kind !== "not-recorded") return err("A not-started run cannot include a container digest.");
    const run: PlannedRun = {
      kind: "planned",
      id: common.value.id,
      modelId: common.value.modelId,
      datasetRevision: common.value.datasetRevision,
      containerTag: common.value.containerTag,
      containerDigest: { kind: "not-recorded" },
      lora: lora.value,
      lifecycle: "not-started",
      scalars: {
        kind: "unavailable",
        reason: "No train or validation loss has been recorded.",
      },
      notes: common.value.notes,
    };
    return ok({ kind: "planned", run });
  }
  if (lifecycle !== "running" && lifecycle !== "completed" && lifecycle !== "failed") {
    return err("lifecycle must be not-started, running, completed, or failed.");
  }
  const scalars = readScalars(value.scalars, lifecycle);
  if (scalars.kind === "error") return scalars;
  const run: RecordedRun = {
    kind: "recorded",
    id: common.value.id,
    modelId: common.value.modelId,
    datasetRevision: common.value.datasetRevision,
    containerTag: common.value.containerTag,
    containerDigest: digest.value,
    lora: lora.value,
    lifecycle,
    scalars: scalars.value,
    notes: common.value.notes,
  };
  return ok({ kind: "recorded", run });
}

export function serializeRun(run: PlannedRun | RecordedRun): string {
  return JSON.stringify(
    {
      schema: RUN_SCHEMA,
      id: run.id,
      modelId: run.modelId,
      datasetRevision: run.datasetRevision,
      containerTag: run.containerTag,
      containerDigest: run.containerDigest,
      lora: run.lora,
      lifecycle: run.lifecycle,
      scalars: run.scalars,
      notes: run.notes,
    },
    null,
    2,
  );
}
