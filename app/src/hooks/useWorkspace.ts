import { useContext } from "react";
import { WorkspaceContext, type WorkspaceValue } from "../workspace/workspace-context";

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (value === null) {
    throw new Error("WorkspaceProvider is missing.");
  }
  return value;
}
