import { catalogModels, parseModelId } from "../../lib/models/catalog";
import type { ModelId } from "../../types/domain";

export function ModelSelect({ modelId, onChange }: { modelId: ModelId; onChange: (modelId: ModelId) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-mute">Model</span>
      <select
        className="field"
        value={modelId}
        onChange={(event) => {
          const parsed = parseModelId(event.target.value);
          if (parsed.kind === "ok") onChange(parsed.value);
        }}
      >
        {catalogModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
