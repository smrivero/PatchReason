import type {
  BinaryDatasetFacts,
  BudgetSplitFacts,
  CandidateQueueFacts,
  ClassCounts,
  DatasetBundle,
  FactLoad,
  IntakeAuditFacts,
  LoraCandidateFacts,
  NemoReadinessFacts,
  NemoSplitFacts,
  SequenceBudgetFacts,
  SplitCounts,
} from "../../types/domain";
import { isRecord, readInt, readRecord, readString, readStringList, sumNestedCounts } from "./guards";
import { parseSimpleYaml, type YamlValue } from "./simpleYaml";
import { err, ok, type ParseResult } from "./result";

const REVISION_PATTERN = /^[0-9a-f]{40}$/;

function readSplitCounts(record: Record<string, unknown>, key: string): ParseResult<SplitCounts> {
  const parsed = readRecord(record, key);
  if (parsed.kind === "error") return parsed;
  const train = readInt(parsed.value, "train");
  const validation = readInt(parsed.value, "validation");
  const test = readInt(parsed.value, "test");
  if (train.kind === "error") return train;
  if (validation.kind === "error") return validation;
  if (test.kind === "error") return test;
  return ok({
    train: train.value,
    validation: validation.value,
    test: test.value,
  });
}

function readClassCounts(record: Record<string, unknown>): ParseResult<ClassCounts> {
  const vulnerable = readInt(record, "vulnerable");
  const safe = readInt(record, "safe");
  if (vulnerable.kind === "error") return vulnerable;
  if (safe.kind === "error") return safe;
  return ok({ vulnerable: vulnerable.value, safe: safe.value });
}

function readLabels(record: Record<string, unknown>): ParseResult<BinaryDatasetFacts["labels"]> {
  const labels = readRecord(record, "labels");
  if (labels.kind === "error") return labels;
  const trainRecord = readRecord(labels.value, "train");
  const validationRecord = readRecord(labels.value, "validation");
  const testRecord = readRecord(labels.value, "test");
  if (trainRecord.kind === "error") return trainRecord;
  if (validationRecord.kind === "error") return validationRecord;
  if (testRecord.kind === "error") return testRecord;
  const train = readClassCounts(trainRecord.value);
  const validation = readClassCounts(validationRecord.value);
  const test = readClassCounts(testRecord.value);
  if (train.kind === "error") return train;
  if (validation.kind === "error") return validation;
  if (test.kind === "error") return test;
  return ok({
    train: train.value,
    validation: validation.value,
    test: test.value,
  });
}

function labelsMatchSelection(selected: SplitCounts, labels: BinaryDatasetFacts["labels"]): ParseResult<true> {
  if (labels.train.vulnerable + labels.train.safe !== selected.train) {
    return err("Train label counts do not match the selected train count.");
  }
  if (labels.validation.vulnerable + labels.validation.safe !== selected.validation) {
    return err("Validation label counts do not match the selected validation count.");
  }
  if (labels.test.vulnerable + labels.test.safe !== selected.test) {
    return err("Held-out label counts do not match the selected test count.");
  }
  return ok(true);
}

