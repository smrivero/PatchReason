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

const DEMO_KEY = "patchreason.demoMode";
const DRAFT_KEY = "patchreason.draft.v1";

function readStoredDemoMode(): boolean {
  try {
    return window.localStorage.getItem(DEMO_KEY) === "on";
  } catch {
    return false;
  }
}

function writeStoredDemoMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(DEMO_KEY, enabled ? "on" : "off");
  } catch {
    return;
  }
}

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
  const [demoMode, setDemoModeState] = useState(readStoredDemoMode);
  const [draft, setDraftState] = useState(readStoredDraft);
  const [evaluationImport, setEvaluationImport] = useState<EvaluationImport>({ kind: "none" });
  const [gpuImport, setGpuImport] = useState<GpuImport>({ kind: "none" });
  const [gpuFixtureEnabled, setGpuFixtureEnabled] = useState(false);
  const [runImport, setRunImport] = useState<RunImport>({ kind: "none" });
  const [gateway, setGateway] = useState<GatewaySnapshot>(initialGateway);
  const [attempt, setAttempt] = useState(0);

  const setDemoMode = useCallback((enabled: boolean) => {
    writeStoredDemoMode(enabled);
    setDemoModeState(enabled);
  }, []);

  const setDraft = useCallback((next: CodeDraft) => {
    writeStoredDraft(next);
    setDraftState(next);
  }, []);

  const refreshGateway = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    const base = readApiBase();
    if (base.kind === "unset") {
      setGateway({ kind: "unset" });
      return;
    }
    if (base.kind === "invalid") {
      setGateway({ kind: "invalid", message: base.message });
      return;
    }
    let cancelled = false;
    setGateway({ kind: "loading" });
    void loadGateway(base.baseUrl).then((next) => {
      if (!cancelled) setGateway(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo<WorkspaceValue>(
    () => ({
      demoMode,
      setDemoMode,
      draft,
      setDraft,
      evaluationImport,
      setEvaluationImport,
      gpuImport,
      setGpuImport,
      gpuFixtureEnabled,
      setGpuFixtureEnabled,
      runImport,
      setRunImport,
      gateway,
      refreshGateway,
    }),
    [
      demoMode,
      setDemoMode,
      draft,
      setDraft,
      evaluationImport,
      gpuImport,
      gpuFixtureEnabled,
      runImport,
      gateway,
      refreshGateway,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
