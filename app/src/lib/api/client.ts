import axios, { type AxiosInstance } from "axios";
import type {
  ApiBase,
  EvaluationDocument,
  Finding,
  GatewaySnapshot,
  GpuSeries,
  LiveModel,
  ModelResponse,
  OnlineStatus,
  RemoteEvaluationState,
  RemoteRunsState,
  ReviewRequest,
} from "../../types/domain";
import type { LiveReviewRequest } from "../review/validateRequest";
import { parseEvaluationDocument } from "../parse/evaluation";
import { parseGpuDocument } from "../parse/gpuCsv";
import { isRecord, readString } from "../parse/guards";
import { parseRunDocument } from "../parse/runRecord";
import { jetsonLiveLabel, jetsonModelId } from "../models/catalog";
import { err, ok, type ParseResult } from "../parse/result";
import { apiPaths } from "./paths";

const REQUEST_TIMEOUT_MS = 15000;
const REVIEW_TIMEOUT_MS = 160000;
const MAX_BODY_BYTES = 2_000_000;

export function readApiBase(): ApiBase {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== "string" || raw.trim().length === 0) return { kind: "unset" };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: "invalid", message: "VITE_API_BASE_URL must be an http or https URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid", message: "VITE_API_BASE_URL must use http or https." };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return { kind: "invalid", message: "VITE_API_BASE_URL must not include credentials." };
  }
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return { kind: "ready", baseUrl: `${url.origin}${path}` };
}

function createGateway(baseUrl: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    timeout: REQUEST_TIMEOUT_MS,
    withCredentials: false,
    maxContentLength: MAX_BODY_BYTES,
    maxBodyLength: MAX_BODY_BYTES,
    headers: { Accept: "application/json" },
  });
}

function readDetail(data: unknown): string | null {
  if (!isRecord(data)) return null;
  if (typeof data.detail === "string" && data.detail.trim().length > 0) return data.detail;
  if (!Array.isArray(data.detail)) return null;
  const messages: string[] = [];
  for (const item of data.detail) {
    if (isRecord(item) && typeof item.msg === "string" && item.msg.trim().length > 0) messages.push(item.msg);
  }
  return messages.length === 0 ? null : messages.join(" ");
}

function readHttpError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "The request failed.";
  if (error.code === "ECONNABORTED") return "The inference gateway timed out.";
  const status = error.response?.status;
  const detail = readDetail(error.response?.data);
  if (status === 409) return detail ?? "That model is not currently served by the gateway.";
  if (status === 503) return detail ?? "The inference service is unreachable. Check the SSH tunnel and model server.";
  if (status === 504) return detail ?? "The model inference timed out.";
  if (status === 502) return detail ?? "The model response was not valid structured JSON.";
  if (detail !== null) return detail;
  if (status === undefined) return "The gateway did not respond. Start the local FastAPI gateway and confirm the SSH tunnel.";
  return `The gateway returned HTTP ${String(status)}.`;
}

type HttpGet =
  | { kind: "ok"; status: number; body: unknown }
  | { kind: "error"; message: string };

async function getJson(baseUrl: string, path: string, query: Record<string, string> | null): Promise<HttpGet> {
  try {
    const client = createGateway(baseUrl);
    const response = query === null ? await client.get(path) : await client.get(path, { params: query });
    const body: unknown = response.data;
    return { kind: "ok", status: response.status, body };
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { kind: "ok", status: 404, body: { kind: "empty" } };
    }
    return { kind: "error", message: readHttpError(error) };
  }
}