function parseBinaryManifest(value: unknown): ParseResult<BinaryDatasetFacts> {
  if (!isRecord(value)) return err("The binary manifest is not an object.");
  const project = readString(value, "project");
  if (project.kind === "error") return project;
  if (project.value !== "PatchReason") return err("The binary manifest project name is unexpected.");
  const sourceUrl = readString(value, "source");
  const sourceRevision = readString(value, "source_revision");
  const createdAtUtc = readString(value, "created_at_utc");
  const sampling = readString(value, "sampling");
  const trainingAdmission = readString(value, "training_admission");
  if (sourceUrl.kind === "error") return sourceUrl;
  if (sourceRevision.kind === "error") return sourceRevision;
  if (createdAtUtc.kind === "error") return createdAtUtc;
  if (sampling.kind === "error") return sampling;
  if (trainingAdmission.kind === "error") return trainingAdmission;
  if (!REVISION_PATTERN.test(sourceRevision.value)) {
    return err("source_revision is not a 40-character hex commit.");
  }
  const sourceCounts = readSplitCounts(value, "source_counts");
  const afterStructuralFilters = readSplitCounts(value, "after_structural_filters");
  const selectedCounts = readSplitCounts(value, "selected_counts");
  if (sourceCounts.kind === "error") return sourceCounts;
  if (afterStructuralFilters.kind === "error") return afterStructuralFilters;
  if (selectedCounts.kind === "error") return selectedCounts;
  const labels = readLabels(value);
  if (labels.kind === "error") return labels;
  const matched = labelsMatchSelection(selectedCounts.value, labels.value);
  if (matched.kind === "error") return matched;
  const excluded = readRecord(value, "excluded");
  const skipped = readRecord(value, "duplicate_candidates_skipped");
  if (excluded.kind === "error") return excluded;
  if (skipped.kind === "error") return skipped;
  const excludedRowCount = sumNestedCounts(excluded.value, 0);
  const duplicateSkipCount = sumNestedCounts(skipped.value, 0);
  if (excludedRowCount.kind === "error") return excludedRowCount;
  if (duplicateSkipCount.kind === "error") return duplicateSkipCount;
  const duplicatesAcross = readInt(value, "duplicates_across_selected_partitions");
  const limitations = readStringList(value, "limitations", 40);
  if (duplicatesAcross.kind === "error") return duplicatesAcross;
  if (limitations.kind === "error") return limitations;
  return ok({
    sourceUrl: sourceUrl.value,
    sourceRevision: sourceRevision.value,
    createdAtUtc: createdAtUtc.value,
    sourceCounts: sourceCounts.value,
    afterStructuralFilters: afterStructuralFilters.value,
    selectedCounts: selectedCounts.value,
    labels: labels.value,
    excludedRowCount: excludedRowCount.value,
    duplicateSkipCount: duplicateSkipCount.value,
    duplicatesAcrossSelectedPartitions: duplicatesAcross.value,
    sampling: sampling.value,
    trainingAdmission: trainingAdmission.value,
    limitations: limitations.value,
    manifestPath: "results/data_intake/js_binary_manifest.json",
  });
}

function parseCandidateSummary(value: unknown): ParseResult<CandidateQueueFacts> {
  if (!isRecord(value)) return err("The candidate summary is not an object.");
  const stage = readString(value, "stage");
  const generatedAtUtc = readString(value, "generated_at_utc");
  const sourceQueue = readString(value, "source_queue");
  const limitations = readString(value, "limitations");
  const sourceCandidates = readInt(value, "source_candidates");
  const pendingHumanReview = readInt(value, "pending_human_review");
  const trainingApprovedRows = readInt(value, "training_approved_rows");
  const distinctCweCategories = readInt(value, "distinct_cwe_categories");
  const uniqueRepositories = readInt(value, "unique_repositories");
  if (stage.kind === "error") return stage;
  if (generatedAtUtc.kind === "error") return generatedAtUtc;
  if (sourceQueue.kind === "error") return sourceQueue;
  if (limitations.kind === "error") return limitations;
  if (sourceCandidates.kind === "error") return sourceCandidates;
  if (pendingHumanReview.kind === "error") return pendingHumanReview;
  if (trainingApprovedRows.kind === "error") return trainingApprovedRows;
  if (distinctCweCategories.kind === "error") return distinctCweCategories;
  if (uniqueRepositories.kind === "error") return uniqueRepositories;
  return ok({
    stage: stage.value,
    generatedAtUtc: generatedAtUtc.value,
    sourceQueue: sourceQueue.value,
    sourceCandidates: sourceCandidates.value,
    pendingHumanReview: pendingHumanReview.value,
    trainingApprovedRows: trainingApprovedRows.value,
    distinctCweCategories: distinctCweCategories.value,
    uniqueRepositories: uniqueRepositories.value,
    limitations: limitations.value,
    summaryPath: "results/data_intake/candidate_review_summary.json",
  });
}

