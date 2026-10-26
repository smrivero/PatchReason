import { catalogModels, jetsonModelId } from "../../lib/models/catalog";
import type { LiveModel } from "../../types/domain";

export function ModelSelect({
  modelId,
  liveModels,
  onChange,
}: {
  modelId: string;
  liveModels: readonly LiveModel[];
  onChange: (modelId: string) => void;
}) {
  const live = liveModels.filter((model) => model.id === jetsonModelId);
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-mute">Model</span>
      <select className="field" value={modelId} onChange={(event) => onChange(event.target.value)}>
        <optgroup label="Live inference">
          {live.length === 0 ? (
            <option value={jetsonModelId}>Jetson Qwen3.5:4B (pretrained)</option>
          ) : (
            live.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
                {model.availability.kind === "served" ? "" : " (unavailable)"}
              </option>
            ))
          )}
        </optgroup>
        <optgroup label="Future B200 models">
          {catalogModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
