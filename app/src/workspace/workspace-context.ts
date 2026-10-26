import { createContext } from "react";
import type {
  CodeDraft,
  EvaluationImport,
  GatewaySnapshot,
  GpuImport,
  RunImport,
} from "../types/domain";

export interface WorkspaceValue {
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  draft: CodeDraft;
  setDraft: (draft: CodeDraft) => void;
  evaluationImport: EvaluationImport;
  setEvaluationImport: (next: EvaluationImport) => void;
  gpuImport: GpuImport;
  setGpuImport: (next: GpuImport) => void;
  gpuFixtureEnabled: boolean;
  setGpuFixtureEnabled: (enabled: boolean) => void;
  runImport: RunImport;
  setRunImport: (next: RunImport) => void;
  gateway: GatewaySnapshot;
  refreshGateway: () => void;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);