function parseStatus(value: unknown): ParseResult<OnlineStatus> {
  if (!isRecord(value)) return err("The status payload is not an object.");
  if (typeof value.inference_ready === "boolean") {
    const message = typeof value.message === "string" ? value.message : "";
    const liveModelId = typeof value.model === "string" ? value.model : null;
    const upstreamModel = typeof value.upstream_model === "string" ? value.upstream_model : null;
    const gatewayName = typeof value.gateway === "string" && value.gateway.trim().length > 0 ? value.gateway : "PatchReason FastAPI";
    return ok({
      gatewayVersion: "fastapi",
      gatewayName,
      inference: value.inference_ready ? "ready" : "unavailable",
      message,
      liveModelId,
      upstreamModel,
      loraTrained: value.model_trained_with_lora === true,
    });
  }
  const gatewayVersion = readString(value, "gatewayVersion");
  const inference = readString(value, "inference");
  if (gatewayVersion.kind === "error") return gatewayVersion;
  if (inference.kind === "error") return inference;
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(gatewayVersion.value)) {
    return err("gatewayVersion has an unexpected shape.");
  }
  if (inference.value !== "unavailable" && inference.value !== "ready") {
    return err("inference must be unavailable or ready.");
  }
  return ok({
    gatewayVersion: gatewayVersion.value,
    gatewayName: gatewayVersion.value,
    inference: inference.value,
    message: "",
    liveModelId: null,
    upstreamModel: null,
    loraTrained: false,
  });
}

function parseLiveModel(value: unknown): ParseResult<LiveModel> {
  if (!isRecord(value)) return err("A model record must be an object.");
  const id = readString(value, "id");
  const displayName = readString(value, "displayName");
  const role = readString(value, "role");
  const revision = readString(value, "revision");
  if (id.kind === "error") return id;
  if (displayName.kind === "error") return displayName;
  if (role.kind === "error") return role;
  if (revision.kind === "error") return revision;
  if (role.value !== "baseline" && role.value !== "adapted") return err("model.role is unknown.");
  if (id.value.length > 200 || displayName.value.length > 120 || revision.value.length > 300) {
    return err("A model field is too long.");
  }
  if (!isRecord(value.availability)) return err("model.availability must be an object.");
  const availability = value.availability;
  if (availability.kind === "not-deployed") {
    const note = readString(availability, "note");
    if (note.kind === "error") return note;
    return ok({
      id: id.value,
      displayName: displayName.value,
      role: role.value,
      revision: revision.value,
      availability: { kind: "not-deployed", note: note.value },
    });
  }
  if (availability.kind === "served") {
    const endpointLabel = readString(availability, "endpointLabel");
    if (endpointLabel.kind === "error") return endpointLabel;
    if (!/^[A-Za-z0-9 ._-]{1,80}$/.test(endpointLabel.value)) {
      return err("endpointLabel must be a short name, not a URL.");
    }
    return ok({
      id: id.value,
      displayName: displayName.value,
      role: role.value,
      revision: revision.value,
      availability: { kind: "served", endpointLabel: endpointLabel.value },
    });
  }
  return err("model.availability.kind is unknown.");
}

function parseJetsonModel(value: unknown): ParseResult<LiveModel> {
  if (!isRecord(value)) return err("A model record must be an object.");
  const id = readString(value, "id");
  const name = readString(value, "name");
  const upstream = readString(value, "upstream_model");
  const description = readString(value, "description");
  if (id.kind === "error") return id;
  if (name.kind === "error") return name;
  if (upstream.kind === "error") return upstream;
  if (description.kind === "error") return description;
  if (typeof value.available !== "boolean") return err("model.available must be a boolean.");
  if (typeof value.adapted !== "boolean") return err("model.adapted must be a boolean.");
  const jetson = id.value === jetsonModelId;
  const displayName = jetson ? "Jetson Qwen3.5:4B (pretrained)" : name.value;
  const availability = value.available
    ? { kind: "served" as const, endpointLabel: jetson ? "Ollama via SSH tunnel" : "Served by the gateway" }
    : { kind: "not-deployed" as const, note: description.value };
  return ok({
    id: id.value,
    displayName,
    role: value.adapted ? "adapted" : "baseline",
    revision: upstream.value,
    availability,
  });
}