function parseAudit(value: unknown): ParseResult<IntakeAuditFacts> {
  if (!isRecord(value)) return err("The intake audit is not an object.");
  const stage = readString(value, "stage");
  const limits = readString(value, "limits");
  const rows = readInt(value, "rows");
  const trainingApprovedRows = readInt(value, "training_approved_rows");
  const uniqueRepositories = readInt(value, "unique_repositories");
  if (stage.kind === "error") return stage;
  if (limits.kind === "error") return limits;
  if (rows.kind === "error") return rows;
  if (trainingApprovedRows.kind === "error") return trainingApprovedRows;
  if (uniqueRepositories.kind === "error") return uniqueRepositories;
  return ok({
    stage: stage.value,
    rows: rows.value,
    trainingApprovedRows: trainingApprovedRows.value,
    uniqueRepositories: uniqueRepositories.value,
    limits: limits.value,
    auditPath: "results/data_intake/audit.json",
  });
}

function readBool(record: Record<string, unknown>, key: string): ParseResult<boolean> {
  if (!Object.hasOwn(record, key)) return err(`Missing ${key}.`);
  const value = record[key];
  if (typeof value !== "boolean") return err(`${key} must be a boolean.`);
  return ok(value);
}

function parseBudgetSplit(record: Record<string, unknown>, key: string): ParseResult<BudgetSplitFacts> {
  const split = readRecord(record, key);
  if (split.kind === "error") return split;
  const original = readInt(split.value, "original");
  const retained = readInt(split.value, "retained");
  const excludedOverBudget = readInt(split.value, "excluded_over_2048");
  const labels = readRecord(split.value, "retained_labels");
  if (original.kind === "error") return original;
  if (retained.kind === "error") return retained;
  if (excludedOverBudget.kind === "error") return excludedOverBudget;
  if (labels.kind === "error") return labels;
  const retainedLabels = readClassCounts(labels.value);
  if (retainedLabels.kind === "error") return retainedLabels;
  if (retained.value + excludedOverBudget.value !== original.value) {
    return err(`${key} retained and excluded counts do not add up to the original count.`);
  }
  if (retainedLabels.value.vulnerable + retainedLabels.value.safe !== retained.value) {
    return err(`${key} retained labels do not match the retained count.`);
  }
  return ok({
    original: original.value,
    retained: retained.value,
    excludedOverBudget: excludedOverBudget.value,
    retainedLabels: retainedLabels.value,
  });
}

function parseSequenceBudget(value: unknown): ParseResult<SequenceBudgetFacts> {
  if (!isRecord(value)) return err("The sequence budget is not an object.");
  const model = readString(value, "model");
  const tokenizerCommit = readString(value, "tokenizer_commit");
  const trainingAdmission = readString(value, "training_admission");
  const sourceRevision = readString(value, "source_revision");
  const maxSequenceTokens = readInt(value, "max_sequence_tokens");
  const heldOutTestInspected = readBool(value, "held_out_test_inspected");
  const limitations = readStringList(value, "limitations", 40);
  const splits = readRecord(value, "splits");
  if (model.kind === "error") return model;
  if (tokenizerCommit.kind === "error") return tokenizerCommit;
  if (trainingAdmission.kind === "error") return trainingAdmission;
  if (sourceRevision.kind === "error") return sourceRevision;
  if (maxSequenceTokens.kind === "error") return maxSequenceTokens;
  if (heldOutTestInspected.kind === "error") return heldOutTestInspected;
  if (limitations.kind === "error") return limitations;
  if (splits.kind === "error") return splits;
  if (!REVISION_PATTERN.test(sourceRevision.value) || !REVISION_PATTERN.test(tokenizerCommit.value)) {
    return err("A sequence-budget revision is not a 40-character hex commit.");
  }
  const train = parseBudgetSplit(splits.value, "train");
  const validation = parseBudgetSplit(splits.value, "validation");
  if (train.kind === "error") return train;
  if (validation.kind === "error") return validation;
  return ok({
    model: model.value,
    tokenizerCommit: tokenizerCommit.value,
    maxSequenceTokens: maxSequenceTokens.value,
    heldOutTestInspected: heldOutTestInspected.value,
    trainingAdmission: trainingAdmission.value,
    sourceRevision: sourceRevision.value,
    train: train.value,
    validation: validation.value,
    limitations: limitations.value,
    path: "results/data_intake/sequence_budget_2048.json",
  });
}

