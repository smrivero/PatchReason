import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadGateway, readApiBase } from "../lib/api/client";
import { parseDraft, emptyDraft } from "../lib/review/validateRequest";
import type {
  CodeDraft,
  EvaluationImport,
  GatewaySnapshot,
  GpuImport,
  RunImport,
} from "../types/domain";
import { WorkspaceContext, type WorkspaceValue } from "./workspace-context";

const DRAFT_KEY = "patchreason.draft.v1";

function readStoredDraft(): CodeDraft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (raw === null) return emptyDraft;
    const value: unknown = JSON.parse(raw);
    const parsed = parseDraft(value);
    if (parsed.kind === "ok") return parsed.value;
    return emptyDraft;
  } catch {
    return emptyDraft;
  }
}

function writeStoredDraft(draft: CodeDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

function initialGateway(): GatewaySnapshot {
  const base = readApiBase();
  if (base.kind === "unset") return { kind: "unset" };
  if (base.kind === "invalid") return { kind: "invalid", message: base.message };
  return { kind: "loading" };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState(readStoredDraft);
  const [evaluationImport, setEvaluationImport] = useState<EvaluationImport>({ kind: "none" });
  const [gpuImport, setGpuImport] = useState<GpuImport>({ kind: "none" });
  const [runImport, setRunImport] = useState<RunImport>({ kind: "none" });
  const [gateway, setGateway] = useState<GatewaySnapshot>(initialGateway);
  const [gatewayCheck, setGatewayCheck] = useState<"checking" | "idle">(() => (readApiBase().kind === "ready" ? "checking" : "idle"));
  const [attempt, setAttempt] = useState(0);

  const setDraft = useCallback((next: CodeDraft) => {
    writeStoredDraft(next);
    setDraftState(next);
  }, []);

  const refreshGateway = useCallback(() => {
    setGatewayCheck("checking");
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    const base = readApiBase();
    if (base.kind === "unset") {
      setGateway({ kind: "unset" });
      setGatewayCheck("idle");
      return;
    }
    if (base.kind === "invalid") {
      setGateway({ kind: "invalid", message: base.message });
      setGatewayCheck("idle");
      return;
    }
    let cancelled = false;
    setGatewayCheck("checking");
    void loadGateway(base.baseUrl).then((next) => {
      if (cancelled) return;
      setGateway(next);
      setGatewayCheck("idle");
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      draft,
      setDraft,
      evaluationImport,
      setEvaluationImport,
      gpuImport,
      setGpuImport,
      runImport,
      setRunImport,
      gateway,
      gatewayCheck,
      refreshGateway,
    }),
    [draft, setDraft, evaluationImport, gpuImport, runImport, gateway, gatewayCheck, refreshGateway],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