function parseModels(value: unknown): ParseResult<readonly LiveModel[]> {
  const records = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.models) ? value.models : null;
  if (records === null) return err("The models payload must be an array or a models object.");
  if (records.length > 20) return err("The models payload is too large.");
  const jetsonShape = !Array.isArray(value);
  const models: LiveModel[] = [];
  for (const item of records) {
    const parsed = jetsonShape ? parseJetsonModel(item) : parseLiveModel(item);
    if (parsed.kind === "error") return parsed;
    models.push(parsed.value);
  }
  return ok(models);
}

export async function loadGateway(baseUrl: string): Promise<GatewaySnapshot> {
  const statusResponse = await getJson(baseUrl, apiPaths.status, null);
  if (statusResponse.kind === "error") return { kind: "offline", message: statusResponse.message };
  const status = parseStatus(statusResponse.body);
  if (status.kind === "error") return { kind: "offline", message: status.message };
  const modelsResponse = await getJson(baseUrl, apiPaths.models, null);
  if (modelsResponse.kind === "error") {
    return { kind: "online", status: status.value, models: { kind: "error", message: modelsResponse.message } };
  }
  const models = parseModels(modelsResponse.body);
  if (models.kind === "error") {
    return { kind: "online", status: status.value, models: { kind: "error", message: models.message } };
  }
  return { kind: "online", status: status.value, models: { kind: "ready", models: models.value } };
}

const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

function parseModelResponse(value: unknown): ParseResult<ModelResponse> {
  if (!isRecord(value)) return err("The review payload is not an object.");
  if (value.kind === "illustrative-fixture" || value.label === "Illustrative fixture / no model inference" || value.is_demo === true) {
    return err("The gateway returned a fixture label. PatchReason will not show that as a model response.");
  }
  if (typeof value.model_id === "string" || typeof value.latency_ms === "number") return parseJetsonReview(value);
  const modelId = readString(value, "modelId");
  const displayName = readString(value, "displayName");
  const role = readString(value, "role");
  const revision = readString(value, "revision");
  if (modelId.kind === "error") return modelId;
  if (displayName.kind === "error") return displayName;
  if (role.kind === "error") return role;
  if (revision.kind === "error") return revision;
  if (role.value !== "baseline" && role.value !== "adapted") return err("role must be baseline or adapted.");
  if (!Array.isArray(value.findings)) return err("findings must be an array.");
  if (value.findings.length > 50) return err("The review returned too many findings.");
  const findings: Finding[] = [];
  for (const item of value.findings) {
    if (!isRecord(item)) return err("A finding must be an object.");
    const cwe = readString(item, "cwe");
    const severity = readString(item, "severity");
    const evidence = readString(item, "evidence");
    const explanation = readString(item, "explanation");
    const remediation = readString(item, "remediation");
    if (cwe.kind === "error") return cwe;
    if (severity.kind === "error") return severity;
    if (evidence.kind === "error") return evidence;
    if (explanation.kind === "error") return explanation;
    if (remediation.kind === "error") return remediation;
    if (!/^CWE-\d{1,5}$/.test(cwe.value)) return err("A finding CWE must look like CWE-89.");
    if (!SEVERITIES.some((itemSeverity) => itemSeverity === severity.value)) {
      return err("A finding severity is unknown.");
    }
    if (evidence.value.length > 2000 || explanation.value.length > 2000 || remediation.value.length > 2000) {
      return err("A finding field is too long.");
    }
    const matchedSeverity = SEVERITIES.find((itemSeverity) => itemSeverity === severity.value);
    if (matchedSeverity === undefined) return err("A finding severity is unknown.");
    findings.push({
      cwe: cwe.value,
      severity: matchedSeverity,
      evidence: evidence.value,
      explanation: explanation.value,
      remediation: remediation.value,
    });
  }
  const timing = parseTiming(value.timing);
  if (timing.kind === "error") return timing;
  return ok({
    kind: "model",
    modelId: modelId.value,
    displayName: displayName.value,
    role: role.value,
    revision: revision.value,
    findings,
    timing: timing.value,
    headline: "Gateway response",
    summary: "",
    limitations: [],
    vulnerable: null,
    usage: null,
  });
}

