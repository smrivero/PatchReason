import type { CatalogModel, ModelId } from "../../types/domain";
import { err, ok, type ParseResult } from "../parse/result";

type BaselineModelId = "Qwen/Qwen3.5-27B" & { readonly __brand: "ModelId" };
type AdaptedModelId = "Qwen/Qwen3.5-27B+lora" & { readonly __brand: "ModelId" };

export const jetsonModelId = "jetson-qwen35-4b";
export const jetsonLiveLabel = "Live inference · Jetson Qwen3.5:4B (pretrained)";

export const baselineModelId = "Qwen/Qwen3.5-27B" as BaselineModelId;
export const adaptedModelId = "Qwen/Qwen3.5-27B+lora" as AdaptedModelId;

export const baselineModel: CatalogModel = {
  id: baselineModelId,
  displayName: "Qwen3.5-27B baseline",
  role: "baseline",
  revision: "Model card Qwen/Qwen3.5-27B. A local weight revision has not been recorded.",
  availabilityNote: "Not deployed. The browser does not call vLLM.",
};

export const adaptedModel: CatalogModel = {
  id: adaptedModelId,
  displayName: "Qwen3.5-27B LoRA, not trained",
  role: "adapted",
  revision: "config/nemo/qwen35_27b_b200_lora_candidate.yaml. No checkpoint has been written.",
  availabilityNote: "Configuration is prepared. GPU runtime validation has not run, and training has not started.",
};

export const catalogModels: readonly [CatalogModel, CatalogModel] = [baselineModel, adaptedModel];

export function parseModelId(value: string): ParseResult<ModelId> {
  if (value === baselineModelId) return ok(baselineModelId);
  if (value === adaptedModelId) return ok(adaptedModelId);
  return err("Choose the baseline or the LoRA selector.");
}

export function catalogModelById(modelId: ModelId): CatalogModel {
  if (modelId === baselineModelId) return baselineModel;
  return adaptedModel;
}
