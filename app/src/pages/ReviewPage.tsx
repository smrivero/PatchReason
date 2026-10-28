import { useEffect, useRef, useState } from "react";
import { CodeEditor } from "../components/review/CodeEditor";
import { ExampleSelect } from "../components/review/ExampleSelect";
import { FindingsPane } from "../components/review/FindingsPane";
import { ModelSelect } from "../components/review/ModelSelect";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { GatewayStatus } from "../components/status/GatewayStatus";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkspace } from "../hooks/useWorkspace";
import { postLiveReview, readApiBase } from "../lib/api/client";
import { findReviewExample, illustrativeReview } from "../lib/fixtures/reviewExamples";
import { baselineModel, baselineModelId } from "../lib/models/catalog";
import { resolveFindingLine } from "../lib/review/resolveFindingLine";
import { LIVE_MAX_CODE_CHARS, MAX_CODE_CHARS, buildLiveReviewRequest } from "../lib/review/validateRequest";
import type { IllustrativeReview, LanguageId, ModelResponse, ReviewPaneState } from "../types/domain";

export function ReviewPage() {
  usePageTitle("Code review");
  const { draft, setDraft, gateway, refreshGateway } = useWorkspace();
  const [modelId, setModelId] = useState<string>(baselineModelId);
  const [pane, setPane] = useState<ReviewPaneState>({ kind: "idle" });
  const [savedReview, setSavedReview] = useState<ModelResponse | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [reference, setReference] = useState<IllustrativeReview | null>(null);
  const [formError, setFormError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reviewToken, setReviewToken] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const base = readApiBase();
  const liveModels = gateway.kind === "online" && gateway.models.kind === "ready" ? gateway.models.models : [];
  const selectedModel = liveModels.find((model) => model.id === modelId);
  const inferenceReady =
    gateway.kind === "online" &&
    gateway.status.inference === "ready" &&
    selectedModel !== undefined &&
    selectedModel.availability.kind === "served";

  useEffect(() => {
    if (pane.kind !== "loading") return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pane.kind, reviewToken]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function updateDraft(next: { language: LanguageId; filename: string; code: string }): void {
    setDraft(next);
  }

  async function submitReview(): Promise<void> {
    if (abortRef.current !== null) return;
    const request = buildLiveReviewRequest(draft, modelId);
    if (request.kind === "error") {
      setFormError(request.message);
      return;
    }
    if (base.kind !== "ready" || !inferenceReady) {
      setFormError("Live review requires the selected B200 model to be served by vLLM.");
      return;
    }
    const controller = new AbortController();
    const id = requestId.current + 1;
    requestId.current = id;
    abortRef.current = controller;
    setFormError("");
    setReviewToken((current) => current + 1);
    setPane({ kind: "loading" });
    const result = await postLiveReview(base.baseUrl, request.value, controller.signal);
    if (requestId.current !== id) return;
    if (abortRef.current === controller) abortRef.current = null;
    if (result.kind === "cancelled") {
      setPane(savedReview === null ? { kind: "idle" } : { kind: "model", review: savedReview });
      return;
    }
    if (result.kind === "error") {
      setPane({ kind: "error", message: result.message });
      return;
    }
    setSubmittedCode(request.value.code);
    setSavedReview(result.value);
    setPane({ kind: "model", review: result.value });
  }

  function cancelReview(): void {
    abortRef.current?.abort();
  }

  function clearResults(): void {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setSavedReview(null);
    setSubmittedCode(null);
    setReference(null);
    setFormError("");
    setPane({ kind: "idle" });
  }

  function showReference(): void {
    if (draft.language !== "typescript") {
      setFormError("The sample annotations are TypeScript. Switch the language selector to TypeScript.");
      return;
    }
    const match = findReviewExample(draft.code, "typescript");
    if (match === undefined) {
      setFormError("A reference annotation is available only for an unchanged sample.");
      return;
    }
    setFormError("");
    setReference(illustrativeReview(match, baselineModel));
  }

  const highlightReview = pane.kind === "model" ? pane.review : pane.kind === "error" ? savedReview : null;
  const highlightedLines = highlightedLineNumbers({
    paneKind: pane.kind,
    highlightReview,
    submittedCode,
    draftCode: draft.code,
    reference,
  });
  const showSavedUnderError = pane.kind === "error" && savedReview !== null;
  const editorChanged = savedReview !== null && submittedCode !== null && submittedCode !== draft.code;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Code review"
        lede="Paste JavaScript or TypeScript. Sample annotations are distinct from model predictions. Reviews use FastAPI and the B200 vLLM service."
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
                  updateDraft({ ...draft, language });
                }}
              >
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
              </select>
            </label>
            <ModelSelect modelId={modelId} liveModels={liveModels} onChange={setModelId} />
            <label className="block text-sm">
              <span className="mb-1 block text-mute">Filename</span>
              <input
                className="field"
                value={draft.filename}
                onChange={(event) => updateDraft({ ...draft, filename: event.target.value })}
                aria-label="Filename"
              />
            </label>
          </div>
          <ExampleSelect
            onSelect={(example) => {
              updateDraft({ language: example.language, filename: example.filename, code: example.code });
              if (savedReview === null && pane.kind !== "loading" && pane.kind !== "error") {
                setReference(illustrativeReview(example, baselineModel));
              }
            }}
          />
          <CodeEditor
            code={draft.code}
            readOnly={false}
            highlightedLines={[...new Set(highlightedLines)]}
            onChange={(code) => updateDraft({ ...draft, code })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-mute">
              {draft.code.length} / {MAX_CODE_CHARS} characters in the editor. A live review sends at most {LIVE_MAX_CODE_CHARS}{" "}
              characters to the selected model.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={showReference}>
                Show reference annotation
              </button>
              <button type="button" className="btn" onClick={refreshGateway}>
                Check gateway
              </button>
              {pane.kind === "loading" ? (
                <button type="button" className="btn" onClick={cancelReview}>
                  Cancel review
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!inferenceReady || pane.kind === "loading"}
                onClick={() => void submitReview()}
              >
                Review code
              </button>
              {savedReview !== null || pane.kind === "error" || reference !== null ? (
                <button type="button" className="btn" onClick={clearResults}>
                  Clear results
                </button>
              ) : null}
            </div>
          </div>
          <GatewayStatus />
          {inferenceReady || pane.kind === "loading" ? null : (
            <p className="text-sm text-mute">Review code becomes available when the selected B200 model is served.</p>
          )}
          {formError.length > 0 ? <Callout tone="error">{formError}</Callout> : null}
        </section>
        <div className="space-y-4 xl:sticky xl:top-6">
          {editorChanged && pane.kind !== "loading" ? (
            <p className="text-sm text-mute">
              The editor changed after this review. The findings stay on screen. Line highlights return when the editor matches the
              reviewed source, or after you clear the result.
            </p>
          ) : null}
          <FindingsPane
            state={pane}
            code={submittedCode ?? draft.code}
            idleTitle={reviewIdleTitle(base.kind)}
            idleBody={reviewIdleBody(base.kind)}
            progress={pane.kind === "loading" ? { elapsedSeconds, onCancel: cancelReview } : null}
            onRetry={() => void submitReview()}
          />
          {showSavedUnderError ? (
            <FindingsPane state={{ kind: "model", review: savedReview }} code={submittedCode ?? draft.code} />
          ) : null}
          {reference === null ? null : (
            <FindingsPane state={{ kind: "fixture", review: reference }} code={draft.code} />
          )}
        </div>
      </div>
    </div>
  );
}

