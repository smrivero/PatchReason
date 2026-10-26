export type LanguageId = "javascript" | "typescript";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ModelRole = "baseline" | "adapted";

type BaselineModelId = "Qwen/Qwen3.5-27B" & { readonly __brand: "ModelId" };
type AdaptedModelId = "Qwen/Qwen3.5-27B+lora" & { readonly __brand: "ModelId" };

export type ModelId = BaselineModelId | AdaptedModelId;

export interface Finding {
  cwe: string;
  severity: Severity;
  evidence: string;
  explanation: string;
  remediation: string;
}

export type Timing =
  | { kind: "not-measured" }
  | { kind: "measured"; latencyMs: number };

export interface CatalogModel {
  id: ModelId;
  displayName: string;
  role: ModelRole;
  revision: string;
  availabilityNote: string;
}

export interface ReviewExample {
  id: string;
  title: string;
  language: "typescript";
  filename: string;
  context: string;
  code: string;
  findings: readonly Finding[];
}

export interface CodeDraft {
  language: LanguageId;
  filename: string;
  code: string;
}

export type FilenameField =
  | { kind: "omitted" }
  | { kind: "provided"; value: string };

export interface ReviewRequest {
  code: string;
  language: LanguageId;
  modelId: ModelId;
  filename: FilenameField;
}

export const FIXTURE_REVIEW_LABEL = "Illustrative fixture / no model inference";

export interface IllustrativeReview {
  kind: "illustrative-fixture";
  label: typeof FIXTURE_REVIEW_LABEL;
  source: "datasets/reference_examples.jsonl";
  exampleId: string;
  context: string;
  model: CatalogModel;
  findings: readonly Finding[];
  timing: { kind: "not-measured" };
}

export interface ModelResponse {
  kind: "model";
  modelId: string;
  displayName: string;
  role: ModelRole;
  revision: string;
  findings: readonly Finding[];
  timing: Timing;
}

export type ReviewPaneState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "fixture"; review: IllustrativeReview }
  | { kind: "model"; review: ModelResponse };

export interface SplitCounts {
  train: number;
  validation: number;
  test: number;
}

export interface ClassCounts {
  vulnerable: number;
  safe: number;
}

export interface BinaryDatasetFacts {
  sourceUrl: string;
  sourceRevision: string;
  createdAtUtc: string;
  sourceCounts: SplitCounts;
  afterStructuralFilters: SplitCounts;
  selectedCounts: SplitCounts;
  labels: {
    train: ClassCounts;
    validation: ClassCounts;
    test: ClassCounts;
  };
  excludedRowCount: number;
  duplicateSkipCount: number;
  duplicatesAcrossSelectedPartitions: number;
  sampling: string;
  trainingAdmission: string;
  limitations: readonly string[];
  manifestPath: "results/data_intake/js_binary_manifest.json";
}

export interface CandidateQueueFacts {
  stage: string;
  generatedAtUtc: string;
  sourceQueue: string;
  sourceCandidates: number;
  pendingHumanReview: number;
  trainingApprovedRows: number;
  distinctCweCategories: number;
  uniqueRepositories: number;
  limitations: string;
  summaryPath: "results/data_intake/candidate_review_summary.json";
}

export interface IntakeAuditFacts {
  stage: string;
  rows: number;
  trainingApprovedRows: number;
  uniqueRepositories: number;
  limits: string;
  auditPath: "results/data_intake/audit.json";
}

export interface BudgetSplitFacts {
  original: number;
  retained: number;
  excludedOverBudget: number;
  retainedLabels: ClassCounts;
}

export interface SequenceBudgetFacts {
  model: string;
  tokenizerCommit: string;
  maxSequenceTokens: number;
  heldOutTestInspected: boolean;
  trainingAdmission: string;
  sourceRevision: string;
  train: BudgetSplitFacts;
  validation: BudgetSplitFacts;
  limitations: readonly string[];
  path: "results/data_intake/sequence_budget_2048.json";
}

export interface NemoSplitFacts {
  records: number;
  labels: ClassCounts;
}

export interface NemoReadinessFacts {
  createdAtUtc: string;
  sourceRevision: string;
  format: string;
  train: NemoSplitFacts;
  validation: NemoSplitFacts;
  test: NemoSplitFacts;
  trainingApprovedRows: number;
  integrationStatus: string;
  qualityCaveats: readonly string[];
  path: "results/data_intake/nemo_data_readiness.json";
}

export interface LoraCandidateFacts {
  configPath: "config/nemo/qwen35_27b_b200_lora_candidate.yaml";
  recipe: string;
  modelId: string;
  tensorParallel: number;
  pipelineParallel: number;
  maxSteps: number;
  maxSequenceTokens: number;
  structuralValidation: "completed";
  gpuRuntimeValidation: "pending";
  training: "not-started";
}

export interface DatasetBundle {
  binary: BinaryDatasetFacts;
  candidates: CandidateQueueFacts;
  audit: IntakeAuditFacts;
  sequenceBudget: SequenceBudgetFacts;
  nemoReadiness: NemoReadinessFacts;
  loraCandidate: LoraCandidateFacts;
}