function parseJetsonReview(value: Record<string, unknown>): ParseResult<ModelResponse> {
  const modelId = readString(value, "model_id");
  const modelName = readString(value, "model_name");
  if (modelId.kind === "error") return modelId;
  if (modelName.kind === "error") return modelName;
  if (modelId.value !== jetsonModelId && modelId.value !== "Qwen/Qwen3.5-27B" && modelId.value !== "Qwen/Qwen3.5-27B+lora") return err("The live review returned an unsupported model ID.");
  if (value.mode !== "live") return err("The review mode is not live.");
  if (typeof value.vulnerable !== "boolean") return err("vulnerable must be a boolean.");
  const summary = readString(value, "summary");
  if (summary.kind === "error") return summary;
  if (!Array.isArray(value.findings)) return err("findings must be an array.");
  if (value.findings.length > 8) return err("The review returned too many findings.");
  const findings: Finding[] = [];
  for (const item of value.findings) {
    if (!isRecord(item)) return err("A finding must be an object.");
    const title = readString(item, "title");
    const cwe = readString(item, "cwe");
    const severity = readString(item, "severity");
    const explanation = readString(item, "explanation");
    const recommendation = readString(item, "recommendation");
    if (title.kind === "error") return title;
    if (cwe.kind === "error") return cwe;
    if (severity.kind === "error") return severity;
    if (explanation.kind === "error") return explanation;
    if (recommendation.kind === "error") return recommendation;
    if (!/^(CWE-\d{1,5}|UNKNOWN)$/.test(cwe.value)) return err("A finding CWE must look like CWE-89 or UNKNOWN.");
    const matchedSeverity = SEVERITIES.find((itemSeverity) => itemSeverity === severity.value);
    if (matchedSeverity === undefined) return err("A finding severity is unknown.");
    const finding: Finding = {
      cwe: cwe.value,
      severity: matchedSeverity,
      evidence: title.value,
      explanation: explanation.value,
      remediation: recommendation.value,
      title: title.value,
    };
    if (typeof item.line === "number" && Number.isInteger(item.line) && item.line >= 1) finding.line = item.line;
    findings.push(finding);
  }
  if (typeof value.latency_ms !== "number" || !Number.isFinite(value.latency_ms) || value.latency_ms < 0 || value.latency_ms > 600_000) {
    return err("latency_ms must be a measured duration in milliseconds.");
  }
  const limitations = Array.isArray(value.limitations)
    ? value.limitations.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const usage = parseUsage(value.usage);
  return ok({
    kind: "model",
    modelId: modelId.value,
    displayName: modelId.value === jetsonModelId ? "Jetson Qwen3.5:4B (pretrained)" : modelId.value === "Qwen/Qwen3.5-27B+lora" ? "Qwen3.5-27B + LoRA" : "Qwen3.5-27B (pretrained)",
    role: modelId.value === "Qwen/Qwen3.5-27B+lora" ? "adapted" : "baseline",
    revision: modelName.value,
    findings,
    timing: { kind: "measured", latencyMs: value.latency_ms },
    headline: modelId.value === jetsonModelId ? jetsonLiveLabel : "Live inference · NVIDIA B200 / vLLM",
    summary: summary.value,
    limitations,
    vulnerable: value.vulnerable,
    usage,
  });
}

function parseUsage(value: unknown): ModelResponse["usage"] {
  if (!isRecord(value)) return null;
  const promptTokens = value.prompt_tokens;
  const completionTokens = value.completion_tokens;
  if (typeof promptTokens !== "number" || typeof completionTokens !== "number") return null;
  if (!Number.isInteger(promptTokens) || !Number.isInteger(completionTokens)) return null;
  if (promptTokens < 0 || completionTokens < 0 || promptTokens > 1_000_000 || completionTokens > 1_000_000) return null;
  return { promptTokens, completionTokens };
}

