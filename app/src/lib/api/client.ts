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
import { parseEvaluationDocument } from "../parse/evaluation";
import { parseGpuDocument } from "../parse/gpuCsv";
import { isRecord, readString } from "../parse/guards";
import { parseRunDocument } from "../parse/runRecord";
import { err, ok, type ParseResult } from "../parse/result";
import { apiPaths } from "./paths";

const REQUEST_TIMEOUT_MS = 15000;
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

function readHttpError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "The request failed.";
  if (error.code === "ECONNABORTED") return "The gateway timed out.";
  const status = error.response?.status;
  if (status === undefined) return "The gateway did not respond.";
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
  return ok({ gatewayVersion: gatewayVersion.value, inference: inference.value });
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

function parseModels(value: unknown): ParseResult<readonly LiveModel[]> {
  if (!Array.isArray(value)) return err("The models payload must be an array.");
  if (value.length > 20) return err("The models payload is too large.");
  const models: LiveModel[] = [];
  for (const item of value) {
    const parsed = parseLiveModel(item);
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
  if (value.kind === "illustrative-fixture" || value.label === "Illustrative fixture / no model inference") {
    return err("The gateway returned a fixture label. PatchReason will not show that as a model response.");
  }
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
  });
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
    });
    const body: unknown = response.data;
    return parseModelResponse(body);
  } catch (error: unknown) {
    return err(readHttpError(error));
  }
}

function emptyOrDocument(body: unknown): EvaluationDocument {
  if (body === null || body === "") return { kind: "empty" };
  return parseEvaluationDocument(body);
}

export async function loadEvaluation(baseUrl: string): Promise<RemoteEvaluationState> {
  const response = await getJson(baseUrl, apiPaths.evaluationSummary, null);
  if (response.kind === "error") return response;
  const document = emptyOrDocument(response.body);
  if (document.kind === "error") return document;
  if (document.kind === "empty") return { kind: "empty" };
  return { kind: "scored", scores: document.scores };
}

export async function loadRuns(baseUrl: string): Promise<RemoteRunsState> {
  const response = await getJson(baseUrl, apiPaths.runs, null);
  if (response.kind === "error") return response;
  if (response.body === null || response.body === "") return { kind: "empty" };
  const document = parseRunDocument(response.body);
  if (document.kind === "empty") return { kind: "empty" };
  if (document.kind === "error") return document;
  if (document.value.kind === "planned") return { kind: "empty" };
  return { kind: "recorded", run: document.value.run };
}

export async function loadGpu(baseUrl: string, runId: string): Promise<ParseResult<GpuSeries> | { kind: "empty" }> {
  const response = await getJson(baseUrl, apiPaths.gpuTelemetry, { run_id: runId });
  if (response.kind === "error") return err(response.message);
  if (response.body === null || response.body === "") return { kind: "empty" };
  return parseGpuDocument(response.body, runId);
}
