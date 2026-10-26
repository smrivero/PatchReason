import { reviewExamples } from "../../lib/fixtures/reviewExamples";
import type { ReviewExample } from "../../types/domain";

export function ExampleSelect({ onSelect }: { onSelect: (example: ReviewExample) => void }) {
  return (
    <div>
      <p id="sample-label" className="mb-2 text-xs font-medium text-mute">
        Sample code
      </p>
      <div role="group" aria-labelledby="sample-label" className="flex flex-wrap gap-2">
        {reviewExamples.map((example) => (
          <button key={example.id} type="button" className="btn" onClick={() => onSelect(example)}>
            {example.title}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-mute">
        Sample code from the reference set. Loading a sample fills the editor. Its reference annotation is separate from model findings.
      </p>
    </div>
  );
}
