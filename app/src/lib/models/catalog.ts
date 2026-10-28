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
  revision: "Hugging Face revision fc05daec18b0a78c049392ed2e771dde82bdf654.",
  availabilityNote: "Available when the B200 vLLM endpoint is ready.",
};

export const adaptedModel: CatalogModel = {
  id: adaptedModelId,
  displayName: "Qwen3.5-27B LoRA",
  role: "adapted",
  revision: "NeMo AutoModel PEFT checkpoint; full-epoch evaluation pending.",
  availabilityNote: "Available when vLLM has loaded the LoRA adapter.",
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
