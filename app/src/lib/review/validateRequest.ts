import type { CodeDraft, LanguageId, ModelId, ReviewRequest } from "../../types/domain";
import { jetsonModelId } from "../models/catalog";
import { isRecord } from "../parse/guards";
import { err, ok, type ParseResult } from "../parse/result";

export const MAX_CODE_CHARS = 20000;
export const LIVE_MIN_CODE_CHARS = 10;
export const LIVE_MAX_CODE_CHARS = 10000;
const FILENAME_PATTERN = /^[A-Za-z0-9._-]{1,120}$/;

export const emptyDraft: CodeDraft = {
  language: "typescript",
  filename: "",
  code: "",
};

function isLanguage(value: string): value is LanguageId {
  return value === "javascript" || value === "typescript";
}

export function parseDraft(value: unknown): ParseResult<CodeDraft> {
  if (!isRecord(value)) return err("Stored draft is not an object.");
  const language = value.language;
  const filename = value.filename;
  const code = value.code;
  if (typeof language !== "string" || !isLanguage(language)) return err("Stored language is invalid.");
  if (typeof filename !== "string" || filename.length > 120) return err("Stored filename is invalid.");
  if (typeof code !== "string" || code.length > MAX_CODE_CHARS) return err("Stored code is invalid.");
  return ok({ language, filename, code });
}

export function buildReviewRequest(input: { draft: CodeDraft; modelId: ModelId }): ParseResult<ReviewRequest> {
  const code = input.draft.code;
  if (code.trim().length === 0) return err("Add source code before requesting a review.");
  if (code.length > MAX_CODE_CHARS) return err(`Code must stay within ${String(MAX_CODE_CHARS)} characters.`);
  if (code.includes("\u0000")) return err("Code cannot include null bytes.");
  const filename = input.draft.filename.trim();
  if (filename.length === 0) {
    return ok({
      code,
      language: input.draft.language,
      modelId: input.modelId,
      filename: { kind: "omitted" },
    });
  }
  if (!FILENAME_PATTERN.test(filename)) {
    return err("Filename must be a basename made of letters, digits, dots, underscores, or dashes.");
  }
  return ok({
    code,
    language: input.draft.language,
    modelId: input.modelId,
    filename: { kind: "provided", value: filename },
  });
}

export interface LiveReviewRequest {
  code: string;
  language: LanguageId;
  model: typeof jetsonModelId;
  filename: string | null;
}

export function buildLiveReviewRequest(draft: CodeDraft): ParseResult<LiveReviewRequest> {
  const code = draft.code;
  if (code.trim().length < LIVE_MIN_CODE_CHARS) {
    return err(`Add at least ${String(LIVE_MIN_CODE_CHARS)} characters before requesting a live review.`);
  }
  if (code.length > LIVE_MAX_CODE_CHARS) {
    return err(`The Jetson gateway accepts at most ${String(LIVE_MAX_CODE_CHARS)} characters.`);
  }
  if (code.includes("\u0000")) return err("Code cannot include null bytes.");
  const filename = draft.filename.trim();
  if (filename.length > 0 && !FILENAME_PATTERN.test(filename)) {
    return err("Filename must be a basename made of letters, digits, dots, underscores, or dashes.");
  }
  return ok({
    code,
    language: draft.language,
    model: jetsonModelId,
    filename: filename.length === 0 ? null : filename,
  });
}