function parseTiming(value: unknown): ParseResult<ModelResponse["timing"]> {
  if (!isRecord(value)) return err("timing must be an object.");
  if (value.kind === "not-measured") return ok({ kind: "not-measured" });
  if (value.kind !== "measured") return err("timing.kind is unknown.");
  if (typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) || value.latencyMs < 0 || value.latencyMs > 600_000) {
    return err("latencyMs must be a measured duration in milliseconds.");
  }
  return ok({ kind: "measured", latencyMs: value.latencyMs });
}

function requestBody(request: ReviewRequest): {
  code: string;
  language: ReviewRequest["language"];
  modelId: string;
  filename?: string;
} {
  if (request.filename.kind === "omitted") {
    return {
      code: request.code,
      language: request.language,
      modelId: request.modelId,
    };
  }
  return {
    code: request.code,
    language: request.language,
    modelId: request.modelId,
    filename: request.filename.value,
  };
}

export async function postReview(baseUrl: string, request: ReviewRequest): Promise<ParseResult<ModelResponse>> {
  try {
    const response = await createGateway(baseUrl).post(apiPaths.reviews, requestBody(request), {
      headers: { "Content-Type": "application/json" },
      timeout: REVIEW_TIMEOUT_MS,
    });
    const body: unknown = response.data;
    return parseModelResponse(body);
  } catch (error: unknown) {
    return err(readHttpError(error));
  }
}

export async function postLiveReview(
  baseUrl: string,
  request: LiveReviewRequest,
  signal?: AbortSignal,
): Promise<ParseResult<ModelResponse> | { kind: "cancelled" }> {
  try {
    const response = await createGateway(baseUrl).post(
      apiPaths.reviews,
      { code: request.code, language: request.language, model: request.model, filename: request.filename },
      signal === undefined
        ? { headers: { "Content-Type": "application/json" }, timeout: REVIEW_TIMEOUT_MS }
        : { headers: { "Content-Type": "application/json" }, timeout: REVIEW_TIMEOUT_MS, signal },
    );
    const body: unknown = response.data;
    return parseModelResponse(body);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.code === "ERR_CANCELED") return { kind: "cancelled" };
    return err(readHttpError(error));
  }
}

function isUncollectedPayload(body: unknown): boolean {
  if (!isRecord(body)) return false;
  return body.status === "pending_collection" || body.status === "not_collected" || body.status === "not_started";
}

function emptyOrDocument(body: unknown): EvaluationDocument {
  if (body === null || body === "") return { kind: "empty" };
  return parseEvaluationDocument(body);
}

export async function loadEvaluation(baseUrl: string): Promise<RemoteEvaluationState> {
  const response = await getJson(baseUrl, apiPaths.evaluationSummary, null);
  if (response.kind === "error") return response;
  if (isUncollectedPayload(response.body)) return { kind: "empty" };
  const document = emptyOrDocument(response.body);
  if (document.kind === "error") return document;
  if (document.kind === "empty") return { kind: "empty" };
  return { kind: "scored", scores: document.scores };
}

export async function loadRuns(baseUrl: string): Promise<RemoteRunsState> {
  const response = await getJson(baseUrl, apiPaths.runs, null);
  if (response.kind === "error") return response;
  if (response.body === null || response.body === "" || isUncollectedPayload(response.body)) return { kind: "empty" };
  const document = parseRunDocument(response.body);
  if (document.kind === "empty") return { kind: "empty" };
  if (document.kind === "error") return document;
  if (document.value.kind === "planned") return { kind: "empty" };
  return { kind: "recorded", run: document.value.run };
}

export async function loadGpu(baseUrl: string, runId: string): Promise<ParseResult<GpuSeries> | { kind: "empty" }> {
  const response = await getJson(baseUrl, apiPaths.gpuTelemetry, { run_id: runId });
  if (response.kind === "error") return err(response.message);
  if (response.body === null || response.body === "" || isUncollectedPayload(response.body)) return { kind: "empty" };
  return parseGpuDocument(response.body, runId);
}