function parseNemoSplit(record: Record<string, unknown>, key: string): ParseResult<NemoSplitFacts> {
  const split = readRecord(record, key);
  if (split.kind === "error") return split;
  const records = readInt(split.value, "records");
  const labelsRecord = readRecord(split.value, "labels");
  if (records.kind === "error") return records;
  if (labelsRecord.kind === "error") return labelsRecord;
  const labels = readClassCounts(labelsRecord.value);
  if (labels.kind === "error") return labels;
  if (labels.value.vulnerable + labels.value.safe !== records.value) {
    return err(`${key} NeMo labels do not match the record count.`);
  }
  return ok({ records: records.value, labels: labels.value });
}

function parseNemoReadiness(value: unknown): ParseResult<NemoReadinessFacts> {
  if (!isRecord(value)) return err("The NeMo readiness file is not an object.");
  const createdAtUtc = readString(value, "created_at_utc");
  const sourceRevision = readString(value, "source_revision");
  const format = readString(value, "nemo_dataset_format");
  const integrationStatus = readString(value, "integration_status");
  const trainingApprovedRows = readInt(value, "training_approved_rows");
  const qualityCaveats = readStringList(value, "quality_caveats", 40);
  const splits = readRecord(value, "splits");
  if (createdAtUtc.kind === "error") return createdAtUtc;
  if (sourceRevision.kind === "error") return sourceRevision;
  if (format.kind === "error") return format;
  if (integrationStatus.kind === "error") return integrationStatus;
  if (trainingApprovedRows.kind === "error") return trainingApprovedRows;
  if (qualityCaveats.kind === "error") return qualityCaveats;
  if (splits.kind === "error") return splits;
  if (!REVISION_PATTERN.test(sourceRevision.value)) return err("The NeMo readiness revision is not a 40-character hex commit.");
  const train = parseNemoSplit(splits.value, "train");
  const validation = parseNemoSplit(splits.value, "validation");
  const test = parseNemoSplit(splits.value, "test");
  if (train.kind === "error") return train;
  if (validation.kind === "error") return validation;
  if (test.kind === "error") return test;
  return ok({
    createdAtUtc: createdAtUtc.value,
    sourceRevision: sourceRevision.value,
    format: format.value,
    train: train.value,
    validation: validation.value,
    test: test.value,
    trainingApprovedRows: trainingApprovedRows.value,
    integrationStatus: integrationStatus.value,
    qualityCaveats: qualityCaveats.value,
    path: "results/data_intake/nemo_data_readiness.json",
  });
}

function yamlRecord(value: YamlValue, label: string): ParseResult<Record<string, YamlValue>> {
  if (!isRecord(value)) return err(`${label} must be a mapping.`);
  return ok(value);
}

function yamlString(record: Record<string, YamlValue>, key: string): ParseResult<string> {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) return err(`${key} must be a string in the candidate YAML.`);
  return ok(value);
}

function yamlInt(record: Record<string, YamlValue>, key: string): ParseResult<number> {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) return err(`${key} must be an integer in the candidate YAML.`);
  return ok(value);
}

function yamlBool(record: Record<string, YamlValue>, key: string): ParseResult<boolean> {
  const value = record[key];
  if (typeof value !== "boolean") return err(`${key} must be a boolean in the candidate YAML.`);
  return ok(value);
}

