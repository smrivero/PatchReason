import { useEffect, useState } from "react";
import { loadRuns, readApiBase } from "../lib/api/client";
import type { RemoteRunsState } from "../types/domain";

function initialState(): RemoteRunsState {
  const base = readApiBase();
  if (base.kind === "unset") return { kind: "unset" };
  if (base.kind === "invalid") return { kind: "invalid", message: base.message };
  return { kind: "loading" };
}

export function useRemoteRuns(): RemoteRunsState {
  const [state, setState] = useState<RemoteRunsState>(initialState);

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
    void loadRuns(base.baseUrl).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