function highlightedLineNumbers(input: {
  paneKind: ReviewPaneState["kind"];
  highlightReview: ModelResponse | null;
  submittedCode: string | null;
  draftCode: string;
  reference: IllustrativeReview | null;
}): number[] {
  if (input.paneKind === "loading") return [];
  if (input.highlightReview !== null && input.submittedCode === input.draftCode) {
    return input.highlightReview.findings.flatMap((finding) => {
      const resolved = resolveFindingLine(input.submittedCode ?? input.draftCode, finding);
      return resolved.highlight === null ? [] : [resolved.highlight];
    });
  }
  if (input.reference !== null && input.highlightReview === null) {
    const match = findReviewExample(input.draftCode, "typescript");
    if (match === undefined || match.id !== input.reference.exampleId) return [];
    return input.reference.findings.flatMap((finding) => {
      const resolved = resolveFindingLine(input.draftCode, finding);
      return resolved.highlight === null ? [] : [resolved.highlight];
    });
  }
  return [];
}

function reviewIdleTitle(baseKind: "unset" | "invalid" | "ready"): string {
  return baseKind === "ready" ? "No live review yet" : "Review service not connected";
}

function reviewIdleBody(baseKind: "unset" | "invalid" | "ready"): string {
  if (baseKind === "ready") {
    return "Run Review code when the selected B200 model is ready. Sample annotations stay labeled as reference text.";
  }
  return "Set VITE_API_BASE_URL to http://127.0.0.1:8000. Sample annotations stay labeled as reference text.";
}