function parseLoraCandidate(text: string, maxSequenceTokens: number): ParseResult<LoraCandidateFacts> {
  const document = parseSimpleYaml(text);
  if (document.kind === "error") return document;
  const recipe = yamlString(document.value, "recipe");
  const model = yamlRecord(document.value.model ?? null, "model");
  const distributed = yamlRecord(document.value.distributed ?? null, "distributed");
  const scheduler = yamlRecord(document.value.step_scheduler ?? null, "step_scheduler");
  const dataloader = yamlRecord(document.value.dataloader ?? null, "dataloader");
  const peft = yamlRecord(document.value.peft ?? null, "peft");
  const dataset = yamlRecord(document.value.dataset ?? null, "dataset");
  const validationDataset = yamlRecord(document.value.validation_dataset ?? null, "validation_dataset");
  const freeze = yamlRecord(document.value.freeze_config ?? null, "freeze_config");
  if (recipe.kind === "error") return recipe;
  if (model.kind === "error") return model;
  if (distributed.kind === "error") return distributed;
  if (scheduler.kind === "error") return scheduler;
  if (dataloader.kind === "error") return dataloader;
  if (peft.kind === "error") return peft;
  if (dataset.kind === "error") return dataset;
  if (validationDataset.kind === "error") return validationDataset;
  if (freeze.kind === "error") return freeze;
  const modelId = yamlString(model.value, "pretrained_model_name_or_path");
  const tensorParallel = yamlInt(distributed.value, "tp_size");
  const pipelineParallel = yamlInt(distributed.value, "pp_size");
  const maxSteps = yamlInt(scheduler.value, "max_steps");
  const collate = yamlRecord(dataloader.value.collate_fn ?? null, "collate_fn");
  const matchAllLinear = yamlBool(peft.value, "match_all_linear");
  const datasetSplit = yamlString(dataset.value, "split");
  const validationSplit = yamlString(validationDataset.value, "split");
  const freezeVision = yamlBool(freeze.value, "freeze_vision_tower");
  if (modelId.kind === "error") return modelId;
  if (tensorParallel.kind === "error") return tensorParallel;
  if (pipelineParallel.kind === "error") return pipelineParallel;
  if (maxSteps.kind === "error") return maxSteps;
  if (collate.kind === "error") return collate;
  if (matchAllLinear.kind === "error") return matchAllLinear;
  if (datasetSplit.kind === "error") return datasetSplit;
  if (validationSplit.kind === "error") return validationSplit;
  if (freezeVision.kind === "error") return freezeVision;
  const sequenceLength = yamlInt(collate.value, "max_length");
  if (sequenceLength.kind === "error") return sequenceLength;
  const targets = peft.value.target_modules;
  if (!Array.isArray(targets) || targets.length < 4 || targets.some((item) => typeof item !== "string")) {
    return err("The candidate YAML does not list enough LoRA target modules.");
  }
  const joined = JSON.stringify(dataset.value) + JSON.stringify(validationDataset.value);
  if (
    recipe.value !== "FinetuneRecipeForVLM" ||
    modelId.value !== "Qwen/Qwen3.5-27B" ||
    tensorParallel.value !== 1 ||
    pipelineParallel.value !== 1 ||
    maxSteps.value !== 2 ||
    sequenceLength.value !== maxSequenceTokens ||
    matchAllLinear.value ||
    datasetSplit.value !== "train" ||
    validationSplit.value !== "validation" ||
    joined.includes("test") ||
    !freezeVision.value
  ) {
    return err("Static structural checks for the single-B200 LoRA candidate did not pass.");
  }
  return ok({
    configPath: "config/nemo/qwen35_27b_b200_lora_candidate.yaml",
    recipe: recipe.value,
    modelId: modelId.value,
    tensorParallel: tensorParallel.value,
    pipelineParallel: pipelineParallel.value,
    maxSteps: maxSteps.value,
    maxSequenceTokens: sequenceLength.value,
    structuralValidation: "completed",
    gpuRuntimeValidation: "pending",
    training: "not-started",
  });
}

