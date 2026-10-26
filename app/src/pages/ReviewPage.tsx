import { useState } from "react";
import { CodeEditor } from "../components/review/CodeEditor";
import { ExampleSelect } from "../components/review/ExampleSelect";
import { FindingsPane } from "../components/review/FindingsPane";
import { ModelSelect } from "../components/review/ModelSelect";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { StatusChip } from "../components/status/StatusChip";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkspace } from "../hooks/useWorkspace";
import { postReview, readApiBase } from "../lib/api/client";
import { affectedLineNumbers } from "../lib/review/affectedLines";
import { findReviewExample, illustrativeReview } from "../lib/fixtures/reviewExamples";
import { catalogModelById, baselineModelId } from "../lib/models/catalog";
import { MAX_CODE_CHARS, buildReviewRequest } from "../lib/review/validateRequest";
import type { LanguageId, ModelId, ReviewPaneState } from "../types/domain";

export function ReviewPage() {
  usePageTitle("Code review");
  const { draft, setDraft } = useWorkspace();
  const [modelId, setModelId] = useState<ModelId>(baselineModelId);
  const [pane, setPane] = useState<ReviewPaneState>({ kind: "idle" });
  const [formError, setFormError] = useState("");
  const base = readApiBase();
  const apiReady = base.kind === "ready";

  function publishDraft(next: { language: LanguageId; filename: string; code: string }, activeModel: ModelId): void {
    setDraft(next);
    setFormError("");
    const match = next.language === "typescript" ? findReviewExample(next.code, "typescript") : undefined;
    setPane(match === undefined ? { kind: "idle" } : { kind: "fixture", review: illustrativeReview(match, catalogModelById(activeModel)) });
  }

  async function submitReview(): Promise<void> {
    const request = buildReviewRequest({ draft, modelId });
    if (request.kind === "error") {
      setFormError(request.message);
      return;
    }
    if (base.kind !== "ready") {
      setFormError("Inference stays disabled until VITE_API_BASE_URL points at a PatchReason gateway.");
      return;
    }
    setFormError("");
    setPane({ kind: "loading" });
    const result = await postReview(base.baseUrl, request.value);
    if (result.kind === "error") {
      setPane({ kind: "error", message: result.message });
      return;
    }
    setPane({ kind: "model", review: result.value });
  }

  function showFixture(): void {
    if (draft.language !== "typescript") {
      setFormError("The synthetic references are TypeScript. Switch the language selector to TypeScript.");
      return;
    }
    const match = findReviewExample(draft.code, "typescript");
    if (match === undefined) {
      setFormError("Illustrative findings are available only for an unchanged synthetic reference example.");
      return;
    }
    setFormError("");
    setPane({ kind: "fixture", review: illustrativeReview(match, catalogModelById(modelId)) });
  }

  const selected = catalogModelById(modelId);
  const highlightedLines =
    pane.kind === "fixture" || pane.kind === "model"
      ? [...new Set(pane.review.findings.flatMap((finding) => affectedLineNumbers(draft.code, finding.evidence)))]
      : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Code review"
        lede="Paste JavaScript or TypeScript. An illustrative sample shows a labeled reference review without calling a model. Review code uses the gateway when it is connected."
        actions={<StatusChip tone={apiReady ? "ok" : "pending"}>{apiReady ? "Gateway URL set" : "Service not connected"}</StatusChip>}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="panel space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-mute">Language</span>
              <select
                className="field"
                value={draft.language}
                onChange={(event) => {
                  const language = event.target.value === "javascript" ? "javascript" : "typescript";
                  publishDraft({ ...draft, language }, modelId);
                }}
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
              </select>
            </label>
            <ModelSelect
              modelId={modelId}
              onChange={(next) => {
                setModelId(next);
                publishDraft(draft, next);
              }}
            />
            <label className="block text-sm">
              <span className="mb-1 block text-mute">Filename</span>
              <input
                className="field"
                value={draft.filename}
                onChange={(event) => publishDraft({ ...draft, filename: event.target.value }, modelId)}
                aria-label="Filename"
              />
            </label>
          </div>
          <ExampleSelect
            onSelect={(example) =>
              publishDraft({ language: example.language, filename: example.filename, code: example.code }, modelId)
            }
          />
          <CodeEditor
            code={draft.code}
            readOnly={false}
            highlightedLines={highlightedLines}
            onChange={(code) => publishDraft({ ...draft, code }, modelId)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-mute">
              {draft.code.length} / {MAX_CODE_CHARS} characters. {selected.revision}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={showFixture}>
                View illustrative review
              </button>
              <button type="button" className="btn btn-primary" disabled={!apiReady || pane.kind === "loading"} onClick={() => void submitReview()}>
                Review code
              </button>
            </div>
          </div>
          {apiReady ? null : (
            <p className="text-sm text-mute">
              Review code is disabled. The review service is not connected. Set VITE_API_BASE_URL to the PatchReason gateway. The page
              will not call vLLM.
            </p>
          )}
          {formError.length > 0 ? <Callout tone="error">{formError}</Callout> : null}
        </section>
        <div className="xl:sticky xl:top-6">
          <FindingsPane state={pane} code={draft.code} />
        </div>
      </div>
    </div>
  );
}
