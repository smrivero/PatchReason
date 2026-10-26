import { createContext } from "react";
import type {
  CodeDraft,
  EvaluationImport,
  GatewaySnapshot,
  GpuImport,
  RunImport,
} from "../types/domain";

export interface WorkspaceValue {
  draft: CodeDraft;
  setDraft: (draft: CodeDraft) => void;
  evaluationImport: EvaluationImport;
  setEvaluationImport: (next: EvaluationImport) => void;
  gpuImport: GpuImport;
  setGpuImport: (next: GpuImport) => void;
  runImport: RunImport;
  setRunImport: (next: RunImport) => void;
  gateway: GatewaySnapshot;
  gatewayCheck: "checking" | "idle";
  refreshGateway: () => void;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);
