import { catalogModels } from "../../lib/models/catalog";
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
  const live = liveModels;
  const unavailableCatalog = catalogModels.filter((model) => !live.some((item) => item.id === model.id));
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-mute">Model</span>
      <select className="field" value={modelId} onChange={(event) => onChange(event.target.value)}>
        <optgroup label="B200 models">
          {live.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}{model.availability.kind === "served" ? "" : " (unavailable)"}
            </option>
          ))}
          {unavailableCatalog.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
