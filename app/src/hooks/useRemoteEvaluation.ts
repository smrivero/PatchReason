import { useEffect, useState } from "react";
import { loadEvaluation, readApiBase } from "../lib/api/client";
import type { RemoteEvaluationState } from "../types/domain";

function initialState(): RemoteEvaluationState {
  const base = readApiBase();
  if (base.kind === "unset") return { kind: "unset" };
  if (base.kind === "invalid") return { kind: "invalid", message: base.message };
  return { kind: "loading" };
}

export function useRemoteEvaluation(): RemoteEvaluationState {
  const [state, setState] = useState<RemoteEvaluationState>(initialState);

  useEffect(() => {
    const base = readApiBase();
    if (base.kind === "unset") {
      setState({ kind: "unset" });
      return;
    }
    if (base.kind === "invalid") {
      setState({ kind: "invalid", message: base.message });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void loadEvaluation(base.baseUrl).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