function countsAgree(left: number, right: number, label: string): ParseResult<true> {
  if (left !== right) return err(`${label} counts disagree across intake artifacts.`);
  return ok(true);
}

function parseEmbedded(text: string): ParseResult<unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return ok(value);
  } catch {
    return err("A build-time dataset file is not valid JSON.");
  }
}

function loadDatasetFacts(): FactLoad {
  const binaryText = parseEmbedded(__PATCHREASON_BINARY_MANIFEST__);
  const candidateText = parseEmbedded(__PATCHREASON_CANDIDATE_SUMMARY__);
  const auditText = parseEmbedded(__PATCHREASON_INTAKE_AUDIT__);
  const budgetText = parseEmbedded(__PATCHREASON_SEQUENCE_BUDGET__);
  const nemoText = parseEmbedded(__PATCHREASON_NEMO_READINESS__);
  if (binaryText.kind === "error") return binaryText;
  if (candidateText.kind === "error") return candidateText;
  if (auditText.kind === "error") return auditText;
  if (budgetText.kind === "error") return budgetText;
  if (nemoText.kind === "error") return nemoText;
  const binary = parseBinaryManifest(binaryText.value);
  const candidates = parseCandidateSummary(candidateText.value);
  const audit = parseAudit(auditText.value);
  const sequenceBudget = parseSequenceBudget(budgetText.value);
  const nemoReadiness = parseNemoReadiness(nemoText.value);
  if (binary.kind === "error") return { kind: "error", message: `Binary manifest: ${binary.message}` };
  if (candidates.kind === "error") return { kind: "error", message: `Candidate summary: ${candidates.message}` };
  if (audit.kind === "error") return { kind: "error", message: `Intake audit: ${audit.message}` };
  if (sequenceBudget.kind === "error") return { kind: "error", message: `Sequence budget: ${sequenceBudget.message}` };
  if (nemoReadiness.kind === "error") return { kind: "error", message: `NeMo readiness: ${nemoReadiness.message}` };
  const loraCandidate = parseLoraCandidate(__PATCHREASON_LORA_CANDIDATE__, sequenceBudget.value.maxSequenceTokens);
  if (loraCandidate.kind === "error") return { kind: "error", message: `LoRA candidate: ${loraCandidate.message}` };
  const revision = binary.value.sourceRevision;
  if (sequenceBudget.value.sourceRevision !== revision || nemoReadiness.value.sourceRevision !== revision) {
    return { kind: "error", message: "Intake artifacts name different source revisions." };
  }
  const trainAgrees = countsAgree(binary.value.selectedCounts.train, sequenceBudget.value.train.original, "Original training");
  const validationAgrees = countsAgree(
    binary.value.selectedCounts.validation,
    sequenceBudget.value.validation.original,
    "Original validation",
  );
  const nemoTrain = countsAgree(binary.value.selectedCounts.train, nemoReadiness.value.train.records, "NeMo training");
  const nemoValidation = countsAgree(binary.value.selectedCounts.validation, nemoReadiness.value.validation.records, "NeMo validation");
  const nemoTest = countsAgree(binary.value.selectedCounts.test, nemoReadiness.value.test.records, "Held-out evaluation");
  if (trainAgrees.kind === "error") return trainAgrees;
  if (validationAgrees.kind === "error") return validationAgrees;
  if (nemoTrain.kind === "error") return nemoTrain;
  if (nemoValidation.kind === "error") return nemoValidation;
  if (nemoTest.kind === "error") return nemoTest;
  const facts: DatasetBundle = {
    binary: binary.value,
    candidates: candidates.value,
    audit: audit.value,
    sequenceBudget: sequenceBudget.value,
    nemoReadiness: nemoReadiness.value,
    loraCandidate: loraCandidate.value,
  };
  return { kind: "ready", facts };
}

export const datasetFacts: FactLoad = loadDatasetFacts();