export type FactLoad =
  | { kind: "ready"; facts: DatasetBundle }
  | { kind: "error"; message: string };

export type Ratio =
  | { kind: "value"; value: number }
  | { kind: "undefined"; reason: string };

export type JsonValidity =
  | { kind: "not-provided" }
  | { kind: "value"; value: number }
  | { kind: "undefined"; reason: string };

export interface ConfusionMatrix {
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
}

export interface CweCount {
  cwe: string;
  count: number;
}

export interface EvaluationScores {
  modelId: string;
  datasetRevision: string;
  precision: Ratio;
  recall: Ratio;
  f1: Ratio;
  falsePositiveRate: Ratio;
  jsonValidity: JsonValidity;
  confusion: ConfusionMatrix;
  perCwe: readonly CweCount[];
  notes: readonly string[];
}

export type EvaluationDocument =
  | { kind: "empty" }
  | { kind: "scored"; scores: EvaluationScores }
  | { kind: "error"; message: string };

export type EvaluationImport =
  | { kind: "none" }
  | { kind: "scored"; fileName: string; scores: EvaluationScores }
  | { kind: "error"; message: string };

export type RemoteEvaluationState =
  | { kind: "unset" }
  | { kind: "invalid"; message: string }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "scored"; scores: EvaluationScores }
  | { kind: "error"; message: string };

export type NonEmpty<T> = [T, ...T[]];

export interface GpuSample {
  timestampText: string;
  gpuName: string;
  utilizationPercent: number;
  memoryUtilizationPercent: number;
  vramUsedMiB: number;
  vramTotalMiB: number;
  powerWatts: number;
  temperatureC: number;
}

export type GpuOrigin =
  | { kind: "csv"; fileName: string }
  | { kind: "api"; runId: string }
  | { kind: "fixture" };

export interface GpuSeries {
  origin: GpuOrigin;
  sourceLabel: string;
  gpuModel: string;
  samples: NonEmpty<GpuSample>;
  skippedRowCount: number;
}

export type GpuImport =
  | { kind: "none" }
  | { kind: "series"; series: GpuSeries }
  | { kind: "error"; message: string };

export type DigestState =
  | { kind: "not-recorded" }
  | { kind: "recorded"; value: string };

export type LoraState =
  | { kind: "not-derived"; reason: string }
  | {
      kind: "recorded";
      rank: number;
      alpha: number;
      dropout: number;
      targetModules: readonly string[];
    };

export type ValidationLoss =
  | { kind: "not-recorded" }
  | { kind: "recorded"; value: number };

export interface ScalarPoint {
  step: number;
  trainLoss: number;
  validationLoss: ValidationLoss;
}

export type ScalarSeries =
  | { kind: "unavailable"; reason: string }
  | { kind: "recorded"; points: NonEmpty<ScalarPoint> };

export type RunLifecycle = "not-started" | "running" | "completed" | "failed";

export interface PlannedRun {
  kind: "planned";
  id: string;
  modelId: string;
  datasetRevision: string;
  containerTag: string;
  containerDigest: { kind: "not-recorded" };
  lora: { kind: "not-derived"; reason: string };
  lifecycle: "not-started";
  scalars: { kind: "unavailable"; reason: string };
  notes: readonly string[];
}

export interface RecordedRun {
  kind: "recorded";
  id: string;
  modelId: string;
  datasetRevision: string;
  containerTag: string;
  containerDigest: DigestState;
  lora: LoraState;
  lifecycle: "running" | "completed" | "failed";
  scalars: ScalarSeries;
  notes: readonly string[];
}

export type ParsedRun =
  | { kind: "planned"; run: PlannedRun }
  | { kind: "recorded"; run: RecordedRun };

export type RunImport =
  | { kind: "none" }
  | { kind: "record"; fileName: string; run: ParsedRun }
  | { kind: "error"; message: string };

export type RemoteRunsState =
  | { kind: "unset" }
  | { kind: "invalid"; message: string }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "recorded"; run: RecordedRun }
  | { kind: "error"; message: string };

export type ArtifactPresence =
  | { kind: "not-captured"; note: string }
  | { kind: "in-repo"; note: string };

export interface Artifact {
  id: string;
  kind: "screenshot" | "manifest" | "profile-note";
  title: string;
  path: string;
  presence: ArtifactPresence;
}

export type InferenceAvailability = "unavailable" | "ready";

export interface OnlineStatus {
  gatewayVersion: string;
  inference: InferenceAvailability;
}

export interface LiveModel {
  id: string;
  displayName: string;
  role: ModelRole;
  revision: string;
  availability:
    | { kind: "not-deployed"; note: string }
    | { kind: "served"; endpointLabel: string };
}

export type ModelLoad =
  | { kind: "ready"; models: readonly LiveModel[] }
  | { kind: "error"; message: string };

export type GatewaySnapshot =
  | { kind: "unset" }
  | { kind: "invalid"; message: string }
  | { kind: "loading" }
  | { kind: "online"; status: OnlineStatus; models: ModelLoad }
  | { kind: "offline"; message: string };

export type ApiBase =
  | { kind: "unset" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; baseUrl: string };

export type RemoteGpuState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string };
